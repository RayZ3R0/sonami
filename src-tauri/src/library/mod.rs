pub mod models;

use crate::tidal::models::{get_cover_url, CoverSize};
use models::{LibraryAlbum, LibraryArtist, LocalSearchResults, TrackSource, UnifiedTrack};
use sqlx::{Pool, Row, Sqlite};
use uuid::Uuid;

pub struct LibraryManager {
    pub pool: Pool<Sqlite>,
}

impl LibraryManager {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    pub async fn get_all_albums(&self) -> Result<Vec<LibraryAlbum>, String> {
        let result = sqlx::query_as::<_, LibraryAlbum>(
            r#"
            SELECT 
                al.id, al.title, a.name as artist, al.cover_url as cover_image, al.provider_id, al.external_id
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
            SELECT id, name, cover_url as cover_image, provider_id, external_id
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

        sqlx::query("DELETE FROM search_index")
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        let rows = sqlx::query(
            r#"
            SELECT t.id, t.title, a.name as artist, al.title as album
            FROM tracks t
            JOIN artists a ON t.artist_id = a.id
            LEFT JOIN albums al ON t.album_id = al.id
            "#,
        )
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        for row in &rows {
            let id: String = row.try_get("id").unwrap_or_default();
            let title: String = row.try_get("title").unwrap_or_default();
            let artist: String = row.try_get("artist").unwrap_or_default();
            let album: String = row.try_get("album").unwrap_or_default();

            sqlx::query(
                "INSERT INTO search_index (track_id, title, artist, album) VALUES (?, ?, ?, ?)",
            )
            .bind(id)
            .bind(title)
            .bind(artist)
            .bind(album)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }

        tx.commit().await.map_err(|e| e.to_string())?;
        log::info!(
            "Search index rebuilt successfully with {} items",
            rows.len()
        );
        Ok(())
    }

