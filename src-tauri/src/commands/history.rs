use crate::history::PlayHistoryManager;
use crate::library::models::UnifiedTrack;
use tauri::{command, State};

#[command]
pub async fn record_play(
    manager: State<'_, PlayHistoryManager>,
    track_id: String,
    context_uri: Option<String>,
    context_type: Option<String>,
) -> Result<String, String> {
    manager
        .record_play(&track_id, context_uri, context_type)
        .await
}

#[command]
pub async fn update_play_completion(
    manager: State<'_, PlayHistoryManager>,
    entry_id: String,
    duration_played: i64,
    completed: bool,
) -> Result<(), String> {
    manager
        .update_play_completion(&entry_id, duration_played, completed)
        .await
}

#[command]
pub async fn get_recently_played(
    manager: State<'_, PlayHistoryManager>,
    limit: Option<i64>,
) -> Result<Vec<UnifiedTrack>, String> {
    manager.get_unique_recent_tracks(limit.unwrap_or(50)).await
}

#[command]
pub async fn get_most_played(
    manager: State<'_, PlayHistoryManager>,
    limit: Option<i64>,
) -> Result<Vec<UnifiedTrack>, String> {
    manager.get_most_played_tracks(limit.unwrap_or(50)).await
}

#[command]
pub async fn get_play_count(
    manager: State<'_, PlayHistoryManager>,
    track_id: String,
) -> Result<i64, String> {
    manager.get_play_count(&track_id).await
}
