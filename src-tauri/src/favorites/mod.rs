pub mod models;

use crate::library::models::{TrackSource, UnifiedTrack};
use models::Favorite;
use sqlx::{Pool, Row, Sqlite};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

pub struct FavoritesManager {
    pool: Pool<Sqlite>,
}

impl FavoritesManager {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    pub async fn add_favorite(&self, track_id: &str) -> Result<(), String> {
        let id = Uuid::new_v4().to_string();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        sqlx::query(
            "INSERT OR IGNORE INTO user_favorites (id, track_id, liked_at) VALUES (?, ?, ?)",
        )
        .bind(id)
        .bind(track_id)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn remove_favorite(&self, track_id: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM user_favorites WHERE track_id = ?")
            .bind(track_id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn is_favorited(&self, track_id: &str) -> Result<bool, String> {
        let result = sqlx::query("SELECT 1 FROM user_favorites WHERE track_id = ?")
            .bind(track_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(result.is_some())
    }

    pub async fn get_favorites(&self) -> Result<Vec<Favorite>, String> {
        let favorites = sqlx::query_as::<_, Favorite>(
            "SELECT id, track_id, liked_at FROM user_favorites ORDER BY liked_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(favorites)
    }

    pub async fn get_favorites_with_tracks(&self) -> Result<Vec<UnifiedTrack>, String> {
        let rows = sqlx::query(
            r#"
            SELECT 
                t.id, t.title, t.duration, t.source_type, t.file_path, t.tidal_id,
                a.name as artist_name,
                COALESCE(al.title, '') as album_title,
                COALESCE(al.cover_url, a.cover_url) as cover_url,
                f.liked_at
            FROM user_favorites f
            JOIN tracks t ON f.track_id = t.id
            JOIN artists a ON t.artist_id = a.id
            LEFT JOIN albums al ON t.album_id = al.id
            ORDER BY f.liked_at DESC
            "#,
        )
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
                liked_at: row.try_get("liked_at").ok(),
                added_at: None,
            });
        }

        Ok(tracks)
    }
}