    pub async fn search_library(&self, query: &str) -> Result<Vec<UnifiedTrack>, String> {
        log::info!("Searching library for: '{}'", query);

        let index_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM search_index")
            .fetch_one(&self.pool)
            .await
            .unwrap_or((0,));

        let tracks_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tracks")
            .fetch_one(&self.pool)
            .await
            .unwrap_or((0,));

        log::info!(
            "search_index: {} entries, tracks table: {} entries",
            index_count.0,
            tracks_count.0
        );

        if index_count.0 != tracks_count.0 {
            log::warn!("search_index out of sync! Rebuilding...");
            if let Err(e) = self.rebuild_index().await {
                log::error!("Failed to rebuild index: {}", e);
            } else {
                log::info!("Index rebuilt successfully");
            }
        }

        let fts_query = query
            .split_whitespace()
            .map(|word| {
                let clean: String = word.chars().filter(|c| c.is_alphanumeric()).collect();
                format!("{}*", clean)
            })
            .filter(|w| w.len() > 1)
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
                t.id, t.title, t.duration, t.source_type, t.file_path,
                t.play_count, t.skip_count, t.last_played_at, t.added_at, t.audio_quality,
                t.provider_id, t.external_id,
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
            let provider_id: Option<String> = row.try_get("provider_id").ok();
            let external_id: Option<String> = row.try_get("external_id").ok();
            let source = TrackSource::from(
                row.try_get::<String, _>("source_type")
                    .unwrap_or_else(|_| "LOCAL".to_string()),
            );
            let local_path: Option<String> = row.try_get("file_path").ok();

            let path = match source {
                TrackSource::Tidal => {
                    // Fallback to "tidal:external_id" format
                    let eid = external_id.clone().unwrap_or_else(|| "0".to_string());
                    format!("tidal:{}", eid)
                }
                TrackSource::Local => local_path.clone().unwrap_or_default(),
                _ => {
                    if let (Some(pid), Some(eid)) = (&provider_id, &external_id) {
                        format!("{}:{}", pid, eid)
                    } else {
                        String::new()
                    }
                }
            };

            // Analytics with defaults
            let play_count: i64 = row.try_get("play_count").unwrap_or(0);
            let skip_count: i64 = row.try_get("skip_count").unwrap_or(0);
            let last_played_at: Option<i64> = row.try_get("last_played_at").ok();
            let added_at: Option<i64> = row.try_get("added_at").ok();
            let audio_quality: Option<String> = row.try_get("audio_quality").ok();

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
                audio_quality,
                play_count: play_count as u64,
                skip_count: skip_count as u64,
                last_played_at,
                liked_at: None,
                added_at,
                provider_id,
                external_id,
            });
        }

        Ok(tracks)
    }

    pub async fn search_albums(&self, query: &str) -> Result<Vec<LibraryAlbum>, String> {
        if query.len() < 2 {
            return Ok(Vec::new());
        }

        let like_pattern = format!("%{}%", query);

        let albums = sqlx::query_as::<_, LibraryAlbum>(
            r#"
            SELECT 
                al.id, al.title, a.name as artist, al.cover_url as cover_image, 
                al.provider_id, al.external_id
            FROM albums al
            JOIN artists a ON al.artist_id = a.id
            WHERE al.title LIKE ? COLLATE NOCASE
            ORDER BY al.title ASC
            LIMIT 20
            "#,
        )
        .bind(&like_pattern)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            log::error!("Album search failed: {}", e);
            e.to_string()
        })?;

        log::info!("Found {} albums for query: '{}'", albums.len(), query);
        Ok(albums)
    }

    pub async fn search_artists(&self, query: &str) -> Result<Vec<LibraryArtist>, String> {
        if query.len() < 2 {
            return Ok(Vec::new());
        }

        let like_pattern = format!("%{}%", query);

        let artists = sqlx::query_as::<_, LibraryArtist>(
            r#"
            SELECT 
                id, name, cover_url as cover_image, provider_id, external_id
            FROM artists
            WHERE name LIKE ? COLLATE NOCASE
            ORDER BY name ASC
            LIMIT 20
            "#,
        )
        .bind(&like_pattern)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            log::error!("Artist search failed: {}", e);
            e.to_string()
        })?;

        log::info!("Found {} artists for query: '{}'", artists.len(), query);
        Ok(artists)
    }

    pub async fn search_full(&self, query: &str) -> Result<LocalSearchResults, String> {
        let (tracks, albums, artists) = tokio::join!(
            self.search_library(query),
            self.search_albums(query),
            self.search_artists(query)
        );

        Ok(LocalSearchResults {
            tracks: tracks.unwrap_or_default(),
            albums: albums.unwrap_or_default(),
            artists: artists.unwrap_or_default(),
        })
    }

    pub async fn get_all_tracks(&self) -> Result<Vec<UnifiedTrack>, String> {
        let rows = sqlx::query(
            r#"
            SELECT 
                t.id, t.title, t.duration, t.source_type, t.file_path,
                t.play_count, t.skip_count, t.last_played_at, t.added_at, t.audio_quality,
                t.provider_id, t.external_id,
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
            let provider_id: Option<String> = row.try_get("provider_id").ok();
            let external_id: Option<String> = row.try_get("external_id").ok();
            let source = TrackSource::from(
                row.try_get::<String, _>("source_type")
                    .unwrap_or_else(|_| "LOCAL".to_string()),
            );
            let local_path: Option<String> = row.try_get("file_path").ok();

            let path = match source {
                TrackSource::Tidal => {
                    let eid = external_id.clone().unwrap_or_else(|| "0".to_string());
                    format!("tidal:{}", eid)
                }
                TrackSource::Local => local_path.clone().unwrap_or_default(),
                _ => {
                    if let (Some(pid), Some(eid)) = (&provider_id, &external_id) {
                        format!("{}:{}", pid, eid)
                    } else {
                        String::new()
                    }
                }
            };

            // Analytics with defaults
            let play_count: i64 = row.try_get("play_count").unwrap_or(0);
            let skip_count: i64 = row.try_get("skip_count").unwrap_or(0);
            let last_played_at: Option<i64> = row.try_get("last_played_at").ok();
            let added_at: Option<i64> = row.try_get("added_at").ok();
            let audio_quality: Option<String> = row.try_get("audio_quality").ok();

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
                audio_quality,
                play_count: play_count as u64,
                skip_count: skip_count as u64,
                last_played_at,
                liked_at: None,
                added_at,
                provider_id,
                external_id,
            });
        }

        Ok(tracks)
    }

    pub async fn update_track_download_info(
        &self,
        track_id_numeric: u64,
        path: &str,
        quality: &str,
    ) -> Result<(), String> {
        let tid = track_id_numeric as i64;
        log::info!("Attempting to update Tidal download info for ID: {}", tid);

        let mut rows_affected =
            sqlx::query("UPDATE tracks SET file_path = ?, audio_quality = ? WHERE tidal_id = ?")
                .bind(path)
                .bind(quality)
                .bind(tid)
                .execute(&self.pool)
                .await
                .map_err(|e| e.to_string())?
                .rows_affected();

        log::info!("Update by tidal_id affected {} rows", rows_affected);

        // Fallback: Check if the track exists with external_id = track_id_numeric (as string) and provider_id = 'tidal'
        // This handles cases where tracks are imported via search/reference and have null tidal_id but valid external_id
        if rows_affected == 0 {
            let tid_str = track_id_numeric.to_string();
            log::info!(
                "Fallback: Attempting update by external_id: {} and provider_id='tidal'",
                tid_str
            );

            rows_affected = sqlx::query(
                "UPDATE tracks SET file_path = ?, audio_quality = ? WHERE external_id = ? AND provider_id = 'tidal'",
            )
            .bind(path)
            .bind(quality)
            .bind(tid_str)
            .execute(&self.pool)
            .await
            .map_err(|e| {
                log::error!("Fallback update failed: {}", e);
                e.to_string()
            })?
            .rows_affected();

            log::info!("Fallback update affected {} rows", rows_affected);
        }

        if rows_affected == 0 {
            log::warn!(
                "Downloaded track {} not found in library (tried tidal_id={} and external_id={}), offline playback may not work until imported.",
                track_id_numeric, tid, track_id_numeric
            );
        } else {
            log::info!(
                "Updated track {} with download info (path: {}, quality: {})",
                track_id_numeric,
                path,
                quality
            );
        }
        Ok(())
    }

    pub async fn update_provider_track_download_info(
        &self,
        provider_id: &str,
        external_id: &str,
        path: &str,
        quality: &str,
    ) -> Result<(), String> {
        let rows_affected = sqlx::query(
            "UPDATE tracks SET file_path = ?, audio_quality = ? WHERE provider_id = ? AND external_id = ?",
        )
        .bind(path)
        .bind(quality)
        .bind(provider_id)
        .bind(external_id)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?
        .rows_affected();

        if rows_affected == 0 {
            log::warn!(
                "Downloaded provider track {}:{} not found in library, offline playback may not work until imported.",
                provider_id,
                external_id
            );
        } else {
            log::info!(
                "Updated provider track {}:{} with download info (path: {}, quality: {})",
                provider_id,
                external_id,
                path,
                quality
            );
        }
        Ok(())
    }

    pub async fn get_track_local_info(
        &self,
        provider_id: &str,
        external_id: &str,
    ) -> Result<Option<(String, Option<String>)>, String> {
        let row = sqlx::query(
            "SELECT file_path, audio_quality FROM tracks WHERE provider_id = ? AND external_id = ? AND file_path IS NOT NULL",
        )
        .bind(provider_id)
        .bind(external_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        if let Some(r) = row {
            let path: String = r.try_get("file_path").unwrap_or_default();
            let quality: Option<String> = r.try_get("audio_quality").ok();
            if !path.is_empty() {
                return Ok(Some((path, quality)));
            }
        }
        Ok(None)
    }

    pub async fn clear_download_info(
        &self,
        provider_id: &str,
        external_id: &str,
    ) -> Result<Option<String>, String> {
        // First get the current file path so we can return it for deletion
        let row = sqlx::query(
            "SELECT file_path FROM tracks WHERE provider_id = ? AND external_id = ? AND file_path IS NOT NULL",
        )
        .bind(provider_id)
        .bind(external_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let old_path: Option<String> = row.and_then(|r| r.try_get("file_path").ok());

        // Clear the download info
        sqlx::query(
            "UPDATE tracks SET file_path = NULL, audio_quality = NULL WHERE provider_id = ? AND external_id = ?",
        )
        .bind(provider_id)
        .bind(external_id)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        log::info!(
            "Cleared download info for track {}:{}",
            provider_id,
            external_id
        );
        Ok(old_path)
    }

    pub async fn import_external_track(
        &self,
        track: &crate::models::Track,
        provider_id: &str,
    ) -> Result<String, String> {
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;
        let external_id = &track.id;

        // 1. Check if track already exists
        let exists = sqlx::query("SELECT id FROM tracks WHERE provider_id = ? AND external_id = ?")
            .bind(provider_id)
            .bind(external_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        if let Some(row) = exists {
            return Ok(row.try_get::<String, _>("id").unwrap_or_default());
        }

        // 2. Find or Create Artist (by Name)
        let artist_name = if track.artist.is_empty() {
            "Unknown Artist"
        } else {
            &track.artist
        };
        let artist_id = if let Some(row) = sqlx::query("SELECT id FROM artists WHERE name = ?")
            .bind(artist_name)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?
        {
            row.try_get::<String, _>("id").unwrap_or_default()
        } else {
            let new_id = Uuid::new_v4().to_string();
            // Note: We don't have artist/album external IDs from just the Track struct easily
            // So we set them to NULL for now. We are unifying by Name.
            sqlx::query("INSERT INTO artists (id, name, provider_id) VALUES (?, ?, ?)")
                .bind(&new_id)
                .bind(artist_name)
                .bind(provider_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
            new_id
        };

        // 3. Find or Create Album (by Title + ArtistID)
        let mut album_id = None;
        let album_name = if track.album.is_empty() {
            "Unknown Album"
        } else {
            &track.album
        };
        if !track.album.is_empty() {
            if let Some(row) =
                sqlx::query("SELECT id FROM albums WHERE title = ? AND artist_id = ?")
                    .bind(album_name)
                    .bind(&artist_id)
                    .fetch_optional(&mut *tx)
                    .await
                    .map_err(|e| e.to_string())?
            {
                album_id = Some(row.try_get::<String, _>("id").unwrap_or_default());
            } else {
                let new_id = Uuid::new_v4().to_string();
                sqlx::query(
                    "INSERT INTO albums (id, title, artist_id, cover_url, provider_id) VALUES (?, ?, ?, ?, ?)",
                )
                .bind(&new_id)
                .bind(album_name)
                .bind(&artist_id)
                .bind(&track.cover_url)
                .bind(provider_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
                album_id = Some(new_id);
            }
        }

        // 4. Create Track
        let new_track_id = Uuid::new_v4().to_string();
        let duration = track.duration as i64;

        let tidal_id = if provider_id == "tidal" {
            external_id.parse::<i64>().ok()
        } else {
            None
        };

        sqlx::query(
            r#"
            INSERT INTO tracks (id, title, artist_id, album_id, duration, source_type, provider_id, external_id, tidal_id, added_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
            "#,
        )
        .bind(&new_track_id)
        .bind(&track.title)
        .bind(&artist_id)
        .bind(&album_id)
        .bind(duration)
        .bind(provider_id.to_uppercase())
        .bind(provider_id)
        .bind(external_id)
        .bind(tidal_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        // 5. Index for Search
        sqlx::query(
            "INSERT INTO search_index (track_id, title, artist, album) VALUES (?, ?, ?, ?)",
        )
        .bind(&new_track_id)
        .bind(&track.title)
        .bind(artist_name)
        .bind(album_name)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(new_track_id)
    }

    pub async fn find_external_track(
        &self,
        provider_id: &str,
        external_id: &str,
    ) -> Result<Option<String>, String> {
        let row = sqlx::query("SELECT id FROM tracks WHERE provider_id = ? AND external_id = ?")
            .bind(provider_id)
            .bind(external_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(row.map(|r| r.try_get("id").unwrap_or_default()))
    }

    pub async fn import_tidal_track(
        &self,
        track: &crate::tidal::models::Track,
        cover_url: Option<String>,
    ) -> Result<String, String> {
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;

        let artist_name = track
            .artist
            .as_ref()
            .map(|a| a.name.clone())
            .unwrap_or_else(|| "Unknown Artist".to_string());

        let artist_cover_url = track
            .artist
            .as_ref()
            .and_then(|a| a.picture.as_ref())
            .map(|p| get_cover_url(p, CoverSize::Medium.px()));

        let artist_id = if let Some(row) = sqlx::query("SELECT id FROM artists WHERE name = ?")
            .bind(&artist_name)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?
        {
            row.try_get::<String, _>("id").unwrap_or_default()
        } else {
            let new_id = Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO artists (id, name, provider_id, external_id, cover_url) VALUES (?, ?, ?, ?, ?)")
                .bind(&new_id)
                .bind(&artist_name)
                .bind("tidal")
                .bind("0") // Tidal artists don't always have simple numeric IDs here
                .bind(&artist_cover_url)
                .execute(&mut *tx)
                .await
                .map_err(|e| e.to_string())?;
            new_id
        };

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

        let tidal_id_i64 = track.id as i64;

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
                INSERT INTO tracks (id, title, artist_id, album_id, duration, source_type, provider_id, external_id, added_at)
                VALUES (?, ?, ?, ?, ?, 'TIDAL', 'tidal', ?, strftime('%s', 'now'))
                "#,
            )
            .bind(&new_id)
            .bind(&track.title)
            .bind(&artist_id)
            .bind(&album_id)
            .bind(duration)
            .bind(tidal_id_i64.to_string())
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

            new_id
        };

        sqlx::query("DELETE FROM search_index WHERE track_id = ?")
            .bind(&track_id)
            .execute(&mut *tx)
            .await
            .ok();

        sqlx::query(
            "INSERT INTO search_index (track_id, title, artist, album) VALUES (?, ?, ?, ?)",
        )
        .bind(&track_id)
        .bind(&track.title)
        .bind(&artist_name)
        .bind(&album_name)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(track_id)
    }

    /// Import a track from any provider into the library
    /// This is the generic version of import_tidal_track
    #[allow(clippy::too_many_arguments)]
    pub async fn import_provider_track(
        &self,
        provider_id: &str,
        external_id: &str,
        title: &str,
        artist_name: &str,
        artist_external_id: Option<&str>,
        album_name: Option<&str>,
        album_external_id: Option<&str>,
        duration_secs: Option<u32>,
        cover_url: Option<String>,
    ) -> Result<String, String> {
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;

        // Upsert artist
        let artist_id = if let Some(row) = sqlx::query("SELECT id FROM artists WHERE name = ?")
            .bind(artist_name)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?
        {
            row.try_get::<String, _>("id").unwrap_or_default()
        } else {
            let new_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO artists (id, name, provider_id, external_id) VALUES (?, ?, ?, ?)",
            )
            .bind(&new_id)
            .bind(artist_name)
            .bind(provider_id)
            .bind(artist_external_id.unwrap_or("0"))
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
            new_id
        };

        // Upsert album if provided
        let mut album_id_opt = None;
        if let Some(album_title) = album_name {
            if !album_title.is_empty() {
                if let Some(row) =
                    sqlx::query("SELECT id FROM albums WHERE title = ? AND artist_id = ?")
                        .bind(album_title)
                        .bind(&artist_id)
                        .fetch_optional(&mut *tx)
                        .await
                        .map_err(|e| e.to_string())?
                {
                    album_id_opt = Some(row.try_get::<String, _>("id").unwrap_or_default());
                } else {
                    let new_id = Uuid::new_v4().to_string();
                    sqlx::query(
                        "INSERT INTO albums (id, title, artist_id, provider_id, external_id, cover_url) VALUES (?, ?, ?, ?, ?, ?)",
                    )
                    .bind(&new_id)
                    .bind(album_title)
                    .bind(&artist_id)
                    .bind(provider_id)
                    .bind(album_external_id.unwrap_or("0"))
                    .bind(&cover_url)
                    .execute(&mut *tx)
                    .await
                    .map_err(|e| e.to_string())?;
                    album_id_opt = Some(new_id);
                }
            }
        }

        // Check if track exists
        let exists = sqlx::query("SELECT id FROM tracks WHERE provider_id = ? AND external_id = ?")
            .bind(provider_id)
            .bind(external_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        let track_id = if let Some(row) = exists {
            row.try_get::<String, _>("id").unwrap_or_default()
        } else {
            let new_id = Uuid::new_v4().to_string();
            let duration = duration_secs.unwrap_or(0) as i64;
            let source_type = provider_id.to_uppercase();

            sqlx::query(
                r#"
                INSERT INTO tracks (id, title, artist_id, album_id, duration, source_type, provider_id, external_id, added_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
                "#,
            )
            .bind(&new_id)
            .bind(title)
            .bind(&artist_id)
            .bind(&album_id_opt)
            .bind(duration)
            .bind(&source_type)
            .bind(provider_id)
            .bind(external_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

            new_id
        };

        // Update search index
        sqlx::query("DELETE FROM search_index WHERE track_id = ?")
            .bind(&track_id)
            .execute(&mut *tx)
            .await
            .ok();

        sqlx::query(
            "INSERT INTO search_index (track_id, title, artist, album) VALUES (?, ?, ?, ?)",
        )
        .bind(&track_id)
        .bind(title)
        .bind(artist_name)
        .bind(album_name.unwrap_or(""))
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(track_id)
    }
}
