use crate::models::{Album, Artist, Quality, SearchResults, StreamInfo, Track};
use crate::providers::traits::MusicProvider;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use hex;
use md5;
use rand::Rng;
use reqwest::Client;
use serde_json::Value;

use super::models::*;

pub struct SubsonicProvider {
    client: Client,
    server_url: String,
    username: String,
    password: String,
    initialized: bool,
    use_legacy_auth: bool,
}

impl Default for SubsonicProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl SubsonicProvider {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            server_url: String::new(),
            username: String::new(),
            password: String::new(),
            initialized: false,
            use_legacy_auth: false,
        }
    }

    pub fn with_config(server_url: String, username: String, password: String) -> Self {
        Self {
            client: Client::new(),
            server_url,
            username,
            password,
            initialized: true,
            // Default to legacy auth for maximum compatibility (required by hifi managed mode)
            use_legacy_auth: true,
        }
    }

    fn generate_salt() -> String {
        let mut rng = rand::rng();
        let random_bytes: Vec<u8> = (0..16).map(|_| rng.random::<u8>()).collect();
        hex::encode(random_bytes)
    }

    fn build_auth_params(&self) -> String {
        if self.use_legacy_auth {
            format!(
                "c=sonami&f=json&v=1.13.0&u={}&p={}",
                urlencoding::encode(&self.username),
                urlencoding::encode(&self.password)
            )
        } else {
            let salt = Self::generate_salt();
            let token_input = format!("{}{}", self.password, salt);
            let token = format!("{:x}", md5::compute(token_input.as_bytes()));

            format!(
                "c=sonami&f=json&v=1.13.0&u={}&s={}&t={}",
                urlencoding::encode(&self.username),
                salt,
                token
            )
        }
    }

    fn build_url(&self, endpoint: &str, extra_params: &str) -> String {
        let auth = self.build_auth_params();
        let base = self.server_url.trim_end_matches('/');
        if extra_params.is_empty() {
            format!("{}/rest/{}?{}", base, endpoint, auth)
        } else {
            format!("{}/rest/{}?{}&{}", base, endpoint, auth, extra_params)
        }
    }

    fn cover_art_url(&self, cover_art_id: &str, size: u32) -> String {
        let auth = self.build_auth_params();
        let base = self.server_url.trim_end_matches('/');
        format!(
            "{}/rest/getCoverArt?id={}&size={}&{}",
            base, cover_art_id, size, auth
        )
    }

    pub async fn ping(&self) -> Result<bool> {
        let url = self.build_url("ping", "");
        let resp: SubsonicResponse<()> = self.client.get(&url).send().await?.json().await?;

        if resp.subsonic_response.status == "ok" {
            Ok(true)
        } else if let Some(err) = resp.subsonic_response.error {
            Err(anyhow!("Subsonic error {}: {}", err.code, err.message))
        } else {
            Err(anyhow!("Unknown Subsonic error"))
        }
    }

    /// Authenticate using getUser.view - this is what Feishin uses and is more compatible
    /// with servers like hifi that may handle ping.view differently
    pub async fn authenticate(&self) -> Result<bool> {
        let url = self.build_url(
            "getUser",
            &format!("username={}", urlencoding::encode(&self.username)),
        );
        let resp: SubsonicResponse<Value> = self.client.get(&url).send().await?.json().await?;

        if resp.subsonic_response.status == "ok" {
            Ok(true)
        } else if let Some(err) = resp.subsonic_response.error {
            Err(anyhow!("Subsonic auth error {}: {}", err.code, err.message))
        } else {
            Err(anyhow!("Unknown Subsonic error"))
        }
    }
}

#[async_trait]
impl MusicProvider for SubsonicProvider {
    fn id(&self) -> &str {
        "subsonic"
    }

    fn name(&self) -> &str {
        "Subsonic"
    }

    async fn initialize(&mut self, config: Value) -> Result<()> {
        self.server_url = config
            .get("server_url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing server_url"))?
            .to_string();
        self.username = config
            .get("username")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing username"))?
            .to_string();
        self.password = config
            .get("password")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing password"))?
            .to_string();

