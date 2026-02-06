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

    /// Lightweight search returning only tracks (for recommendation matching).
    /// Default implementation falls back to full search.
    async fn search_tracks_only(&self, query: &str) -> Result<Vec<Track>> {
        Ok(self.search(query).await?.tracks)
    }

    /// Playback
    async fn get_stream_url(&self, track_id: &str, quality: Quality) -> Result<StreamInfo>;

    /// Metadata
    async fn get_track_details(&self, track_id: &str) -> Result<Track>;
    async fn get_artist_details(&self, artist_id: &str) -> Result<Artist>;
    async fn get_album_details(&self, album_id: &str) -> Result<Album>;
    async fn get_artist_top_tracks(&self, artist_id: &str) -> Result<Vec<Track>>;
    async fn get_artist_albums(&self, artist_id: &str) -> Result<Vec<Album>>;
    async fn get_album_tracks(&self, _album_id: &str) -> Result<Vec<Track>> {
        Err(anyhow::anyhow!("Not implemented"))
    }
}

#[async_trait]
pub trait LyricsProvider: Send + Sync {
    fn id(&self) -> &str;
}
