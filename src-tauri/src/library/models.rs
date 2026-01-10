use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TrackSource {
    Local,
    Tidal,
}

impl From<String> for TrackSource {
    fn from(s: String) -> Self {
        match s.as_str() {
            "TIDAL" => TrackSource::Tidal,
            _ => TrackSource::Local,
        }
    }
}

impl std::fmt::Display for TrackSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TrackSource::Tidal => write!(f, "TIDAL"),
            TrackSource::Local => write!(f, "LOCAL"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct DbTrack {
    pub id: String,
    pub title: String,
    pub artist_id: String,
    pub album_id: Option<String>,
    pub duration: i64,
    pub source_type: String,
    pub file_path: Option<String>,
    pub file_modified: Option<i64>,
    pub tidal_id: Option<i64>,
    pub play_count: i64,
    pub skip_count: i64,
    pub last_played_at: Option<i64>,
    pub added_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnifiedTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: u64,
    pub source: TrackSource,
    pub cover_image: Option<String>,
    pub path: String,

    pub local_path: Option<String>,
    pub tidal_id: Option<u64>,

    // Analytics
    pub play_count: u64,
    pub skip_count: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_played_at: Option<i64>,

    // For favorites - when this track was liked
    #[serde(skip_serializing_if = "Option::is_none")]
    pub liked_at: Option<i64>,

    // For playlist tracks - when this track was added to playlist
    // Or library tracks - when added to library
    #[serde(skip_serializing_if = "Option::is_none")]
    pub added_at: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct LibraryAlbum {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub cover_image: Option<String>,
    pub tidal_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct LibraryArtist {
    pub id: String,
    pub name: String,
    pub cover_image: Option<String>,
    pub tidal_id: Option<i64>,
}
