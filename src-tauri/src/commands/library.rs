use crate::library::models::UnifiedTrack;
use crate::library::LibraryManager;
use crate::tidal::models::Track as TidalTrack;
use sqlx::Acquire;
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
    library.import_tidal_track(&track, cover_url).await.map(|_| ())
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
pub async fn search_library_full(
    library: State<'_, LibraryManager>,
    query: String,
) -> Result<crate::library::models::LocalSearchResults, String> {
    library.search_full(&query).await
}

#[command]
pub async fn rebuild_search_index(library: State<'_, LibraryManager>) -> Result<(), String> {
    library.rebuild_index().await
}

#[command]
pub async fn factory_reset(library: State<'_, LibraryManager>) -> Result<(), String> {
    // We delegate the reset logic to the LibraryManager which owns the DB pool
    let pool = &library.pool;

    let tables = [
        "tracks",
        "albums",
        "artists",
        "playlists",
        "playlist_tracks",
        "play_history",
        "user_favorites",
        "lyrics_cache",
        "provider_configs",
    ];

    // Acquire a connection from the pool to ensure we stay on the same connection
    // for the PRAGMA statements and the transaction.
    let mut conn = pool
        .acquire()
        .await
        .map_err(|e| format!("Failed to acquire connection: {}", e))?;

    // Disable Foreign Keys BEFORE starting the transaction (required by SQLite)
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&mut *conn)
        .await
        .map_err(|e| format!("Failed to disable foreign keys: {}", e))?;

    // Now start the transaction for the actual deletions
    let mut tx = conn
        .begin()
        .await
        .map_err(|e| format!("Failed to start transaction: {}", e))?;

    for table in tables {
        let query = format!("DELETE FROM {}", table);
        sqlx::query(&query)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Failed to truncate table {}: {}", table, e))?;
    }

    tx.commit()
        .await
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;

    // Re-enable Foreign Keys
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&mut *conn)
        .await
        .map_err(|e| format!("Failed to re-enable foreign keys: {}", e))?;

    // Vacuum to reclaim space
    sqlx::query("VACUUM")
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to vacuum database: {}", e))?;

    Ok(())
}

#[command]
pub async fn library_has_data(library: State<'_, LibraryManager>) -> Result<bool, String> {
    let pool = &library.pool;

    // Check if we have any tracks
    let tracks_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tracks")
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Failed to count tracks: {}", e))?;

    if tracks_count.0 > 0 {
        return Ok(true);
    }

    // Check if we have any configured providers (other than Tidal which might be default)
    let providers_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM provider_configs WHERE provider_id != 'tidal'")
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Failed to count providers: {}", e))?;

    if providers_count.0 > 0 {
        return Ok(true);
    }

    Ok(false)
}
