use serde::{Deserialize, Serialize};

/// Represents a track from a Spotify playlist
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyTrack {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u32,
    #[serde(default)]
    pub isrc: String,
}

/// Represents a Spotify playlist with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyPlaylistInfo {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    pub track_count: usize,
}

/// Result from fetching a Spotify playlist
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyPlaylistResult {
    pub info: SpotifyPlaylistInfo,
    pub tracks: Vec<SpotifyTrack>,
}

/// A track that has been verified against Tidal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifiedSpotifyTrack {
    /// Original Spotify track data
    pub spotify: SpotifyTrack,
    /// Whether the track was found on Tidal
    pub found: bool,
    /// Tidal track ID if found
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tidal_id: Option<u64>,
    /// Tidal artist ID if found
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tidal_artist_id: Option<u64>,
    /// Tidal album ID if found
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tidal_album_id: Option<u64>,
    /// Album title from Tidal (may differ from Spotify)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tidal_album: Option<String>,
    /// Cover art URL from Tidal
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,
    /// Was romanization used to find this track?
    pub used_romanization: bool,
    /// Verification status message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_message: Option<String>,
}

/// Verification progress update sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationProgress {
    pub current: usize,
    pub total: usize,
    pub current_track: String,
    pub found_count: usize,
}

/// Error types for Spotify operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SpotifyError {
    InvalidUrl(String),
    NetworkError(String),
    ParseError(String),
    ApiError(String),
    PlaylistNotFound(String),
    RateLimited,
}

impl std::fmt::Display for SpotifyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SpotifyError::InvalidUrl(msg) => write!(f, "Invalid URL: {}", msg),
            SpotifyError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            SpotifyError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            SpotifyError::ApiError(msg) => write!(f, "API error: {}", msg),
            SpotifyError::PlaylistNotFound(msg) => write!(f, "Playlist not found: {}", msg),
            SpotifyError::RateLimited => write!(f, "Rate limited by Spotify"),
        }
    }
}

impl std::error::Error for SpotifyError {}
