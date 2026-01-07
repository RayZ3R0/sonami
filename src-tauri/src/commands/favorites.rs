use crate::favorites::FavoritesManager;
use crate::library::models::UnifiedTrack;
use tauri::{command, State};

#[command]
pub async fn add_favorite(
    manager: State<'_, FavoritesManager>,
    track_id: String,
) -> Result<(), String> {
    manager.add_favorite(&track_id).await
}

#[command]
pub async fn remove_favorite(
    manager: State<'_, FavoritesManager>,
    track_id: String,
) -> Result<(), String> {
    manager.remove_favorite(&track_id).await
}

#[command]
pub async fn is_favorited(
    manager: State<'_, FavoritesManager>,
    track_id: String,
) -> Result<bool, String> {
    manager.is_favorited(&track_id).await
}

#[command]
pub async fn get_favorites(
    manager: State<'_, FavoritesManager>,
) -> Result<Vec<UnifiedTrack>, String> {
    manager.get_favorites_with_tracks().await
}
