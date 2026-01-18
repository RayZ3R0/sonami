use async_trait::async_trait;
use crate::models::{Quality, SearchResults, StreamInfo, Track, Artist, Album};
use crate::providers::traits::MusicProvider;
use anyhow::{Result, anyhow};
use serde_json::Value;
use reqwest::Client;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};

use super::models::*;

pub struct JellyfinProvider {
    client: Client,
    pub server_url: String,
    user_id: String,
    access_token: String,
    device_id: String,
    initialized: bool,
}

impl JellyfinProvider {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            server_url: String::new(),
            user_id: String::new(),
            access_token: String::new(),
            device_id: uuid::Uuid::new_v4().to_string(),
            initialized: false,
        }
    }

    pub fn with_config(server_url: String, user_id: String, access_token: String) -> Self {
        Self {
            client: Client::new(),
            server_url,
            user_id,
            access_token,
            device_id: uuid::Uuid::new_v4().to_string(),
            initialized: true,
        }
    }

    fn build_auth_header(&self) -> String {
        format!(
            "MediaBrowser Client=\"Sonami\", Device=\"Desktop\", DeviceId=\"{}\", Version=\"0.1.0\", Token=\"{}\"",
            self.device_id,
            self.access_token
        )
    }

    fn headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&self.build_auth_header()).unwrap()
        );
        headers
    }

    fn image_url(&self, item_id: &str, max_width: u32) -> String {
        let base = self.server_url.trim_end_matches('/');
        format!("{}/Items/{}/Images/Primary?maxWidth={}", base, item_id, max_width)
    }

    pub async fn authenticate(&mut self, username: &str, password: &str) -> Result<()> {
        let base = self.server_url.trim_end_matches('/');
        let url = format!("{}/Users/AuthenticateByName", base);

        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!(
                "MediaBrowser Client=\"Sonami\", Device=\"Desktop\", DeviceId=\"{}\", Version=\"0.1.0\"",
                self.device_id
            )).unwrap()
        );
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            HeaderValue::from_static("application/json")
        );

        let body = serde_json::json!({
            "Username": username,
            "Pw": password
        });

        let resp: AuthenticationResult = self.client.post(&url)
            .headers(headers)
            .json(&body)
            .send().await?
            .json().await?;

        self.user_id = resp.user.id;
        self.access_token = resp.access_token;
        self.initialized = true;

        log::info!("Jellyfin authentication successful for user: {}", resp.user.name);
        Ok(())
    }
}

#[async_trait]
impl MusicProvider for JellyfinProvider {
    fn id(&self) -> &str {
        "jellyfin"
    }

    fn name(&self) -> &str {
        "Jellyfin"
    }

    async fn initialize(&mut self, config: Value) -> Result<()> {
        self.server_url = config.get("server_url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing server_url"))?
            .to_string();

        let username = config.get("username")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing username"))?;
        let password = config.get("password")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing password"))?;

