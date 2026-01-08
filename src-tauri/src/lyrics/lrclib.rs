use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LrcLibResponse {
    pub id: u64,
    pub name: String,
    pub track_name: String,
    pub artist_name: String,
    pub album_name: String,
    pub duration: f64,
    pub instrumental: bool,
    pub plain_lyrics: Option<String>,
    pub synced_lyrics: Option<String>,
}

pub struct LrcLibClient;

impl LrcLibClient {
    pub async fn get_lyrics(
        title: &str,
        artist: &str,
        album: &str,
        duration: f64,
    ) -> Result<Option<LrcLibResponse>, String> {
        log::info!(
            "Fetching lyrics for: {} - {} (Album: {}, Duration: {})",
            title,
            artist,
            album,
            duration
        );

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent("Spotist/0.1.0 (https://github.com/RayZ3R0/spotist)")
            .build()
            .map_err(|e| e.to_string())?;

        // 1. Try exact match via /get endpoint
        let mut url =
            reqwest::Url::parse("https://lrclib.net/api/get").map_err(|e| e.to_string())?;

        {
            let mut pairs = url.query_pairs_mut();
            pairs.append_pair("track_name", title);
            pairs.append_pair("artist_name", artist);
            pairs.append_pair("album_name", album);
            pairs.append_pair("duration", &duration.to_string());
        }

        log::debug!("Trying exact match URL: {}", url);

        match client.get(url.clone()).send().await {
            Ok(resp) => {
                log::info!("Exact match status: {}", resp.status());
                if resp.status().is_success() {
                    let text = match resp.text().await {
                        Ok(t) => t,
                        Err(e) => {
                            log::error!("Failed to read response text: {:?}", e);
                            return Ok(None);
                        }
                    };

                    log::info!(
                        "Raw response (first 500 chars): {}",
                        &text.chars().take(500).collect::<String>()
                    );

                    match serde_json::from_str::<LrcLibResponse>(&text) {
                        Ok(lyrics) => {
                            log::info!(
                                "✓ Got response - synced: {}, plain: {}",
                                lyrics.synced_lyrics.is_some(),
                                lyrics.plain_lyrics.is_some()
                            );
                            return Ok(Some(lyrics));
                        }
                        Err(e) => {
                            log::error!("Failed to parse JSON: {:?}", e);
                        }
                    }
                }
            }
            Err(e) => log::error!("Exact match request failed: {:?}", e),
        }

        // 2. If exact match fails, try search
        let mut search_url =
            reqwest::Url::parse("https://lrclib.net/api/search").map_err(|e| e.to_string())?;

        search_url
            .query_pairs_mut()
            .append_pair("q", &format!("{} {}", artist, title));

        log::debug!("Trying search URL: {}", search_url);

        match client.get(search_url).send().await {
            Ok(resp) => {
                log::info!("Search request status: {}", resp.status());
                if resp.status().is_success() {
                    if let Ok(results) = resp.json::<Vec<LrcLibResponse>>().await {
                        log::info!("Found {} search results", results.len());
                        // Filter results to find a good match match
                        // We check if duration is close enough (within 3 seconds)
                        for result in results {
                            let diff = (result.duration - duration).abs();
                            if diff < 3.0 {
                                log::info!("Found match in search results (diff: {}s)", diff);
                                return Ok(Some(result));
                            }
                        }
                        log::warn!("No search results matched duration (Tolerance: 3s)");
                    }
                }
            }
            Err(e) => log::error!("Search request failed: {:?}", e),
        }

        Ok(None)
    }
}
