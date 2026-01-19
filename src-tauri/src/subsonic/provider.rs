use crate::models::{Album, Artist, Quality, SearchResults, StreamInfo, Track};
use crate::providers::traits::MusicProvider;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
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
        }
    }

    pub fn with_config(server_url: String, username: String, password: String) -> Self {
        Self {
            client: Client::new(),
            server_url,
            username,
            password,
            initialized: true,
        }
    }

    fn generate_salt() -> String {
        let mut rng = rand::rng();
        (0..16)
            .map(|_| format!("{:x}", rng.random::<u8>()))
            .collect()
    }

    fn build_auth_params(&self) -> String {
        let salt = Self::generate_salt();
        let token_input = format!("{}{}", self.password, salt);
        let token = format!("{:x}", md5::compute(token_input.as_bytes()));

        format!(
            "u={}&t={}&s={}&v=1.16.1&c=sonami&f=json",
            urlencoding::encode(&self.username),
            token,
            salt
        )
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

        self.ping().await?;
        self.initialized = true;
        Ok(())
    }

    async fn search(&self, query: &str) -> Result<SearchResults> {
        if !self.initialized {
            return Err(anyhow!("Subsonic provider not initialized"));
        }

        let url = self.build_url(
            "search3",
            &format!(
                "query={}&artistCount=20&albumCount=20&songCount=50",
                urlencoding::encode(query)
            ),
        );

        let resp: SubsonicResponse<SearchResult3Data> =
            self.client.get(&url).send().await?.json().await?;

        if resp.subsonic_response.status != "ok" {
            if let Some(err) = resp.subsonic_response.error {
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

        let tracks: Vec<Track> = search_data
            .song
            .into_iter()
            .map(|s| Track {
                id: s.id.clone(),
                title: s.title,
                artist: s.artist.unwrap_or_default(),
                artist_id: s.artist_id,
                album: s.album.unwrap_or_default(),
                album_id: s.album_id,
                duration: s.duration.unwrap_or(0),
                cover_url: s.cover_art.map(|c| self.cover_art_url(&c, 640)),
            })
            .collect();

        let albums: Vec<Album> = search_data
            .album
            .into_iter()
            .map(|a| Album {
                id: a.id.clone(),
                title: a.name,
                artist: a.artist.unwrap_or_default(),
                artist_id: a.artist_id,
                cover_url: a.cover_art.map(|c| self.cover_art_url(&c, 640)),
                year: a.year.map(|y| y.to_string()),
            })
            .collect();

        let artists: Vec<Artist> = search_data
            .artist
            .into_iter()
            .map(|a| Artist {
                id: a.id.clone(),
                name: a.name,
                cover_url: a.cover_art.map(|c| self.cover_art_url(&c, 640)),
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
        let details_url = self.build_url("getSong", &format!("id={}", track_id));
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
        // FLAC, MP3, OGG, OPUS can be streamed raw
        // M4A, AAC, etc. need transcoding to MP3 due to moov atom issues
        let suffix = song.suffix.unwrap_or_default().to_lowercase();
        let (format_param, actual_quality) = match suffix.as_str() {
            "flac" => ("raw", Quality::LOSSLESS),
            "mp3" | "ogg" | "opus" => ("raw", Quality::HIGH),
            _ => ("mp3", Quality::HIGH), // Transcode m4a, aac, etc.
        };

        let url = self.build_url(
            "stream",
            &format!("id={}&format={}", track_id, format_param),
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
            id: song.id,
            title: song.title,
            artist: song.artist.unwrap_or_default(),
            artist_id: song.artist_id,
            album: song.album.unwrap_or_default(),
            album_id: song.album_id,
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
            id: artist.id,
            name: artist.name,
            cover_url: artist.cover_art.map(|c| self.cover_art_url(&c, 640)),
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
            id: album.id,
            title: album.name,
            artist: album.artist.unwrap_or_default(),
            artist_id: album.artist_id,
            cover_url: album.cover_art.map(|c| self.cover_art_url(&c, 640)),
            year: album.year.map(|y| y.to_string()),
        })
    }
}
