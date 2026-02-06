//! Data types for the recommendation system.

use serde::{Deserialize, Serialize};

/// A track recommended from Spotify, with optional local provider match.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendedTrack {
    /// Track title from Spotify
    pub title: String,
    /// Artist name(s) from Spotify
    pub artist: String,
    /// Album name (if available)
    pub album: Option<String>,
    /// Duration in milliseconds
    pub duration_ms: u32,
    /// Cover art URL from Spotify
    pub cover_url: Option<String>,
    /// Spotify URI (e.g., "spotify:track:...")
    pub spotify_uri: String,

    // === Local provider match (filled by provider resolution) ===
    /// If matched, the provider ID (e.g., "tidal", "subsonic")
    pub matched_provider_id: Option<String>,
    /// If matched, the external ID on that provider
    pub matched_external_id: Option<String>,
    /// If matched, the local track ID in our database
    pub matched_local_id: Option<String>,
    /// If matched, the artist ID on that provider
    pub matched_artist_id: Option<String>,
    /// If matched, the album ID on that provider
    pub matched_album_id: Option<String>,
}

impl RecommendedTrack {
    /// Whether this track can be played (has a local provider match)
    pub fn is_playable(&self) -> bool {
        self.matched_provider_id.is_some()
    }
}

/// A section of recommendations (e.g., "Because you listened to Daft Punk")
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationSection {
    /// Section title (e.g., "Daft Punk Radio")
    pub title: String,
    /// Description or context
    pub description: String,
    /// The source artist that seeded this section
    pub seed_artist: String,
    /// Spotify playlist URI that was used
    pub source_playlist_uri: Option<String>,
    /// Recommended tracks
    pub tracks: Vec<RecommendedTrack>,
}

impl RecommendationSection {
    /// Count of tracks that can be played locally
    pub fn playable_count(&self) -> usize {
        self.tracks.iter().filter(|t| t.is_playable()).count()
    }
}
