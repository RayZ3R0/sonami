use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Quality {
    LOSSLESS,
    HIGH,
    LOW,
}

impl Quality {
    pub fn as_str(&self) -> &str {
        match self {
            Quality::LOSSLESS => "LOSSLESS",
            Quality::HIGH => "HIGH",
            Quality::LOW => "LOW",
        }
    }
}

impl std::str::FromStr for Quality {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "LOSSLESS" => Ok(Quality::LOSSLESS),
            "HIGH" => Ok(Quality::HIGH),
            "LOW" => Ok(Quality::LOW),
            _ => Err(format!("Invalid quality: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: u64,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist: Option<Artist>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub album: Option<Album>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u32>,
    #[serde(rename = "audioQuality", skip_serializing_if = "Option::is_none")]
    pub audio_quality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover: Option<String>,
    #[serde(rename = "trackNumber", skip_serializing_if = "Option::is_none")]
    pub track_number: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artist {
    pub id: u64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub picture: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Album {
    pub id: u64,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist: Option<Artist>,
    #[serde(rename = "numberOfTracks", skip_serializing_if = "Option::is_none")]
    pub number_of_tracks: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover: Option<String>,
    #[serde(rename = "numberOfTracks", skip_serializing_if = "Option::is_none")]
    pub number_of_tracks: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrackStreamInfo {
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codec: Option<String>,
    pub quality: Quality,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse<T> {
    pub items: Vec<T>,
}

// Helper function to build cover art URLs
pub fn get_cover_url(cover_id: &str, size: u32) -> String {
    let normalized = cover_id.replace("-", "/");
    format!(
        "https://resources.tidal.com/images/{}/{}x{}.jpg",
        normalized, size, size
    )
}

#[derive(Debug, Clone, Copy)]
pub enum CoverSize {
    Small = 160,
    Medium = 320,
    Large = 640,
    XLarge = 1280,
}

impl CoverSize {
    pub fn px(&self) -> u32 {
        *self as u32
    }
}
