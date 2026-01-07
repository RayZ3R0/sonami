use crate::library::LibraryManager;
use crate::library::models::UnifiedTrack;
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



#[command]
pub async fn remove_from_playlist(
    manager: State<'_, PlaylistManager>,
    playlist_id: String,
    track_id: String,
) -> Result<(), String> {
    manager.remove_track_entry(&playlist_id, &track_id).await
}

#[command]
pub async fn add_to_playlist(
    library: State<'_, LibraryManager>,
    playlist: State<'_, PlaylistManager>,
    playlist_id: String,
    track: UnifiedTrack,
) -> Result<(), String> {
    // 1. Try to add direct if it's already a valid DB ID
    if playlist.add_track_entry(&playlist_id, &track.id).await.is_ok() {
        return Ok(());
    }

    // 2. If valid DB ID failed (FK error), and it's Tidal, we might need to import
    if let Some(tidal_id) = track.tidal_id {
        // Check if we already have it by tidal_id (maybe partial sync or race)
        if let Ok(Some(existing_id)) = playlist.find_track_id_by_tidal_id(tidal_id).await {
            playlist.add_track_entry(&playlist_id, &existing_id).await?;
            return Ok(());
        }

        // 3. Import from Tidal
        // Reconstruct basic TidalTrack
         let tidal_track = TidalTrack {
            id: tidal_id,
            title: track.title.clone(),
            artist: Some(crate::tidal::models::Artist {
                id: 0, 
                name: track.artist.clone(),
                picture: None,
            }),
            album: Some(crate::tidal::models::Album {
                id: 0,
                title: track.album.clone(),
                cover: None,
                artist: None,
                number_of_tracks: None,
            }),
            duration: Some(track.duration as u32),
            audio_quality: None,
            cover: None,
            track_number: None,
        };

        library.import_tidal_track(&tidal_track, track.cover_image.clone()).await?;

        // 4. Get new ID and add
        if let Ok(Some(new_id)) = playlist.find_track_id_by_tidal_id(tidal_id).await {
            playlist.add_track_entry(&playlist_id, &new_id).await?;
            return Ok(());
        }
    }

    // If source is local and first attempt failed, it means local track is gone?
    // Or weird state.
    
    Err("Failed to add track to playlist".to_string())
}

#[command]
pub async fn get_playlists_containing_track(
    manager: State<'_, PlaylistManager>,
    track_id: String,
) -> Result<Vec<String>, String> {
    manager.get_playlists_containing_track(&track_id).await
}
