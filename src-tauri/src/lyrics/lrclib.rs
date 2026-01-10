use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LrcLibResponse {
    pub id: u64,
    pub name: String,
    pub track_name: Option<String>,
    pub artist_name: String,
    pub album_name: Option<String>,
    pub duration: f64,
    pub instrumental: bool,
    pub plain_lyrics: Option<String>,
    pub synced_lyrics: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct LrcLibSearchResponse {
    pub id: u64,
    pub name: String,
    pub artist_name: String,
    pub album_name: Option<String>,
    pub duration: Option<f64>,
}

pub struct LrcLibClient;

impl LrcLibClient {
    pub async fn get_lyrics(
        title: &str,
        artist: &str,
        album: &str,
        duration: f64,
    ) -> Result<Option<LrcLibResponse>, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .user_agent("LRCGET v0.2.0 (https://github.com/jeffvli/feishin)")
            .build()
            .map_err(|e| e.to_string())?;

        let url = "https://lrclib.net/api/get";
        let params = [
            ("artist_name", artist),
            ("track_name", title),
            ("album_name", album),
            ("duration", &duration.to_string()),
        ];

        log::info!("Fetching LRCLib lyrics for: {} - {}", title, artist);

        let resp = client.get(url).query(&params).send().await;

        match resp {
            Ok(response) => {
                if response.status().is_success() {
                    match response.json::<LrcLibResponse>().await {
                        Ok(data) => return Ok(Some(data)),
                        Err(e) => log::warn!("Failed to parse LRCLib response: {}", e),
                    }
                } else if response.status() == 404 {
                    log::info!("LRCLib direct fetch not found (404)");
                } else {
                    log::warn!("LRCLib request failed: {}", response.status());
                }
            }
            Err(e) => log::warn!("LRCLib request error: {}", e),
        }

        log::info!("Falling back to LRCLib search...");
        let search_url = "https://lrclib.net/api/search";
        let search_params = [("q", title)];

        let search_resp = client
            .get(search_url)
            .query(&search_params)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !search_resp.status().is_success() {
            return Ok(None);
        }

        let search_results: Vec<LrcLibSearchResponse> = search_resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse search results: {}", e))?;

        for item in search_results {
            if item
                .artist_name
                .to_lowercase()
                .contains(&artist.to_lowercase())
                || artist
                    .to_lowercase()
                    .contains(&item.artist_name.to_lowercase())
            {
                if let Some(dur) = item.duration {
                    if (dur - duration).abs() < 3.0 {
                        let details_url = format!("https://lrclib.net/api/get/{}", item.id);
                        let details_resp = client
                            .get(&details_url)
                            .send()
                            .await
                            .map_err(|e| e.to_string())?;

                        if details_resp.status().is_success() {
                            let details: LrcLibResponse =
                                details_resp.json().await.map_err(|e| e.to_string())?;
                            return Ok(Some(details));
                        }
                    }
                }
            }
        }

        Ok(None)
    }
}
