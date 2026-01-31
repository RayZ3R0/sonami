use anyhow::{anyhow, Result};
use reqwest::Client;
use totp_rs::{Algorithm, TOTP};

const FALLBACK_SECRET: (u32, &[u8]) = (
    18,
    &[
        70, 60, 33, 57, 92, 120, 90, 33, 32, 62, 62, 55, 126, 93, 66, 35, 108, 68,
    ],
);

async fn get_latest_totp_secret(client: &Client) -> (u32, Vec<u8>) {
    let url =
        "https://code.thetadev.de/ThetaDev/spotify-secrets/raw/branch/main/secrets/secretDict.json";

    if let Ok(resp) = client.get(url).send().await {
        if resp.status().is_success() {
            if let Ok(secrets) = resp
                .json::<std::collections::HashMap<String, Vec<u8>>>()
                .await
            {
                if let Some((ver_str, secret)) = secrets
                    .iter()
                    .max_by_key(|(k, _)| k.parse::<i32>().unwrap_or(0))
                {
                    if let Ok(ver) = ver_str.parse::<u32>() {
                        return (ver, secret.clone());
                    }
                }
            }
        }
    }

    (FALLBACK_SECRET.0, FALLBACK_SECRET.1.to_vec())
}

pub async fn generate_totp(client: &Client) -> Result<(String, u32)> {
    let (version, secret_bytes) = get_latest_totp_secret(client).await;

    let mut transformed = Vec::new();
    for (t, &e) in secret_bytes.iter().enumerate() {
        transformed.push(e ^ (((t as u8) % 33) + 9));
    }

    let joined: String = transformed.iter().map(|num| num.to_string()).collect();

    let hex_str = hex::encode(joined);

    let bytes = hex::decode(hex_str)?;

    let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, bytes).unwrap();

    let token = totp
        .generate_current()
        .map_err(|e| anyhow!("TOTP gen failed: {}", e))?;

    Ok((token, version))
}
