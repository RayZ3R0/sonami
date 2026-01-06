pub mod models;

use models::{TrackSource, UnifiedTrack};
use sqlx::{Pool, Row, Sqlite};
use uuid::Uuid;

pub struct LibraryManager {
    pool: Pool<Sqlite>,
}

impl LibraryManager {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
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
        if let Some(album) = &track.album {
            let album_title = &album.title;
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

        if exists.is_none() {
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
        }

        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(())
    }
}
