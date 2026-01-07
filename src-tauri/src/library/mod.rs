pub mod models;

use models::{LibraryAlbum, LibraryArtist, TrackSource, UnifiedTrack};
use sqlx::{Pool, Row, Sqlite};
use uuid::Uuid;

pub struct LibraryManager {
    pool: Pool<Sqlite>,
}

impl LibraryManager {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    pub async fn get_all_albums(&self) -> Result<Vec<LibraryAlbum>, String> {
        let result = sqlx::query_as::<_, LibraryAlbum>(
            r#"
            SELECT 
                al.id, al.title, a.name as artist, al.cover_url as cover_image, al.tidal_id
            FROM albums al
            JOIN artists a ON al.artist_id = a.id
            ORDER BY al.title ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            log::error!("Failed to fetch albums: {}", e);
            e.to_string()
        })?;
        
        log::info!("Fetched {} albums", result.len());
        Ok(result)
    }

    pub async fn get_all_artists(&self) -> Result<Vec<LibraryArtist>, String> {
        let result = sqlx::query_as::<_, LibraryArtist>(
            r#"
            SELECT id, name, cover_url as cover_image, tidal_id
            FROM artists
            ORDER BY name ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            log::error!("Failed to fetch artists: {}", e);
            e.to_string()
        })?;

        log::info!("Fetched {} artists", result.len());
        Ok(result)
    }

    pub async fn rebuild_index(&self) -> Result<(), String> {
        log::info!("Rebuilding search index...");
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;

        // Clear index
        sqlx::query("DELETE FROM search_index").execute(&mut *tx).await.map_err(|e| e.to_string())?;

        // Re-populate
        let rows = sqlx::query(
            r#"
            SELECT t.id, t.title, a.name as artist, al.title as album
            FROM tracks t
            JOIN artists a ON t.artist_id = a.id
            LEFT JOIN albums al ON t.album_id = al.id
            "#
        ).fetch_all(&mut *tx).await.map_err(|e| e.to_string())?;

        for row in &rows {
            let id: String = row.try_get("id").unwrap_or_default();
            let title: String = row.try_get("title").unwrap_or_default();
            let artist: String = row.try_get("artist").unwrap_or_default();
            let album: String = row.try_get("album").unwrap_or_default();

            sqlx::query("INSERT INTO search_index (track_id, title, artist, album) VALUES (?, ?, ?, ?)")
                .bind(id)
                .bind(title)
                .bind(artist)
                .bind(album)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
        }

        tx.commit().await.map_err(|e| e.to_string())?;
        log::info!("Search index rebuilt successfully with {} items", rows.len());
        Ok(())
    }

    pub async fn search_library(&self, query: &str) -> Result<Vec<UnifiedTrack>, String> {
        log::info!("Searching library for: '{}'", query);
        
        // Check if search_index is in sync with tracks table
        let index_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM search_index")
            .fetch_one(&self.pool)
            .await
            .unwrap_or((0,));
        
        let tracks_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tracks")
            .fetch_one(&self.pool)
            .await
            .unwrap_or((0,));
        
        log::info!("search_index: {} entries, tracks table: {} entries", index_count.0, tracks_count.0);
        
        // If index is out of sync, rebuild it
        if index_count.0 != tracks_count.0 {
            log::warn!("search_index out of sync! Rebuilding...");
            if let Err(e) = self.rebuild_index().await {
                log::error!("Failed to rebuild index: {}", e);
            } else {
                log::info!("Index rebuilt successfully");
            }
        }
        
        // Build FTS5 query: each word gets a prefix wildcard, joined with spaces (implicit AND)
        // Example: "bot bakka" -> "bot* bakka*"
        let fts_query = query
            .split_whitespace()
            .map(|word| {
                // Keep only alphanumeric chars for each word
                let clean: String = word.chars().filter(|c| c.is_alphanumeric()).collect();
                format!("{}*", clean)
            })
            .filter(|w| w.len() > 1) // Skip empty or single-char wildcards
            .collect::<Vec<_>>()
            .join(" ");
        
        if fts_query.is_empty() {
            log::info!("Query is empty after sanitization");
            return Ok(Vec::new());
        }
        
        log::info!("FTS5 query: {}", fts_query);

        let rows = sqlx::query(
            r#"
            SELECT 
                t.id, t.title, t.duration, t.source_type, t.file_path, t.tidal_id,
                a.name as artist_name,
                al.title as album_title, al.cover_url
            FROM search_index si
            JOIN tracks t ON t.id = si.track_id
            JOIN artists a ON t.artist_id = a.id
            LEFT JOIN albums al ON t.album_id = al.id
            WHERE search_index MATCH ?
            ORDER BY rank
            LIMIT 50
            "#,
        )
        .bind(&fts_query)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            log::error!("FTS5 Search failed: {}", e);
            e.to_string()
        })?;
        
        log::info!("Found {} search results", rows.len());

        let mut tracks = Vec::new();
        for row in rows {
            let duration: i64 = row.try_get("duration").unwrap_or(0);
            let tidal_id: Option<i64> = row.try_get("tidal_id").ok();
            let source = TrackSource::from(
                row.try_get::<String, _>("source_type")
                    .unwrap_or_else(|_| "LOCAL".to_string()),
            );
            let local_path: Option<String> = row.try_get("file_path").ok();

            let path = match source {
                TrackSource::Tidal => format!("tidal:{}", tidal_id.unwrap_or(0)),
                TrackSource::Local => local_path.clone().unwrap_or_default(),
            };

            tracks.push(UnifiedTrack {
                id: row.try_get("id").unwrap_or_default(),
                title: row.try_get("title").unwrap_or_default(),
                artist: row.try_get("artist_name").unwrap_or_default(),
                album: row.try_get("album_title").unwrap_or_default(),
                duration: duration as u64,
                source,
                cover_image: row.try_get("cover_url").ok(),
                path,
                local_path,
                tidal_id: tidal_id.map(|id| id as u64),
            });
        }

        Ok(tracks)
    }

    pub async fn get_all_tracks(&self) -> Result<Vec<UnifiedTrack>, String> {
        let rows = sqlx::query(
            r#"
            SELECT 
                t.id, t.title, t.duration, t.source_type, t.file_path, t.tidal_id,
                a.name as artist_name,
                al.title as album_title, al.cover_url
            FROM tracks t
            JOIN artists a ON t.artist_id = a.id
            LEFT JOIN albums al ON t.album_id = al.id
            ORDER BY t.title ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let mut tracks = Vec::new();
        for row in rows {
            let duration: i64 = row.try_get("duration").unwrap_or(0);
            let tidal_id: Option<i64> = row.try_get("tidal_id").ok();
            let source = TrackSource::from(
                row.try_get::<String, _>("source_type")
                    .unwrap_or_else(|_| "LOCAL".to_string()),
            );
            let local_path: Option<String> = row.try_get("file_path").ok();

            // Compute the compatible 'path' field for the frontend player
            let path = match source {
                TrackSource::Tidal => format!("tidal:{}", tidal_id.unwrap_or(0)),
                TrackSource::Local => local_path.clone().unwrap_or_default(),
            };

            tracks.push(UnifiedTrack {
                id: row.try_get("id").unwrap_or_default(),
                title: row.try_get("title").unwrap_or_default(),
                artist: row.try_get("artist_name").unwrap_or_default(),
                album: row.try_get("album_title").unwrap_or_default(),
                duration: duration as u64,
                source,
                cover_image: row.try_get("cover_url").ok(),
                path,
                local_path,
                tidal_id: tidal_id.map(|id| id as u64),
            });
        }

        Ok(tracks)
    }

    pub async fn import_tidal_track(
        &self,
        track: &crate::tidal::models::Track,
        cover_url: Option<String>,
    ) -> Result<(), String> {
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;

        // Extract Artist Name safely
        let artist_name = track
            .artist
            .as_ref()
            .map(|a| a.name.clone())
            .unwrap_or_else(|| "Unknown Artist".to_string());

        // 1. Check if Artist Exists
        let artist_id = if let Some(row) = sqlx::query("SELECT id FROM artists WHERE name = ?")
            .bind(&artist_name)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?
        {
            row.try_get::<String, _>("id").unwrap_or_default()
        } else {
            let new_id = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO artists (id, name, tidal_id) VALUES (?, ?, ?)")
                .bind(&new_id)
                .bind(&artist_name)
                .bind(0i64)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
            new_id
        };

        // 2. Check if Album Exists
        let mut album_id = None;
        let mut album_name = String::new();
        if let Some(album) = &track.album {
            let album_title = &album.title;
            album_name = album_title.clone();
            if !album_title.is_empty() {
                if let Some(row) =
                    sqlx::query("SELECT id FROM albums WHERE title = ? AND artist_id = ?")
                        .bind(album_title)
                        .bind(&artist_id)
                        .fetch_optional(&mut *tx)
                        .await
                        .map_err(|e| e.to_string())?
                {
                    album_id = Some(row.try_get::<String, _>("id").unwrap_or_default());
                } else {
                    let new_id = Uuid::new_v4().to_string();
                    sqlx::query(
                        "INSERT INTO albums (id, title, artist_id, cover_url) VALUES (?, ?, ?, ?)",
                    )
                    .bind(&new_id)
                    .bind(album_title)
                    .bind(&artist_id)
                    .bind(&cover_url)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| e.to_string())?;
                    album_id = Some(new_id);
                }
            }
        }

        // 3. Insert Track
        let tidal_id_i64 = track.id as i64;

        // Check existing
        let exists = sqlx::query("SELECT id FROM tracks WHERE tidal_id = ?")
            .bind(tidal_id_i64)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        let track_id = if let Some(row) = exists {
             row.try_get::<String, _>("id").unwrap_or_default()
        } else {
            let new_id = Uuid::new_v4().to_string();
            let duration = track.duration.unwrap_or(0) as i64;

            sqlx::query(
                r#"
                INSERT INTO tracks (id, title, artist_id, album_id, duration, source_type, tidal_id)
                VALUES (?, ?, ?, ?, ?, 'TIDAL', ?)
                "#,
            )
            .bind(&new_id)
            .bind(&track.title)
            .bind(&artist_id)
            .bind(&album_id)
            .bind(duration)
            .bind(tidal_id_i64)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

            new_id
        };

        // 4. Update Search Index
        // Try to delete existing entry first to avoid dupes if re-importing (though ID is random UUID for new...)
        // Actually since we check for existence, we only reach here if new, OR if we want to support updates?
        // Let's just insert OR REPLACE into search index if possible,
        // but FTS5 doesn't support ON CONFLICT the same way always.
        // We'll just do a delete then insert for safety if we had the track ID.
        sqlx::query("DELETE FROM search_index WHERE track_id = ?")
            .bind(&track_id)
            .execute(&mut *tx)
            .await
            .ok();

        sqlx::query("INSERT INTO search_index (track_id, title, artist, album) VALUES (?, ?, ?, ?)")
            .bind(&track_id)
            .bind(&track.title)
            .bind(&artist_name)
            .bind(&album_name)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(())
    }
}