        self.authenticate(username, password).await
    }

    async fn search(&self, query: &str) -> Result<SearchResults> {
        if !self.initialized {
            return Err(anyhow!("Jellyfin provider not initialized"));
        }

        let base = self.server_url.trim_end_matches('/');
        let url = format!(
            "{}/Items?searchTerm={}&IncludeItemTypes=Audio,MusicAlbum,MusicArtist&Recursive=true&UserId={}",
            base,
            urlencoding::encode(query),
            self.user_id
        );

        let resp: ItemsResult = self.client.get(&url)
            .headers(self.headers())
            .send().await?
            .json().await?;

        let mut tracks = Vec::new();
        let mut albums = Vec::new();
        let mut artists = Vec::new();

        for item in resp.items {
            match item.item_type.as_str() {
                "Audio" => {
                    tracks.push(Track {
                        id: item.id.clone(),
                        title: item.name.clone(),
                        artist: item.primary_artist(),
                        artist_id: item.primary_artist_id(),
                        album: item.album.clone().unwrap_or_default(),
                        album_id: item.album_id.clone(),
                        duration: item.ticks_to_seconds(),
                        cover_url: Some(self.image_url(&item.id, 640)),
                    });
                }
                "MusicAlbum" => {
                    albums.push(Album {
                        id: item.id.clone(),
                        title: item.name.clone(),
                        artist: item.primary_artist(),
                        artist_id: item.primary_artist_id(),
                        cover_url: Some(self.image_url(&item.id, 640)),
                        year: item.production_year.map(|y| y.to_string()),
                    });
                }
                "MusicArtist" => {
                    artists.push(Artist {
                        id: item.id.clone(),
                        name: item.name.clone(),
                        cover_url: Some(self.image_url(&item.id, 640)),
                    });
                }
                _ => {}
            }
        }

        Ok(SearchResults {
            tracks,
            albums,
            artists,
            playlists: vec![],
        })
    }

    async fn get_stream_url(&self, track_id: &str, quality: Quality) -> Result<StreamInfo> {
        if !self.initialized {
            return Err(anyhow!("Jellyfin provider not initialized"));
        }

        let base = self.server_url.trim_end_matches('/');
        
        let (container, audio_codec, bit_rate) = match quality {
            Quality::LOW => ("mp3", "mp3", "128000"),
            Quality::HIGH => ("mp3", "mp3", "320000"),
            Quality::LOSSLESS => ("flac", "flac", "0"),
        };

        let url = format!(
            "{}/Audio/{}/universal?Container={}&AudioCodec={}&audioBitRate={}&api_key={}",
            base,
            track_id,
            container,
            audio_codec,
            bit_rate,
            self.access_token
        );

        Ok(StreamInfo {
            url,
            quality,
            codec: Some(audio_codec.to_string()),
        })
    }

    async fn get_track_details(&self, track_id: &str) -> Result<Track> {
        if !self.initialized {
            return Err(anyhow!("Jellyfin provider not initialized"));
        }

        let base = self.server_url.trim_end_matches('/');
        let url = format!("{}/Items/{}?UserId={}", base, track_id, self.user_id);

        let item: BaseItemDto = self.client.get(&url)
            .headers(self.headers())
            .send().await?
            .json().await?;

        Ok(Track {
            id: item.id.clone(),
            title: item.name.clone(),
            artist: item.primary_artist(),
            artist_id: item.primary_artist_id(),
            album: item.album.clone().unwrap_or_default(),
            album_id: item.album_id.clone(),
            duration: item.ticks_to_seconds(),
            cover_url: Some(self.image_url(&item.id, 640)),
        })
    }

    async fn get_artist_details(&self, artist_id: &str) -> Result<Artist> {
        if !self.initialized {
            return Err(anyhow!("Jellyfin provider not initialized"));
        }

        let base = self.server_url.trim_end_matches('/');
        let url = format!("{}/Items/{}?UserId={}", base, artist_id, self.user_id);

        let item: BaseItemDto = self.client.get(&url)
            .headers(self.headers())
            .send().await?
            .json().await?;

        Ok(Artist {
            id: item.id.clone(),
            name: item.name.clone(),
            cover_url: Some(self.image_url(&item.id, 640)),
        })
    }

    async fn get_album_details(&self, album_id: &str) -> Result<Album> {
        if !self.initialized {
            return Err(anyhow!("Jellyfin provider not initialized"));
        }

        let base = self.server_url.trim_end_matches('/');
        let url = format!("{}/Items/{}?UserId={}", base, album_id, self.user_id);

        let item: BaseItemDto = self.client.get(&url)
            .headers(self.headers())
            .send().await?
            .json().await?;

        Ok(Album {
            id: item.id.clone(),
            title: item.name.clone(),
            artist: item.primary_artist(),
            artist_id: item.primary_artist_id(),
            cover_url: Some(self.image_url(&item.id, 640)),
            year: item.production_year.map(|y| y.to_string()),
        })
    }
}
