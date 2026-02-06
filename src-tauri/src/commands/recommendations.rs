//! Tauri commands for the recommendation engine.

use crate::history::PlayHistoryManager;
use crate::recommendations::errors::RecommendationError;
use crate::recommendations::{RecommendationEngine, RecommendationSection};
use tauri::State;

/// Get music recommendations based on listening history or provided artists.
///
/// If no artists are provided, uses the top 5 artists from play history.
#[tauri::command]
pub async fn get_recommendations(
    engine: State<'_, RecommendationEngine>,
    history: State<'_, PlayHistoryManager>,
    artists: Option<Vec<String>>,
    limit: Option<usize>,
) -> Result<Vec<RecommendationSection>, RecommendationError> {
    let limit = limit.unwrap_or(5);

    // Get artists from input or history
    let artist_names: Vec<String> = if let Some(provided) = artists {
        provided.into_iter().take(limit).collect()
    } else {
        // Get top artists from listening history
        let top = history
            .get_top_artists(limit as i64)
            .await
            .map_err(|e| RecommendationError::Database(e.to_string()))?;

        if top.is_empty() {
            return Err(RecommendationError::NoListeningHistory);
        }

        top.into_iter().map(|(_, name, _)| name).collect()
    };

    log::info!(
        "Generating recommendations for {} artists: {:?}",
        artist_names.len(),
        artist_names
    );

    let sections = engine.generate_for_artists(&artist_names).await?;

    if sections.is_empty() {
        return Err(RecommendationError::NoResults);
    }

    Ok(sections)
}

/// Get recommendations for a specific artist.
#[tauri::command]
pub async fn get_artist_recommendations(
    engine: State<'_, RecommendationEngine>,
    artist_name: String,
) -> Result<RecommendationSection, RecommendationError> {
    log::info!("Generating recommendations for artist: {}", artist_name);
    engine.generate_for_artist(&artist_name).await
}

/// Get top artists from listening history (for frontend to show available seeds).
#[tauri::command]
pub async fn get_top_artists(
    history: State<'_, PlayHistoryManager>,
    limit: Option<i64>,
) -> Result<Vec<TopArtistInfo>, RecommendationError> {
    let limit = limit.unwrap_or(10);
    let artists = history
        .get_top_artists(limit)
        .await
        .map_err(RecommendationError::Database)?;

    Ok(artists
        .into_iter()
        .map(|(id, name, play_count)| TopArtistInfo {
            id,
            name,
            play_count,
        })
        .collect())
}

#[derive(serde::Serialize)]
pub struct TopArtistInfo {
    pub id: String,
    pub name: String,
    pub play_count: i64,
}
