use crate::client::SpotApiClient;
use anyhow::{anyhow, Result};
use serde_json::Value;

pub struct PublicPlaylist {
    client: SpotApiClient,
    playlist_id: String,
}

impl PublicPlaylist {
    pub fn new(playlist_uri: &str) -> Self {
        let playlist_id = if let Some(idx) = playlist_uri.find("playlist/") {
            playlist_uri[idx + "playlist/".len()..].to_string()
        } else {
            playlist_uri.to_string()
        };

        let playlist_id = if let Some(idx) = playlist_id.find('?') {
            playlist_id[..idx].to_string()
        } else {
            playlist_id
        };

        Self {
            client: SpotApiClient::new(),
            playlist_id,
        }
    }

    pub async fn get_playlist_info(&mut self, limit: u32, offset: u32) -> Result<Value> {
        let variables = serde_json::json!({
            "uri": format!("spotify:playlist:{}", self.playlist_id),
            "offset": offset,
            "limit": limit,
            "enableWatchFeedEntrypoint": false
        });

        self.client.query("fetchPlaylist", variables).await
    }

    pub async fn get_tracks(&mut self) -> Result<Vec<Value>> {
        const CHUNK_SIZE: u32 = 343;

        let mut all_tracks = Vec::new();
        let mut response = self.get_playlist_info(CHUNK_SIZE, 0).await?;

        let content = response
            .get_mut("data")
            .and_then(|d| d.get_mut("playlistV2"))
            .and_then(|p| p.get_mut("content"))
            .ok_or_else(|| anyhow!("Invalid playlist response structure"))?;

        let total_count = content
            .get("totalCount")
            .and_then(|tc| tc.as_u64())
            .unwrap_or(0) as u32;

        if let Some(items) = content.get_mut("items").and_then(|i| i.as_array_mut()) {
            all_tracks.append(items);
        }

        if total_count <= CHUNK_SIZE {
            return Ok(all_tracks);
        }

        let mut offset = CHUNK_SIZE;
        while offset < total_count {
            let mut chunk_resp = self.get_playlist_info(CHUNK_SIZE, offset).await?;

            let items_opt = chunk_resp
                .get_mut("data")
                .and_then(|d| d.get_mut("playlistV2"))
                .and_then(|p| p.get_mut("content"))
                .and_then(|c| c.get_mut("items"))
                .and_then(|i| i.as_array_mut());

            if let Some(items) = items_opt {
                all_tracks.append(items);
            } else {
                break;
            }

            offset += CHUNK_SIZE;
        }

        Ok(all_tracks)
    }
}