        // Allow explicit legacy auth configuration from settings
        self.use_legacy_auth = config
            .get("use_legacy_auth")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        // Use authenticate() (getUser.view) instead of ping() for better hifi compatibility
        // Try token auth first, fall back to legacy if it fails (unless explicitly set)
        if !self.use_legacy_auth && self.authenticate().await.is_err() {
            self.use_legacy_auth = true;
        }

        // Verify authentication works
        self.authenticate().await?;
        self.initialized = true;
        Ok(())
    }

    async fn search(&self, query: &str) -> Result<SearchResults> {
        if !self.initialized {
            return Err(anyhow!("Subsonic provider not initialized"));
        }

        log::info!("Subsonic search for: '{}'", query);

        let url = self.build_url(
            "search3",
            &format!(
                "query={}&artistCount=20&albumCount=20&songCount=50",
                urlencoding::encode(query)
            ),
        );

        log::debug!("Subsonic search3 URL: {}", url);

        log::info!("Subsonic search3 URL: {}", url);

        // Fetch as text first to debug raw response
        let resp_text = self.client.get(&url).send().await?.text().await?;
        log::info!("Subsonic raw search response: {}", resp_text);

        // Parse from text
        let resp: SubsonicResponse<SearchResult3Data> = serde_json::from_str(&resp_text)?;
        log::info!("Parsed Subsonic response: {:?}", resp);

        if resp.subsonic_response.status != "ok" {
            if let Some(err) = resp.subsonic_response.error {
                log::error!("Subsonic search3 error: {} - {}", err.code, err.message);
                return Err(anyhow!("Subsonic error {}: {}", err.code, err.message));
            }
            return Err(anyhow!("Unknown Subsonic error"));
        }

        let search_data = resp
            .subsonic_response
            .data
            .and_then(|d| d.search_result3)
            .unwrap_or(SearchResult3 {
                artist: vec![],
                album: vec![],
                song: vec![],
            });

        log::info!(
            "Subsonic search3 response: {} songs, {} albums, {} artists",
            search_data.song.len(),
            search_data.album.len(),
            search_data.artist.len()
        );

        let tracks: Vec<Track> = search_data
            .song
            .into_iter()
            .map(|s| Track {
                id: format!("subsonic:{}", s.id),
                title: s.title,
                artist: s.artist.unwrap_or_default(),
                artist_id: s.artist_id.map(|id| format!("subsonic:{}", id)),
                album: s.album.unwrap_or_default(),
                album_id: s.album_id.map(|id| format!("subsonic:{}", id)),
                duration: s.duration.unwrap_or(0),
                cover_url: s.cover_art.map(|c| self.cover_art_url(&c, 1200)),
            })
            .collect();

        let albums: Vec<Album> = search_data
            .album
            .into_iter()
            .map(|a| Album {
                id: format!("subsonic:{}", a.id),
                title: a.name,
                artist: a.artist.unwrap_or_default(),
                artist_id: a.artist_id.map(|id| format!("subsonic:{}", id)),
                cover_url: a.cover_art.map(|c| self.cover_art_url(&c, 640)),
                year: a.year.map(|y| y.to_string()),
                track_count: a.song_count,
                duration: a.duration,
            })
            .collect();

        let artists: Vec<Artist> = search_data
            .artist
            .into_iter()
            .map(|a| Artist {
                id: format!("subsonic:{}", a.id),
                name: a.name,
                cover_url: a.cover_art.map(|c| self.cover_art_url(&c, 640)),
                banner: None,
            })
            .collect();

        Ok(SearchResults {
            tracks,
            albums,
            artists,
            playlists: vec![],
        })
    }

    async fn get_stream_url(&self, track_id: &str, _quality: Quality) -> Result<StreamInfo> {
        if !self.initialized {
            return Err(anyhow!("Subsonic provider not initialized"));
        }

        // Fetch track details to determine the original format
        // Strip subsonic: prefix if present
        let clean_id = track_id.strip_prefix("subsonic:").unwrap_or(track_id);
        let details_url = self.build_url("getSong", &format!("id={}", clean_id));
        log::debug!("Subsonic getSong URL: {}", details_url);

        let resp: SubsonicResponse<SongData> =
            self.client.get(&details_url).send().await?.json().await?;

        if resp.subsonic_response.status != "ok" {
            if let Some(err) = resp.subsonic_response.error {
                return Err(anyhow!("Subsonic error {}: {}", err.code, err.message));
            }
            return Err(anyhow!("Unknown Subsonic error"));
        }

        let song = resp
            .subsonic_response
            .data
            .ok_or_else(|| anyhow!("No song data"))?
            .song;

        // Determine format strategy based on file suffix

        let suffix = song.suffix.unwrap_or_default().to_lowercase();
        let (format_param, actual_quality) = match suffix.as_str() {
            "flac" => ("raw", Quality::LOSSLESS),
            "mp3" | "ogg" | "opus" => ("raw", Quality::HIGH),
            _ => ("mp3", Quality::HIGH), // Transcode m4a, aac, etc.
        };

        let url = self.build_url(
            "stream",
            &format!("id={}&format={}", clean_id, format_param),
        );

        Ok(StreamInfo {
            url,
            quality: actual_quality,
            codec: Some(if format_param == "raw" {
                suffix
            } else {
                "mp3".to_string()
            }),
        })
    }

    async fn get_track_details(&self, track_id: &str) -> Result<Track> {
        if !self.initialized {
            return Err(anyhow!("Subsonic provider not initialized"));
        }

        let url = self.build_url("getSong", &format!("id={}", track_id));
        let resp: SubsonicResponse<SongData> = self.client.get(&url).send().await?.json().await?;

        if resp.subsonic_response.status != "ok" {
            if let Some(err) = resp.subsonic_response.error {
                return Err(anyhow!("Subsonic error {}: {}", err.code, err.message));
            }
            return Err(anyhow!("Unknown Subsonic error"));
        }

        let song = resp
            .subsonic_response
            .data
            .ok_or_else(|| anyhow!("No song data"))?
            .song;

        Ok(Track {
            id: format!("subsonic:{}", song.id),
            title: song.title,
            artist: song.artist.unwrap_or_default(),
            artist_id: song.artist_id.map(|id| format!("subsonic:{}", id)),
            album: song.album.unwrap_or_default(),
            album_id: song.album_id.map(|id| format!("subsonic:{}", id)),
            duration: song.duration.unwrap_or(0),
            cover_url: song.cover_art.map(|c| self.cover_art_url(&c, 640)),
        })
    }

    async fn get_artist_details(&self, artist_id: &str) -> Result<Artist> {
        if !self.initialized {
            return Err(anyhow!("Subsonic provider not initialized"));
        }

        let url = self.build_url("getArtist", &format!("id={}", artist_id));
        let resp: SubsonicResponse<ArtistData> = self.client.get(&url).send().await?.json().await?;

        if resp.subsonic_response.status != "ok" {
            if let Some(err) = resp.subsonic_response.error {
                return Err(anyhow!("Subsonic error {}: {}", err.code, err.message));
            }
            return Err(anyhow!("Unknown Subsonic error"));
        }

        let artist = resp
            .subsonic_response
            .data
            .ok_or_else(|| anyhow!("No artist data"))?
            .artist;

        Ok(Artist {
            id: format!("subsonic:{}", artist.id),
            name: artist.name,
            cover_url: artist.cover_art.map(|c| self.cover_art_url(&c, 640)),
            banner: None,
        })
    }

    async fn get_album_details(&self, album_id: &str) -> Result<Album> {
        if !self.initialized {
            return Err(anyhow!("Subsonic provider not initialized"));
        }

        let url = self.build_url("getAlbum", &format!("id={}", album_id));
        let resp: SubsonicResponse<AlbumData> = self.client.get(&url).send().await?.json().await?;

        if resp.subsonic_response.status != "ok" {
            if let Some(err) = resp.subsonic_response.error {
                return Err(anyhow!("Subsonic error {}: {}", err.code, err.message));
            }
            return Err(anyhow!("Unknown Subsonic error"));
        }

        let album = resp
            .subsonic_response
            .data
            .ok_or_else(|| anyhow!("No album data"))?
            .album;

        Ok(Album {
            id: format!("subsonic:{}", album.id),
            title: album.name,
            artist: album.artist.unwrap_or_default(),
            artist_id: album.artist_id.map(|id| format!("subsonic:{}", id)),
            cover_url: album.cover_art.map(|c| self.cover_art_url(&c, 640)),
            year: album.year.map(|y| y.to_string()),
            track_count: album.song_count,
            duration: album.duration,
        })
    }

    async fn get_artist_top_tracks(&self, artist_id: &str) -> Result<Vec<Track>> {
        if !self.initialized {
            return Err(anyhow!("Subsonic provider not initialized"));
        }

        let artist = self.get_artist_details(artist_id).await?;
        let artist_name = artist.name;

        let url = self.build_url(
            "getTopSongs",
            &format!("artist={}&count=10", urlencoding::encode(&artist_name)),
        );

        let resp: Value = self.client.get(&url).send().await?.json().await?;

        let binding = resp["subsonic-response"].clone();
        let top_songs = binding
            .get("topSongs")
            .and_then(|t| t.get("song"))
            .and_then(|s| s.as_array());

        let mut tracks = Vec::new();
        if let Some(songs) = top_songs {
            for s in songs {
                // Parse SubsonicSong from Value
                let song: SubsonicSong = serde_json::from_value(s.clone())?;
                tracks.push(Track {
                    id: format!("subsonic:{}", song.id),
                    title: song.title,
                    artist: song.artist.unwrap_or_default(),
                    artist_id: song.artist_id.map(|id| format!("subsonic:{}", id)),
                    album: song.album.unwrap_or_default(),
                    album_id: song.album_id.map(|id| format!("subsonic:{}", id)),
                    duration: song.duration.unwrap_or(0),
                    cover_url: song.cover_art.map(|c| self.cover_art_url(&c, 640)),
                });
            }
        }

        Ok(tracks)
    }

    async fn get_artist_albums(&self, artist_id: &str) -> Result<Vec<Album>> {
        if !self.initialized {
            return Err(anyhow!("Subsonic provider not initialized"));
        }

        let url = self.build_url("getArtist", &format!("id={}", artist_id));
        let resp: SubsonicResponse<ArtistData> = self.client.get(&url).send().await?.json().await?;

        if resp.subsonic_response.status != "ok" {
            return Err(anyhow!("Subsonic error"));
        }

        let artist_full = resp
            .subsonic_response
            .data
            .ok_or(anyhow!("No data"))?
            .artist;

        let albums = artist_full
            .album
            .into_iter()
            .map(|a| Album {
                id: format!("subsonic:{}", a.id),
                title: a.name,
                artist: a.artist.unwrap_or_default(),
                artist_id: a.artist_id.map(|id| format!("subsonic:{}", id)),
                cover_url: a.cover_art.map(|c| self.cover_art_url(&c, 640)),
                year: a.year.map(|y| y.to_string()),
                track_count: a.song_count,
                duration: a.duration,
            })
            .collect();

        Ok(albums)
    }

    async fn get_album_tracks(&self, album_id: &str) -> Result<Vec<Track>> {
        if !self.initialized {
            return Err(anyhow!("Subsonic provider not initialized"));
        }

        let url = self.build_url("getAlbum", &format!("id={}", album_id));
        let resp: SubsonicResponse<AlbumData> = self.client.get(&url).send().await?.json().await?;

        if resp.subsonic_response.status != "ok" {
            return Err(anyhow!("Subsonic error"));
        }

        let album_full = resp.subsonic_response.data.ok_or(anyhow!("No data"))?.album;

        let tracks = album_full
            .song
            .into_iter()
            .map(|s| Track {
                id: format!("subsonic:{}", s.id),
                title: s.title,
                artist: s.artist.unwrap_or_default(),
                artist_id: s.artist_id.map(|id| format!("subsonic:{}", id)),
                album: s.album.unwrap_or_default(),
                album_id: s.album_id.map(|id| format!("subsonic:{}", id)),
                duration: s.duration.unwrap_or(0),
                cover_url: s.cover_art.map(|c| self.cover_art_url(&c, 640)),
            })
            .collect();

        Ok(tracks)
    }
}
