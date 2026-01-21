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

/// A track that has been verified against available music providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifiedSpotifyTrack {
    /// Original Spotify track data
    pub spotify: SpotifyTrack,
    /// Whether the track was found on any provider
    pub found: bool,

    // Provider-agnostic identification
    /// Which provider matched this track (e.g., "tidal", "subsonic", "jellyfin")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
    /// Provider-specific track ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub external_id: Option<String>,
    /// Provider-specific artist ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist_id: Option<String>,
    /// Provider-specific album ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub album_id: Option<String>,
    /// Album title from the matched provider
    #[serde(skip_serializing_if = "Option::is_none")]
    pub album_name: Option<String>,
    /// Cover art URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,

    /// Was romanization used to find this track?
    pub used_romanization: bool,
    /// Verification status message (e.g., "Found on Tidal", "Found on Subsonic")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_message: Option<String>,

    // Legacy fields for backward compatibility during transition
    // TODO: Remove these after frontend migration is complete
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tidal_id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tidal_artist_id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tidal_album_id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tidal_album: Option<String>,
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
