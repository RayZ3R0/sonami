use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Playlist {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub cover_url: Option<String>,
    pub created_at: String, // SQLite returns DATETIME as string usually
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PlaylistTrack {
    pub id: String,
    pub playlist_id: String,
    pub track_id: String,
    pub position: i64,
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistDetails {
    pub playlist: Playlist,
    pub tracks: Vec<crate::library::models::UnifiedTrack>,
}
