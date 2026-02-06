//! Typed errors for the recommendation system.
//!
//! Uses `thiserror` for ergonomic error definitions and implements
//! `Serialize` so errors can cross the Tauri IPC boundary cleanly.

use serde::Serialize;
use thiserror::Error;

/// Errors that can occur during recommendation generation.
#[derive(Debug, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum RecommendationError {
    /// Spotify API call failed (radio lookup, playlist fetch, etc.)
    #[error("Spotify API error: {0}")]
    SpotifyApi(String),

    /// No radio playlist was found for the given artist
    #[error("No radio playlist found for '{0}'")]
    NoRadioPlaylist(String),

    /// All provider searches failed or returned no results
    #[error("Provider search error: {0}")]
    ProviderSearch(String),

    /// No listening history available to seed recommendations
    #[error("No listening history available for recommendations")]
    NoListeningHistory,

    /// No recommendations could be generated for any of the given artists
    #[error("No recommendations found for the given artists")]
    NoResults,

    /// Database query failed
    #[error("Database error: {0}")]
    Database(String),

    /// Internal/unexpected error
    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<sqlx::Error> for RecommendationError {
    fn from(e: sqlx::Error) -> Self {
        RecommendationError::Database(e.to_string())
    }
}
