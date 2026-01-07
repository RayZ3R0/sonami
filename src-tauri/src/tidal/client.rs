use reqwest::Client;
use serde_json::Value;
use std::time::Duration;

use super::config::*;
use super::endpoint_manager::{Endpoint, EndpointManager};
use super::error::TidalError;
use super::models::*;

pub struct TidalClient {
    endpoint_manager: EndpointManager,
    client: Client,
}

impl TidalClient {
    pub async fn new() -> Result<Self, TidalError> {
        let endpoint_manager = EndpointManager::new().await?;
        let client = Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECONDS))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            .build()?;

        Ok(Self {
            endpoint_manager,
            client,
        })
    }

    async fn make_request(
        &self,
        path: &str,
        params: &[(&str, &str)],
        operation: &str,
    ) -> Result<Value, TidalError> {
        let endpoints = self.endpoint_manager.get_all_endpoints();

        log::info!(
            "Starting request for {} with {} endpoints",
            operation,
            endpoints.len()
        );

        for (idx, endpoint) in endpoints.iter().enumerate() {
            let url = format!("{}{}", endpoint.url, path);

            log::debug!(
                "[{}/{}] Trying {}: {}",
                idx + 1,
                endpoints.len(),
                endpoint.name,
                url
            );

            match self.try_endpoint(endpoint, &url, params, operation).await {
                Ok(data) => {
                    self.endpoint_manager.record_success(endpoint);
                    return Ok(data);
                }
                Err(e) => {
                    self.endpoint_manager.record_failure(endpoint);
                    log::warn!(
                        "[{}/{}] {} failed: {}",
                        idx + 1,
                        endpoints.len(),
                        endpoint.name,
                        e
                    );

                    if let TidalError::NetworkError(ref msg) = e {
                        if msg.contains("429") {
                            log::warn!("Rate limited, sleeping {}ms", RATE_LIMIT_SLEEP_MS);
                            tokio::time::sleep(Duration::from_millis(RATE_LIMIT_SLEEP_MS)).await;
                        }
                    }
                }
            }
        }

        log::error!(
            "✗ All {} endpoints failed for {}",
            endpoints.len(),
            operation
        );
        Err(TidalError::AllEndpointsFailed)
    }

    async fn try_endpoint(
        &self,
        _endpoint: &Endpoint,
        url: &str,
        params: &[(&str, &str)],
        operation: &str,
    ) -> Result<Value, TidalError> {
        let url = reqwest::Url::parse_with_params(url, params)
            .map_err(|e| TidalError::NetworkError(format!("URL parse error: {}", e)))?;

        let response = self.client.get(url.clone()).send().await?;

        let status = response.status();
        let url_debug = response.url().to_string();

        let text = response
            .text()
            .await
            .map_err(|e| TidalError::NetworkError(e.to_string()))?;

        if status.as_u16() == 429 {
            log::warn!("Rate limit (429) at {}", url_debug);
            return Err(TidalError::NetworkError("429".to_string()));
        }

        if status.as_u16() == 404 || status.as_u16() == 500 {
            log::warn!("Endpoint error ({}) at {}", status, url_debug);
            return Err(TidalError::NetworkError(format!("{}", status.as_u16())));
        }

        if !status.is_success() {
            log::warn!("Request failed ({}) at {}: {}", status, url_debug, text);
            return Err(TidalError::NetworkError(format!(
                "HTTP {} - {}",
                status, text
            )));
        }

        let mut data: Value = serde_json::from_str(&text)
            .map_err(|e| TidalError::ParseError(format!("JSON error at {}: {}", url_debug, e)))?;

        if let Some(obj) = data.as_object() {
            if obj.contains_key("data") && obj.contains_key("version") {
                data = obj.get("data").unwrap().clone();
            }
        }

        if operation.starts_with("search") {
            if let Some(obj) = data.as_object() {
                let is_empty = if let Some(items) = obj.get("items").and_then(|v| v.as_array()) {
                    items.is_empty()
                } else if operation.contains("tracks") {
                    obj.get("tracks")
                        .and_then(|t| t.get("items"))
                        .and_then(|i| i.as_array())
                        .is_none_or(|a| a.is_empty())
                } else if operation.contains("albums") {
                    obj.get("albums")
                        .and_then(|t| t.get("items"))
                        .and_then(|i| i.as_array())
                        .is_none_or(|a| a.is_empty())
                } else if operation.contains("artists") {
                    obj.get("artists")
                        .and_then(|t| t.get("items"))
                        .and_then(|i| i.as_array())
                        .is_none_or(|a| a.is_empty())
                } else if operation.contains("playlists") {
                    obj.get("playlists")
                        .and_then(|t| t.get("items"))
                        .and_then(|i| i.as_array())
                        .is_none_or(|a| a.is_empty())
                } else {
                    false
                };

                if is_empty {
                    return Err(TidalError::NotFound("Empty search results".to_string()));
                }
            }
        }

        Ok(data)
    }

    fn extract_items<T>(&self, data: &Value, key: &str) -> Vec<T>
    where
        T: serde::de::DeserializeOwned,
    {
        if let Some(obj) = data.as_object() {
            if let Some(items) = obj.get("items").and_then(|v| v.as_array()) {
                return items
                    .iter()
                    .filter_map(|item| serde_json::from_value(item.clone()).ok())
                    .collect();
            }

            if let Some(nested) = obj.get(key).and_then(|v| v.as_object()) {
                if let Some(items) = nested.get("items").and_then(|v| v.as_array()) {
                    return items
                        .iter()
                        .filter_map(|item| serde_json::from_value(item.clone()).ok())
                        .collect();
                }
            }
        }

        Vec::new()
    }

    pub async fn search_tracks(&self, query: &str) -> Result<SearchResponse<Track>, TidalError> {
        let data = self
            .make_request("/search/", &[("s", query)], "search_tracks")
            .await?;
        let items = self.extract_items(&data, "tracks");
        Ok(SearchResponse { items })
    }

    pub async fn search_albums(&self, query: &str) -> Result<SearchResponse<Album>, TidalError> {
        let data = self
            .make_request("/search/", &[("al", query)], "search_albums")
            .await?;
        let items = self.extract_items(&data, "albums");
        Ok(SearchResponse { items })
    }

    pub async fn search_artists(&self, query: &str) -> Result<SearchResponse<Artist>, TidalError> {
        let data = self
            .make_request("/search/", &[("a", query)], "search_artists")
            .await?;
        let items = self.extract_items(&data, "artists");
        Ok(SearchResponse { items })
    }

    pub async fn search_playlists(
        &self,
        query: &str,
    ) -> Result<SearchResponse<Playlist>, TidalError> {
        let data = self
            .make_request("/search/", &[("p", query)], "search_playlists")
            .await?;
        let items = self.extract_items(&data, "playlists");
        Ok(SearchResponse { items })
    }

    pub async fn get_track(
        &self,
        track_id: u64,
        quality: Quality,
    ) -> Result<TrackStreamInfo, TidalError> {
        let data = self
            .make_request(
                "/track/",
                &[("id", &track_id.to_string()), ("quality", quality.as_str())],
                "get_track",
            )
            .await?;

        let url = Self::extract_stream_url(&data)?;

        Ok(TrackStreamInfo {
            url,
            codec: data.get("codec").and_then(|v| v.as_str()).map(String::from),
            quality,
        })
    }

    fn extract_stream_url(data: &Value) -> Result<String, TidalError> {
        if let Some(url) = data
            .get("url")
            .or_else(|| data.get("streamUrl"))
            .or_else(|| data.get("playbackUrl"))
            .and_then(|v| v.as_str())
        {
            return Ok(url.to_string());
        }

        if let Some(manifest) = data.get("manifest").and_then(|v| v.as_str()) {
            use base64::Engine;
            let decoded_bytes = base64::engine::general_purpose::STANDARD
                .decode(manifest)
                .map_err(|e| TidalError::ParseError(format!("Invalid base64 manifest: {}", e)))?;

            let decoded = String::from_utf8(decoded_bytes)
                .map_err(|e| TidalError::ParseError(format!("Invalid UTF-8 manifest: {}", e)))?;

            if let Ok(manifest_json) = serde_json::from_str::<Value>(&decoded) {
                if let Some(urls) = manifest_json.get("urls").and_then(|v| v.as_array()) {
                    if let Some(url) = urls.first().and_then(|v| v.as_str()) {
                        return Ok(url.to_string());
                    }
                }
            }

            return Err(TidalError::ParseError(
                "Could not extract URL from manifest".to_string(),
            ));
        }

        Err(TidalError::NotFound("Stream URL not found".to_string()))
    }

    pub async fn get_track_metadata(&self, track_id: u64) -> Result<Track, TidalError> {
        let result = self.search_tracks(&track_id.to_string()).await?;

        result
            .items
            .into_iter()
            .find(|t| t.id == track_id)
            .ok_or_else(|| TidalError::NotFound(format!("Track {} not found", track_id)))
    }

    pub async fn get_album(&self, album_id: u64) -> Result<Album, TidalError> {
        let data = self
            .make_request("/album/", &[("id", &album_id.to_string())], "get_album")
            .await?;
        serde_json::from_value(data).map_err(|e| e.into())
    }

    pub async fn get_album_tracks(&self, album_id: u64) -> Result<Vec<Track>, TidalError> {
        let data = self
            .make_request(
                "/album/",
                &[("id", &album_id.to_string())],
                "get_album_tracks",
            )
            .await?;
        Ok(self.extract_items(&data, "items"))
    }

    pub async fn get_artist(&self, artist_id: u64) -> Result<Artist, TidalError> {
        let data = self
            .make_request("/artist/", &[("f", &artist_id.to_string())], "get_artist")
            .await?;
        serde_json::from_value(data).map_err(|e| e.into())
    }

    pub async fn get_playlist(&self, playlist_id: &str) -> Result<Playlist, TidalError> {
        let data = self
            .make_request("/playlist/", &[("id", playlist_id)], "get_playlist")
            .await?;
        serde_json::from_value(data).map_err(|e| e.into())
    }
}
