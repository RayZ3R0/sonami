pub mod models;

use crate::library::models::{TrackSource, UnifiedTrack};
use models::PlayHistoryEntry;
use sqlx::{Pool, Row, Sqlite};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

pub struct PlayHistoryManager {
    pool: Pool<Sqlite>,
}

impl PlayHistoryManager {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    pub async fn record_play(
        &self,
        track_id: &str,
        context_uri: Option<String>,
        context_type: Option<String>,
    ) -> Result<String, String> {
        let id = Uuid::new_v4().to_string();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;

        // 1. Insert into history log
        sqlx::query(
            "INSERT INTO play_history (id, track_id, played_at, context_uri, context_type) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(track_id)
        .bind(now)
        .bind(&context_uri)
        .bind(&context_type)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        // 2. Update track statistics
        sqlx::query(
            "UPDATE tracks SET play_count = play_count + 1, last_played_at = ? WHERE id = ?",
        )
        .bind(now)
        .bind(track_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        // 3. Update artist statistics
        sqlx::query(
            r#"
            UPDATE artists SET play_count = COALESCE(play_count, 0) + 1, last_played_at = ?
            WHERE id = (SELECT artist_id FROM tracks WHERE id = ?)
            "#,
        )
        .bind(now)
        .bind(track_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        // 4. Update album statistics (if track has album)
        sqlx::query(
            r#"
            UPDATE albums SET play_count = COALESCE(play_count, 0) + 1, last_played_at = ?
            WHERE id = (SELECT album_id FROM tracks WHERE id = ? AND album_id IS NOT NULL)
            "#,
        )
        .bind(now)
        .bind(track_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        // 5. Update playlist statistics if context is playlist?
        // Optional feature for later.

        tx.commit().await.map_err(|e| e.to_string())?;

        log::info!(
            "Recorded playback for track {} (Context: {:?})",
            track_id,
            context_type
        );
        Ok(id)
    }

    pub async fn update_play_completion(
        &self,
        entry_id: &str,
        duration_played: i64,
        completed: bool,
    ) -> Result<(), String> {
        sqlx::query("UPDATE play_history SET duration_played = ?, completed = ? WHERE id = ?")
            .bind(duration_played)
            .bind(if completed { 1 } else { 0 })
            .bind(entry_id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn get_recent_plays(&self, limit: i64) -> Result<Vec<PlayHistoryEntry>, String> {
        let entries = sqlx::query_as::<_, PlayHistoryEntry>(
            "SELECT id, track_id, played_at, duration_played, completed, context_uri as source 
             FROM play_history 
             ORDER BY played_at DESC 
             LIMIT ?",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(entries)
    }

    pub async fn get_unique_recent_tracks(&self, limit: i64) -> Result<Vec<UnifiedTrack>, String> {
        // Optimized query using the new last_played_at column on tracks table
        let rows = sqlx::query(
            r#"
            SELECT 
                t.id, t.title, t.duration, t.source_type, t.file_path,
                t.play_count, t.skip_count, t.last_played_at, t.added_at, t.audio_quality,
                t.provider_id, t.external_id, t.artist_id, t.album_id,
                a.name as artist_name,
                al.title as album_title, al.cover_url
            FROM tracks t
            JOIN artists a ON t.artist_id = a.id
            LEFT JOIN albums al ON t.album_id = al.id
            WHERE t.last_played_at IS NOT NULL
            ORDER BY t.last_played_at DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
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
                artist_id: row.try_get("artist_id").ok(),
                album: row.try_get("album_title").unwrap_or_default(),
                album_id: row.try_get("album_id").ok(),
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

    pub async fn get_most_played_tracks(&self, limit: i64) -> Result<Vec<UnifiedTrack>, String> {
        let rows = sqlx::query(
            r#"
            SELECT 
                t.id, t.title, t.duration, t.source_type, t.file_path,
                t.play_count, t.skip_count, t.last_played_at, t.added_at, t.audio_quality,
                t.provider_id, t.external_id, t.artist_id, t.album_id,
                a.name as artist_name,
                al.title as album_title, al.cover_url
            FROM tracks t
            JOIN artists a ON t.artist_id = a.id
            LEFT JOIN albums al ON t.album_id = al.id
            WHERE t.play_count > 0
            ORDER BY t.play_count DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
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
                artist_id: row.try_get("artist_id").ok(),
                album: row.try_get("album_title").unwrap_or_default(),
                album_id: row.try_get("album_id").ok(),
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

    pub async fn get_play_count(&self, track_id: &str) -> Result<i64, String> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM play_history WHERE track_id = ?")
            .bind(track_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(count.0)
    }

    /// Get the top artists by play count for recommendation seeding
    pub async fn get_top_artists(&self, limit: i64) -> Result<Vec<(String, String, i64)>, String> {
        // Returns (artist_id, artist_name, play_count)
        let rows: Vec<(String, String, i64)> = sqlx::query_as(
            r#"
            SELECT id, name, play_count
            FROM artists
            WHERE play_count > 0
            ORDER BY play_count DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        log::info!("Fetched {} top artists for recommendations", rows.len());
        Ok(rows)
    }

    /// Get the top albums by play count
    pub async fn get_top_albums(&self, limit: i64) -> Result<Vec<(String, String, String, i64)>, String> {
        // Returns (album_id, album_title, artist_name, play_count)
        let rows: Vec<(String, String, String, i64)> = sqlx::query_as(
            r#"
            SELECT al.id, al.title, a.name as artist_name, al.play_count
            FROM albums al
            JOIN artists a ON al.artist_id = a.id
            WHERE al.play_count > 0
            ORDER BY al.play_count DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        log::info!("Fetched {} top albums for recommendations", rows.len());
        Ok(rows)
    }
}
