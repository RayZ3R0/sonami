use super::models::{SpotifyError, SpotifyPlaylistResult, SpotifyTrack};
use spotapi::PublicPlaylist;

#[derive(Clone)]
pub struct SpotifyClient;

impl SpotifyClient {
    pub fn new() -> Result<Self, SpotifyError> {
        Ok(Self)
    }

    /// Extract playlist ID from various Spotify URL formats
    pub fn extract_playlist_id(url_or_id: &str) -> Result<String, SpotifyError> {
        let trimmed = url_or_id.trim();

        if trimmed.starts_with("spotify:playlist:") {
            return Ok(trimmed.replace("spotify:playlist:", ""));
        }

        if trimmed.contains("open.spotify.com/playlist/") {
            if let Some(id_part) = trimmed.split("/playlist/").nth(1) {
                let id = id_part.split('?').next().unwrap_or(id_part);
                return Ok(id.to_string());
            }
        }

        if trimmed.contains("spotify.link/") {
            return Err(SpotifyError::InvalidUrl(
                "Share links are not supported. Please use the full playlist URL.".to_string(),
            ));
        }

        if trimmed.len() == 22 && trimmed.chars().all(|c| c.is_alphanumeric()) {
            return Ok(trimmed.to_string());
        }

        Err(SpotifyError::InvalidUrl(format!(
            "Could not extract playlist ID from: {}",
            url_or_id
        )))
    }

    pub async fn fetch_playlist(
        &self,
        playlist_id: &str,
    ) -> Result<SpotifyPlaylistResult, SpotifyError> {
        log::info!("Fetching Spotify playlist via spotapi: {}", playlist_id);

        let playlist_url = format!("https://open.spotify.com/playlist/{}", playlist_id);

        let mut playlist = PublicPlaylist::new(&playlist_url);

        let tracks = playlist
            .get_tracks()
            .await
            .map_err(|e| SpotifyError::ApiError(format!("Failed to fetch playlist: {}", e)))?;

        let track_count = tracks.len();

        log::info!("Successfully fetched {} tracks from playlist", track_count);

        if let Some(first_track) = tracks.first() {
            log::debug!(
                "First track JSON structure: {}",
                serde_json::to_string_pretty(first_track).unwrap_or_default()
            );
        }

        // Parse tracks into our format
        let spotify_tracks: Vec<SpotifyTrack> = tracks
            .into_iter()
            .filter_map(|track_data| Self::parse_track(&track_data))
            .collect();

        log::info!(
            "Parsed {} tracks into SpotifyTrack format",
            spotify_tracks.len()
        );

        // We use placeholders here since the user can edit them in the import modal
        let name = "Imported Playlist".to_string();

        let description = String::new();

        // Create playlist info
        let info = super::models::SpotifyPlaylistInfo {
            name,
            description: Some(description),
            image_url: None,
            track_count: spotify_tracks.len(),
        };

        Ok(SpotifyPlaylistResult {
            info,
            tracks: spotify_tracks,
        })
    }

    fn parse_track(track: &serde_json::Value) -> Option<SpotifyTrack> {
        let data = track.get("itemV2")?.get("data")?;

        let title = data.get("name").and_then(|v| v.as_str())?.to_string();

        let artists_items = data.get("artists")?.get("items")?.as_array()?;
        let artist = artists_items
            .iter()
            .filter_map(|a| a.get("profile")?.get("name")?.as_str())
            .collect::<Vec<_>>()
            .join(", ");

        let album = data
            .get("albumOfTrack")
            .and_then(|a| a.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let duration_ms = data
            .get("trackDuration")
            .and_then(|d| d.get("totalMilliseconds"))
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u32;

        let isrc = String::new();

        Some(SpotifyTrack {
            title,
            artist,
            album,
            duration_ms,
            isrc,
        })
    }
}
