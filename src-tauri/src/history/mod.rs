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
        source: Option<String>,
    ) -> Result<String, String> {
        let id = Uuid::new_v4().to_string();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        sqlx::query(
            "INSERT INTO play_history (id, track_id, played_at, source) VALUES (?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(track_id)
        .bind(now)
        .bind(source)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

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
            "SELECT id, track_id, played_at, duration_played, completed, source 
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
        let rows = sqlx::query(
            r#"
            SELECT 
                t.id, t.title, t.duration, t.source_type, t.file_path, t.tidal_id,
                a.name as artist_name,
                COALESCE(al.title, '') as album_title,
                COALESCE(al.cover_url, a.cover_url) as cover_url,
                MAX(h.played_at) as last_played
            FROM play_history h
            JOIN tracks t ON h.track_id = t.id
            JOIN artists a ON t.artist_id = a.id
            LEFT JOIN albums al ON t.album_id = al.id
            GROUP BY t.id
            ORDER BY last_played DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let mut tracks = Vec::new();
        for row in rows {
            let source_str: String = row.try_get("source_type").unwrap_or_default();
            let source = if source_str == "LOCAL" {
                TrackSource::Local
            } else {
                TrackSource::Tidal
            };

            tracks.push(UnifiedTrack {
                id: row.try_get("id").unwrap_or_default(),
                title: row.try_get("title").unwrap_or_default(),
                artist: row.try_get("artist_name").unwrap_or_default(),
                album: row.try_get("album_title").unwrap_or_default(),
                duration: row.try_get::<i64, _>("duration").unwrap_or(0) as u64,
                source,
                cover_image: row.try_get("cover_url").ok(),
                path: row.try_get("file_path").unwrap_or_default(),
                local_path: row.try_get("file_path").ok(),
                tidal_id: row
                    .try_get::<Option<i64>, _>("tidal_id")
                    .ok()
                    .flatten()
                    .map(|v| v as u64),
                liked_at: None,
                added_at: None,
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
}
