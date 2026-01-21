use crate::models::{Album, Artist, Quality, SearchResults, StreamInfo, Track};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;

#[async_trait]
pub trait MusicProvider: Send + Sync {
    /// Unique identifier (e.g., "tidal", "subsonic", "jellyfin")
    fn id(&self) -> &str;

    /// User-friendly name
    fn name(&self) -> &str;

    /// Initialize with config
    async fn initialize(&mut self, config: Value) -> Result<()>;

    /// Search capabilities
    async fn search(&self, query: &str) -> Result<SearchResults>;

    /// Playback
    async fn get_stream_url(&self, track_id: &str, quality: Quality) -> Result<StreamInfo>;

    /// Metadata
    async fn get_track_details(&self, track_id: &str) -> Result<Track>;
    async fn get_artist_details(&self, artist_id: &str) -> Result<Artist>;
    async fn get_album_details(&self, album_id: &str) -> Result<Album>;
    async fn get_artist_top_tracks(&self, artist_id: &str) -> Result<Vec<Track>>;
    async fn get_artist_albums(&self, artist_id: &str) -> Result<Vec<Album>>;
    async fn get_album_tracks(&self, _album_id: &str) -> Result<Vec<Track>> {
        // Default implementation for providers that might return tracks in get_album_details?
        // Actually, it's better to force implementation. Be we can provide a default that returns empty? No.
        // Let's make it required.
        Err(anyhow::anyhow!("Not implemented"))
    }
}

#[async_trait]
pub trait LyricsProvider: Send + Sync {
    fn id(&self) -> &str;
    // We'll define the lyrics result struct/logic later or reuse the existing one
    // async fn get_lyrics(&self, track: &Track) -> Result<Option<LyricsResult>>;
}
