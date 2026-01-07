use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PlayHistoryEntry {
    pub id: String,
    pub track_id: String,
    pub played_at: i64,
    pub duration_played: Option<i64>,
    pub completed: i64, // SQLite uses INTEGER for BOOLEAN
    pub source: Option<String>,
}
