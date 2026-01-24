use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicResponse<T> {
    #[serde(rename = "subsonic-response")]
    pub subsonic_response: SubsonicResponseInner<T>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicResponseInner<T> {
    pub status: String,
    pub version: String,
    #[serde(flatten)]
    pub data: Option<T>,
    pub error: Option<SubsonicError>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicError {
    pub code: i32,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult3Data {
    pub search_result3: Option<SearchResult3>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult3 {
    #[serde(default)]
    pub artist: Vec<SubsonicArtist>,
    #[serde(default)]
    pub album: Vec<SubsonicAlbum>,
    #[serde(default)]
    pub song: Vec<SubsonicSong>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicSong {
    #[serde(deserialize_with = "deserialize_string_from_any")]
    pub id: String,
    pub title: String,
    pub album: Option<String>,
    pub artist: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_string_from_any")]
    pub album_id: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_string_from_any")]
    pub artist_id: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_u64_from_any")]
    pub duration: Option<u64>,
    pub cover_art: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_u32_from_any")]
    pub track: Option<u32>,
    #[serde(default, deserialize_with = "deserialize_option_u32_from_any")]
    pub year: Option<u32>,
    pub genre: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_u32_from_any")]
    pub bit_rate: Option<u32>,
    pub suffix: Option<String>,
    pub content_type: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_u64_from_any")]
    pub size: Option<u64>,
    #[serde(default, deserialize_with = "deserialize_option_u32_from_any")]
    pub disc_number: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicAlbum {
    #[serde(deserialize_with = "deserialize_string_from_any")]
    pub id: String,
    pub name: String,
    pub artist: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_string_from_any")]
    pub artist_id: Option<String>,
    pub cover_art: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_u32_from_any")]
    pub song_count: Option<u32>,
    #[serde(default, deserialize_with = "deserialize_option_u64_from_any")]
    pub duration: Option<u64>,
    #[serde(default, deserialize_with = "deserialize_option_u32_from_any")]
    pub year: Option<u32>,
    pub genre: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicArtist {
    #[serde(deserialize_with = "deserialize_string_from_any")]
    pub id: String,
    pub name: String,
    pub cover_art: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_u32_from_any")]
    pub album_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongData {
    pub song: SubsonicSong,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumData {
    pub album: SubsonicAlbumFull,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicAlbumFull {
    #[serde(deserialize_with = "deserialize_string_from_any")]
    pub id: String,
    pub name: String,
    pub artist: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_string_from_any")]
    pub artist_id: Option<String>,
    pub cover_art: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_u32_from_any")]
    pub song_count: Option<u32>,
    #[serde(default, deserialize_with = "deserialize_option_u64_from_any")]
    pub duration: Option<u64>,
    #[serde(default, deserialize_with = "deserialize_option_u32_from_any")]
    pub year: Option<u32>,
    #[serde(default)]
    pub song: Vec<SubsonicSong>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistData {
    pub artist: SubsonicArtistFull,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicArtistFull {
    #[serde(deserialize_with = "deserialize_string_from_any")]
    pub id: String,
    pub name: String,
    pub cover_art: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_u32_from_any")]
    pub album_count: Option<u32>,
    #[serde(default)]
    pub album: Vec<SubsonicAlbum>,
}

// Helpers for robust deserialization

fn deserialize_string_from_any<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum AnyValue {
        String(String),
        Number(i64),
        Float(f64),
        Bool(bool),
    }

    match AnyValue::deserialize(deserializer)? {
        AnyValue::String(s) => Ok(s),
        AnyValue::Number(n) => Ok(n.to_string()),
        AnyValue::Float(f) => Ok(f.to_string()),
        AnyValue::Bool(b) => Ok(b.to_string()),
    }
}

fn deserialize_option_string_from_any<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum AnyValue {
        String(String),
        Number(i64),
        Float(f64),
        Bool(bool),
        Null,
    }

    match Option::<AnyValue>::deserialize(deserializer)? {
        Some(AnyValue::String(s)) => Ok(Some(s)),
        Some(AnyValue::Number(n)) => Ok(Some(n.to_string())),
        Some(AnyValue::Float(f)) => Ok(Some(f.to_string())),
        Some(AnyValue::Bool(b)) => Ok(Some(b.to_string())),
        Some(AnyValue::Null) | None => Ok(None),
    }
}

fn deserialize_option_u32_from_any<'de, D>(deserializer: D) -> Result<Option<u32>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum AnyValue {
        Number(u32),
        String(String),
        Null,
    }

    match Option::<AnyValue>::deserialize(deserializer)? {
        Some(AnyValue::Number(n)) => Ok(Some(n)),
        Some(AnyValue::String(s)) => {
            if s.is_empty() {
                Ok(None)
            } else {
                s.parse::<u32>().map(Some).map_err(serde::de::Error::custom)
            }
        }
        Some(AnyValue::Null) | None => Ok(None),
    }
}

fn deserialize_option_u64_from_any<'de, D>(deserializer: D) -> Result<Option<u64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum AnyValue {
        Number(u64),
        String(String),
        Null,
    }

    match Option::<AnyValue>::deserialize(deserializer)? {
        Some(AnyValue::Number(n)) => Ok(Some(n)),
        Some(AnyValue::String(s)) => {
            if s.is_empty() {
                Ok(None)
            } else {
                s.parse::<u64>().map(Some).map_err(serde::de::Error::custom)
            }
        }
        Some(AnyValue::Null) | None => Ok(None),
    }
}
