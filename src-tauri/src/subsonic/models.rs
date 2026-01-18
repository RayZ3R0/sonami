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
    pub id: String,
    pub title: String,
    pub album: Option<String>,
    pub artist: Option<String>,
    pub album_id: Option<String>,
    pub artist_id: Option<String>,
    pub duration: Option<u64>,
    pub cover_art: Option<String>,
    pub track: Option<u32>,
    pub year: Option<u32>,
    pub genre: Option<String>,
    pub bit_rate: Option<u32>,
    pub suffix: Option<String>,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicAlbum {
    pub id: String,
    pub name: String,
    pub artist: Option<String>,
    pub artist_id: Option<String>,
    pub cover_art: Option<String>,
    pub song_count: Option<u32>,
    pub duration: Option<u64>,
    pub year: Option<u32>,
    pub genre: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubsonicArtist {
    pub id: String,
    pub name: String,
    pub cover_art: Option<String>,
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
    pub id: String,
    pub name: String,
    pub artist: Option<String>,
    pub artist_id: Option<String>,
    pub cover_art: Option<String>,
    pub song_count: Option<u32>,
    pub duration: Option<u64>,
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
    pub id: String,
    pub name: String,
    pub cover_art: Option<String>,
    pub album_count: Option<u32>,
    #[serde(default)]
    pub album: Vec<SubsonicAlbum>,
}
