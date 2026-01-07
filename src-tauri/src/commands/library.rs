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

#[command]
pub async fn get_library_albums(
    library: State<'_, LibraryManager>,
) -> Result<Vec<crate::library::models::LibraryAlbum>, String> {
    library.get_all_albums().await
}

#[command]
pub async fn get_library_artists(
    library: State<'_, LibraryManager>,
) -> Result<Vec<crate::library::models::LibraryArtist>, String> {
    library.get_all_artists().await
}

#[command]
pub async fn search_library(
    library: State<'_, LibraryManager>,
    query: String,
) -> Result<Vec<UnifiedTrack>, String> {
    library.search_library(&query).await
}

#[command]
pub async fn rebuild_search_index(library: State<'_, LibraryManager>) -> Result<(), String> {
    library.rebuild_index().await
}
