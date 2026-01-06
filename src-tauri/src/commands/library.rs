use crate::library::models::UnifiedTrack;
use crate::library::LibraryManager;
use crate::tidal::models::Track as TidalTrack;
use tauri::{command, State};

#[command]
pub async fn get_library_tracks(
    library: State<'_, LibraryManager>,
) -> Result<Vec<UnifiedTrack>, String> {
    library.get_all_tracks().await
}

#[command]
pub async fn add_tidal_track(
    library: State<'_, LibraryManager>,
    track: TidalTrack,
    cover_url: Option<String>,
) -> Result<(), String> {
    library.import_tidal_track(&track, cover_url).await
}
