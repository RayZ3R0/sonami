//! Recommendation engine for music discovery.
//!
//! Uses Spotify's public API to find related music, then matches
//! against the user's configured providers (Tidal, Subsonic, Jellyfin).

pub mod cache;
pub mod engine;
pub mod errors;
pub mod types;

pub use engine::RecommendationEngine;
pub use errors::RecommendationError;
pub use types::{RecommendedTrack, RecommendationSection};
