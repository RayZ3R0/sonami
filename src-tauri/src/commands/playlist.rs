use crate::library::LibraryManager;
use crate::playlist::manager::PlaylistManager;
use crate::playlist::models::{Playlist, PlaylistDetails};
use crate::tidal::models::Track as TidalTrack;
use tauri::{command, State};

#[command]
pub async fn get_playlists(manager: State<'_, PlaylistManager>) -> Result<Vec<Playlist>, String> {
    manager.get_playlists().await
}

#[command]
pub async fn create_playlist(
    manager: State<'_, PlaylistManager>,
    name: String,
    description: Option<String>,
) -> Result<Playlist, String> {
    manager.create_playlist(name, description).await
}

#[command]
pub async fn delete_playlist(
    manager: State<'_, PlaylistManager>,
    id: String,
) -> Result<(), String> {
    manager.delete_playlist(&id).await
}

#[command]
pub async fn get_playlist_details(
    manager: State<'_, PlaylistManager>,
    id: String,
) -> Result<PlaylistDetails, String> {
    manager.get_playlist_details(&id).await
}

#[command]
pub async fn add_tidal_track_to_playlist(
    library: State<'_, LibraryManager>,
    playlist: State<'_, PlaylistManager>,
    playlist_id: String,
    track: TidalTrack,
    cover_url: Option<String>,
) -> Result<(), String> {
    // 1. Ensure track is in library
    library.import_tidal_track(&track, cover_url).await?;

    // 2. Get local Track ID
    // We can assume import worked, checking ID via tidal_id lookup
    let track_id_opt = playlist.find_track_id_by_tidal_id(track.id).await?;

    if let Some(track_id) = track_id_opt {
        playlist.add_track_entry(&playlist_id, &track_id).await?;
        Ok(())
    } else {
        Err("Failed to verify track import".to_string())
    }
}
