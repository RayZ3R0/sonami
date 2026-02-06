use crate::library::models::UnifiedTrack;
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
pub async fn rename_playlist(
    manager: State<'_, PlaylistManager>,
    id: String,
    new_name: String,
) -> Result<(), String> {
    manager.rename_playlist(&id, &new_name).await
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
    library.import_tidal_track(&track, cover_url).await?;

    let track_id_opt = playlist
        .find_track_id_by_external_id("tidal", &track.id.to_string())
        .await?;

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
    log::info!("[add_to_playlist] === START ===");
    log::info!("[add_to_playlist] playlist_id={}", playlist_id);
    log::info!("[add_to_playlist] track.id={}", track.id);
    log::info!("[add_to_playlist] track.title={}", track.title);
    log::info!("[add_to_playlist] track.artist={}", track.artist);
    log::info!("[add_to_playlist] track.source={:?}", track.source);
    log::info!(
        "[add_to_playlist] track.provider_id={:?}",
        track.provider_id
    );
    log::info!(
        "[add_to_playlist] track.external_id={:?}",
        track.external_id
    );
    log::info!("[add_to_playlist] track.artist_id={:?}", track.artist_id);
    log::info!("[add_to_playlist] track.album_id={:?}", track.album_id);
    log::info!("[add_to_playlist] track.path={}", track.path);

    // 1. If we have provider info, look up (or import) by external_id — most reliable
    if let (Some(provider_id), Some(external_id)) = (&track.provider_id, &track.external_id) {
        log::info!(
            "[add_to_playlist] Branch: has provider_id={} external_id={}",
            provider_id,
            external_id
        );

        // Check if the track already exists in the DB by external_id
        match playlist
            .find_track_id_by_external_id(provider_id, external_id)
            .await
        {
            Ok(Some(db_id)) => {
                log::info!(
                    "[add_to_playlist] Found existing track in DB: db_id={}",
                    db_id
                );
                let result = playlist.add_track_entry(&playlist_id, &db_id).await;
                log::info!("[add_to_playlist] add_track_entry result: {:?}", result);
                return result;
            }
            Ok(None) => {
                log::info!("[add_to_playlist] Track not in DB, will import");
            }
            Err(e) => {
                log::error!(
                    "[add_to_playlist] find_track_id_by_external_id error: {}",
                    e
                );
            }
        }

        // Not in DB yet — import it first
        let import_track = crate::models::Track {
            id: external_id.clone(),
            title: track.title.clone(),
            artist: track.artist.clone(),
            artist_id: track.artist_id.clone(),
            album: track.album.clone(),
            album_id: track.album_id.clone(),
            duration: track.duration,
            cover_url: track.cover_image.clone(),
        };
        log::info!("[add_to_playlist] Importing external track...");

        match library
            .import_external_track(&import_track, provider_id)
            .await
        {
            Ok(new_id) => {
                log::info!("[add_to_playlist] Import success, new_id={}", new_id);
                let result = playlist.add_track_entry(&playlist_id, &new_id).await;
                log::info!("[add_to_playlist] add_track_entry result: {:?}", result);
                return result;
            }
            Err(e) => {
                log::error!("[add_to_playlist] import_external_track failed: {}", e);
                return Err(format!("Failed to import track: {}", e));
            }
        }
    }

    // 2. No provider info — try adding by track.id directly (local tracks already in DB)
    log::info!(
        "[add_to_playlist] Branch: no provider info, using track.id={}",
        track.id
    );
    let result = playlist
        .add_track_entry(&playlist_id, &track.id)
        .await
        .map_err(|e| {
            log::error!("[add_to_playlist] Direct add_track_entry failed: {}", e);
            format!("Failed to add track to playlist: {}", e)
        });
    log::info!("[add_to_playlist] === END result={:?} ===", result);
    result
}

#[command]
pub async fn get_playlists_containing_track(
    manager: State<'_, PlaylistManager>,
    track_id: String,
) -> Result<Vec<String>, String> {
    manager.get_playlists_containing_track(&track_id).await
}
