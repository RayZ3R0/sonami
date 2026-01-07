use super::models::{Playlist, PlaylistDetails};
use crate::library::models::{TrackSource, UnifiedTrack};
use crate::tidal::models::Track as TidalTrack;
use sqlx::{Pool, Row, Sqlite};
use uuid::Uuid;
use chrono::Utc;

pub struct PlaylistManager {
    pool: Pool<Sqlite>,
}

impl PlaylistManager {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    pub async fn create_playlist(
        &self,
        title: String,
        description: Option<String>,
    ) -> Result<Playlist, String> {
        let id = Uuid::new_v4().to_string();

        sqlx::query("INSERT INTO playlists (id, title, description) VALUES (?, ?, ?)")
            .bind(&id)
            .bind(&title)
            .bind(&description)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        // Fetch back to return
        let playlist = sqlx::query_as::<_, Playlist>("SELECT * FROM playlists WHERE id = ?")
            .bind(&id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(playlist)
    }

    pub async fn get_playlists(&self) -> Result<Vec<Playlist>, String> {
        sqlx::query_as::<_, Playlist>(
            r#"
            SELECT 
                p.id, 
                p.title, 
                p.description, 
                COALESCE(p.cover_url, (
                    SELECT GROUP_CONCAT(img, '|') FROM (
                        SELECT DISTINCT al.cover_url as img
                        FROM playlist_tracks pt 
                        JOIN tracks t ON pt.track_id = t.id 
                        LEFT JOIN albums al ON t.album_id = al.id 
                        WHERE pt.playlist_id = p.id AND al.cover_url IS NOT NULL
                        ORDER BY pt.position ASC 
                        LIMIT 4
                    )
                )) as cover_url,
                p.created_at, 
                p.updated_at
            FROM playlists p
            ORDER BY p.created_at DESC
            "#
        )
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_playlist_details(&self, playlist_id: &str) -> Result<PlaylistDetails, String> {
        let playlist = sqlx::query_as::<_, Playlist>(
            r#"
            SELECT 
                p.id, 
                p.title, 
                p.description, 
                COALESCE(p.cover_url, (
                    SELECT GROUP_CONCAT(img, '|') FROM (
                        SELECT DISTINCT al.cover_url as img
                        FROM playlist_tracks pt 
                        JOIN tracks t ON pt.track_id = t.id 
                        LEFT JOIN albums al ON t.album_id = al.id 
                        WHERE pt.playlist_id = p.id AND al.cover_url IS NOT NULL
                        ORDER BY pt.position ASC 
                        LIMIT 4
                    )
                )) as cover_url,
                p.created_at, 
                p.updated_at
            FROM playlists p
            WHERE p.id = ?
            "#
        )
            .bind(playlist_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        // Join playlist_tracks -> tracks -> artists/albums
        // Similar to library generic search/get queries
        let rows = sqlx::query(
            r#"
            SELECT 
                t.id, t.title, t.duration, t.source_type, t.file_path, t.tidal_id,
                a.name as artist_name,
                al.title as album_title, al.cover_url,
                pt.added_at
            FROM playlist_tracks pt
            JOIN tracks t ON pt.track_id = t.id
            JOIN artists a ON t.artist_id = a.id
            LEFT JOIN albums al ON t.album_id = al.id
            WHERE pt.playlist_id = ?
            ORDER BY pt.position ASC
            "#,
        )
        .bind(playlist_id)
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

            let path = match source {
                TrackSource::Tidal => format!("tidal:{}", tidal_id.unwrap_or(0)),
                TrackSource::Local => local_path.clone().unwrap_or_default(),
            };

            let added_at: Option<i64> = row.try_get("added_at").ok();

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
                liked_at: None,
                added_at, 
            });
        }

        Ok(PlaylistDetails { playlist, tracks })
    }

    pub async fn delete_playlist(&self, id: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM playlists WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // Advanced: Add Tidal Track to Playlist
    // Needs to ensure track exists in library first.
    // This duplicates some logic from LibraryManager::import_tidal_track but we can't easily reuse without refactoring.
    // Ideally LibraryManager exposes a public "ensure_track_exists" or we move that logic to a shared helper?
    // For now, I will assume we call `import_tidal_track` from command layer OR I replicate the check here.
    // Actually, best "industry standard" approach:
    // The Command should call library_manager.import_track(), then playlist_manager.add_track_id().
    // But here I'll implement a raw `add_track_by_id` and ensuring existence is done before.

    pub async fn add_track_entry(&self, playlist_id: &str, track_id: &str) -> Result<(), String> {
        // Get max position
        let max_pos: (i64,) = sqlx::query_as(
            "SELECT COALESCE(MAX(position), -1) FROM playlist_tracks WHERE playlist_id = ?",
        )
        .bind(playlist_id)
        .fetch_one(&self.pool)
        .await
        .unwrap_or((-1,));

        let new_pos = max_pos.0 + 1;
        let id = Uuid::new_v4().to_string();
        let added_at = Utc::now().timestamp();

        sqlx::query(
            "INSERT INTO playlist_tracks (id, playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(playlist_id)
        .bind(track_id)
        .bind(new_pos)
        .bind(added_at)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub async fn remove_track_entry(&self, playlist_id: &str, track_id: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?")
            .bind(playlist_id)
            .bind(track_id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // Helper to find track ID by Tidal ID
    pub async fn find_track_id_by_tidal_id(&self, tidal_id: u64) -> Result<Option<String>, String> {
        let row = sqlx::query("SELECT id FROM tracks WHERE tidal_id = ?")
            .bind(tidal_id as i64)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(row.map(|r| r.get("id")))
    }

    pub async fn get_playlists_containing_track(&self, track_id: &str) -> Result<Vec<String>, String> {
        let rows = sqlx::query("SELECT DISTINCT playlist_id FROM playlist_tracks WHERE track_id = ?")
            .bind(track_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        let playlist_ids = rows.iter().map(|r| r.get("playlist_id")).collect();
        Ok(playlist_ids)
    }
}
