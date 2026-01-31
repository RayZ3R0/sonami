use crate::auth;
use crate::hash_finder::HashFinder;
use crate::utils;
use anyhow::{anyhow, Context, Result};
use reqwest::Client as ReqwestClient;
use serde_json::Value;

pub struct SpotApiClient {
    client: ReqwestClient,
    hash_finder: HashFinder,
    access_token: String,
    client_token: String,
    client_id: String,
    client_version: String,
    device_id: String,
}

impl Default for SpotApiClient {
    fn default() -> Self {
        Self::new()
    }
}

impl SpotApiClient {
    pub fn new() -> Self {
        let client = ReqwestClient::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .build()
            .unwrap();

        Self {
            client,
            hash_finder: HashFinder::new(),
            access_token: String::new(),
            client_token: String::new(),
            client_id: String::new(),
            client_version: String::new(),
            device_id: String::new(),
        }
    }

    pub async fn ensure_auth(&mut self) -> Result<()> {
        if self.access_token.is_empty() {
            self.get_session().await?;
        }
        Ok(())
    }

    async fn get_session(&mut self) -> Result<()> {
        let resp = self
            .client
            .get("https://open.spotify.com")
            .send()
            .await
            .context("Failed to fetch open.spotify.com")?;
        let html = resp.text().await?;

        if let Some(idx) = html.find(r#"<script id="appServerConfig" type="text/plain">"#) {
            let start = idx + r#"<script id="appServerConfig" type="text/plain">"#.len();
            if let Some(end) = html[start..].find("</script>") {
                let config_b64 = &html[start..start + end];
                use base64::{engine::general_purpose, Engine as _};
                let config_bytes = general_purpose::STANDARD
                    .decode(config_b64)
                    .context("Failed to decode base64 config")?;
                let config: Value = serde_json::from_slice(&config_bytes)?;

                if let Some(ver) = config["clientVersion"].as_str() {
                    self.client_version = ver.to_string();
                }
            }
        }

        if self.client_version.is_empty() {
            return Err(anyhow!("Could not find clientVersion"));
        }

        self.device_id = utils::random_hex_string(32);

        let (totp, version) = auth::generate_totp(&self.client).await?;

        let params = [
            ("reason", "init"),
            ("productType", "web-player"),
            ("totp", &totp),
            ("totpVer", &version.to_string()),
            ("totpServer", &totp),
        ];

        let resp = self
            .client
            .get("https://open.spotify.com/api/token")
            .query(&params)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!(
                "Failed to get access token. Status: {}. Text: {}",
                status,
                text
            ));
        }

        let body: Value = resp
            .json()
            .await
            .context("Failed to parse access token response")?;

        if let Some(token) = body["accessToken"].as_str() {
            self.access_token = token.to_string();
        } else {
            return Err(anyhow!("Could not get access token"));
        }

        if let Some(cid) = body["clientId"].as_str() {
            self.client_id = cid.to_string();
        }

        self.get_client_token().await?;

        Ok(())
    }

    async fn get_client_token(&mut self) -> Result<()> {
        let json_body = serde_json::json!({
            "client_data": {
                "client_version": self.client_version,
                "client_id": self.client_id,
                "js_sdk_data": {
                    "device_brand": "unknown",
                    "device_model": "unknown",
                    "os": "windows",
                    "os_version": "NT 10.0",
                    "device_id": self.device_id,
                    "device_type": "computer"
                }
            }
        });

        let resp = self
            .client
            .post("https://clienttoken.spotify.com/v1/clienttoken")
            .header("Authority", "clienttoken.spotify.com")
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .json(&json_body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!(
                "Failed to get client token. Status: {}. Text: {}",
                status,
                text
            ));
        }

        let body: Value = resp
            .json()
            .await
            .context("Failed to parse client token response")?;

        if let Some(token) = body["granted_token"]["token"].as_str() {
            self.client_token = token.to_string();
        } else {
            return Err(anyhow!("Could not get client token"));
        }

        Ok(())
    }

    pub async fn get_query_hash(&mut self, name: &str) -> Result<String> {
        if self.hash_finder.part_hash(name).is_err() {
            self.hash_finder.get_sha256_hash(&self.client).await?;
        }
        self.hash_finder.part_hash(name)
    }

    pub async fn query(&mut self, operation_name: &str, variables: Value) -> Result<Value> {
        self.ensure_auth().await?;
        let hash = self.get_query_hash(operation_name).await?;

        let extensions = serde_json::json!({
            "persistedQuery": {
                "version": 1,
                "sha256Hash": hash
            }
        });

        let params = [
            ("operationName", operation_name),
            ("variables", &variables.to_string()),
            ("extensions", &extensions.to_string()),
        ];

        let resp = self
            .client
            .post("https://api-partner.spotify.com/pathfinder/v1/query")
            .header("Authorization", format!("Bearer {}", self.access_token))
            .header("Client-Token", &self.client_token)
            .header("Spotify-App-Version", &self.client_version)
            .header("Accept-Language", "en")
            .header("Content-Length", "0")
            .query(&params)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!(
                "Failed to query {}. Status: {}. Text: {}",
                operation_name,
                status,
                text
            ));
        }

        let body: Value = resp.json().await.context(format!(
            "Failed to parse query response for {}",
            operation_name
        ))?;

        if !body["errors"].is_null() {
            return Err(anyhow!("Query failed: {:?}", body["errors"]));
        }

        Ok(body)
    }
}
