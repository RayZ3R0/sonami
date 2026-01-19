use crate::favorites::FavoritesManager;
use crate::library::models::UnifiedTrack;
use tauri::{command, State};

#[command]
pub async fn add_favorite(
    manager: State<'_, FavoritesManager>,
    library: State<'_, crate::library::LibraryManager>,
    track: UnifiedTrack,
) -> Result<(), String> {
    let track_id = if let (Some(provider_id), Some(external_id)) = (&track.provider_id, &track.external_id) {
        let import_track = crate::models::Track {
            id: external_id.clone(),
            title: track.title.clone(),
            artist: track.artist.clone(),
            artist_id: None,
            album: track.album.clone(),
            album_id: None,
            duration: track.duration,
            cover_url: track.cover_image.clone(),
        };
        library
            .import_external_track(&import_track, provider_id)
            .await
            .map_err(|e| e.to_string())?
    } else {
        track.id.clone()
    };

    manager.add_favorite(&track_id).await
}

#[command]
pub async fn remove_favorite(
    manager: State<'_, FavoritesManager>,
    library: State<'_, crate::library::LibraryManager>,
    track: UnifiedTrack,
) -> Result<(), String> {
    let id_to_remove =
        if let (Some(provider_id), Some(external_id)) = (&track.provider_id, &track.external_id) {
            match library
                .find_external_track(provider_id, external_id)
                .await
            {
                Ok(Some(id)) => id,
                _ => track.id.clone(),
            }
        } else {
            track.id.clone()
        };
    manager.remove_favorite(&id_to_remove).await
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
