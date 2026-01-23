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
            use_legacy_auth: false,
        }
    }

    fn generate_salt() -> String {
        let mut rng = rand::rng();
        let random_bytes: Vec<u8> = (0..16).map(|_| rng.random::<u8>()).collect();
        hex::encode(random_bytes)
    }

    fn build_auth_params(&self) -> String {
        if self.use_legacy_auth {
            let hex_pass = hex::encode(&self.password);
            format!(
                "u={}&p={}&v=1.16.1&c=sonami&f=json",
                urlencoding::encode(&self.username),
                hex_pass
            )
        } else {
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

        if self.ping().await.is_err() {
            self.use_legacy_auth = true;
            self.ping().await?;
        }
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

        // Subsonic getTopSongs requires artist name, not ID. 
        // But some servers support getTopSongs with artistId? No, checking API docs...
        // standard Subsonic `getTopSongs` takes `artist` (name). `getArtist` returns albums but not songs.
        // `getArtist` returns List<ID3Album>.
        // Using `getArtist` we get albums. But for top tracks?
        // We might need to fetch `getArtist` first to get the name if we only have ID?
        // OR we can search or maybe `getTopSongs` support ID?
        // Navidrome supports `id` in `getTopSongs`?
        // Let's first try `getTopSongs` with `artistId` parameter? No standard says `artist`.
        // However, we have `getArtist` which returns details.
        // Let's fetch artist details first to get the name, then call getTopSongs?
        // Or better: `getArtist` in some implementations returns all songs? No.
        
        // Wait, standard Subsonic API `getTopSongs`: "Returns top songs for the given artist... Parameter: artist".
        
        // Let's try fetching artist details to get the name.
        let artist = self.get_artist_details(artist_id).await?;
        let artist_name = artist.name;

        let url = self.build_url(
            "getTopSongs",
            &format!("artist={}&count=10", urlencoding::encode(&artist_name)),
        );

        // We need a model for getTopSongs response
        // Using generic Value or specific struct?
        // Let's use `TopSongsData` if it exists or create one?
        // Let's use generic Value for now or define a struct inline if simpler, but `models.rs` is separate.
        // Or reuse `SongData` list?
        // Let's add `TopSongsData` to models if not present, OR parse manually.
        // I'll check `models.rs` above. It has `SubsonicSong`.
        // Response format: `subsonic-response` -> `topSongs` -> `song` array.

        // I will use serde_json::Value for intermediate if needed, but better to be typed.
        // Since I can't easily edit models.rs and provider.rs simultaneously in one step safely if detailed, 
        // I will trust that `SubsonicResponse<TopSongsResult>` works if I define it?
        // I'll use `Value` to avoid modifying `models.rs` if possible to save steps, assume structure.
        
        let resp: Value = self.client.get(&url).send().await?.json().await?;
        // println!("DEBUG: {:?}", resp); 
        
        // Manual traversal: subsonic-response -> topSongs -> song (array)
        let binding = resp["subsonic-response"].clone();
        let top_songs = binding.get("topSongs").and_then(|t| t.get("song")).and_then(|s| s.as_array());

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
        
        let artist_full = resp.subsonic_response.data.ok_or(anyhow!("No data"))?.artist;
        
        let albums = artist_full.album.into_iter().map(|a| Album {
            id: format!("subsonic:{}", a.id),
            title: a.name,
            artist: a.artist.unwrap_or_default(),
            artist_id: a.artist_id.map(|id| format!("subsonic:{}", id)),
            cover_url: a.cover_art.map(|c| self.cover_art_url(&c, 640)),
            year: a.year.map(|y| y.to_string()),
            track_count: a.song_count,
            duration: a.duration,
        }).collect();

        Ok(albums)
    }

    async fn get_album_tracks(&self, album_id: &str) -> Result<Vec<Track>> {
        if !self.initialized {
            return Err(anyhow!("Subsonic provider not initialized"));
        }

        // getAlbum return Album with songs
        let url = self.build_url("getAlbum", &format!("id={}", album_id));
        let resp: SubsonicResponse<AlbumData> = self.client.get(&url).send().await?.json().await?;

        if resp.subsonic_response.status != "ok" {
            return Err(anyhow!("Subsonic error"));
        }

        let album_full = resp.subsonic_response.data.ok_or(anyhow!("No data"))?.album;
        
        let tracks = album_full.song.into_iter().map(|s| Track {
            id: format!("subsonic:{}", s.id),
            title: s.title,
            artist: s.artist.unwrap_or_default(),
            artist_id: s.artist_id.map(|id| format!("subsonic:{}", id)),
            album: s.album.unwrap_or_default(),
            album_id: s.album_id.map(|id| format!("subsonic:{}", id)),
            duration: s.duration.unwrap_or(0),
            cover_url: s.cover_art.map(|c| self.cover_art_url(&c, 640)),
        }).collect();

        Ok(tracks)
    }
}
