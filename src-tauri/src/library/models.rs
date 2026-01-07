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

impl ToString for TrackSource {
    fn to_string(&self) -> String {
        match self {
            TrackSource::Tidal => "TIDAL".to_string(),
            TrackSource::Local => "LOCAL".to_string(),
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
    
    // For favorites - when this track was liked
    #[serde(skip_serializing_if = "Option::is_none")]
    pub liked_at: Option<i64>,
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
