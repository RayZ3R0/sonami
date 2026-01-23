use crate::models::{Album, Artist, Playlist, Quality, SearchResults, StreamInfo, Track};
use crate::providers::traits::MusicProvider;
use crate::tidal::client::TidalClient;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::Value;

pub struct TidalProvider {
    client: TidalClient,
}

impl TidalProvider {
    pub async fn new() -> Result<Self> {
        let client = TidalClient::new()
            .await
            .map_err(|e| anyhow!(e.to_string()))?;
        Ok(Self { client })
    }
}

#[async_trait]
impl MusicProvider for TidalProvider {
    fn id(&self) -> &str {
        "tidal"
    }

    fn name(&self) -> &str {
        "Tidal"
    }

    async fn initialize(&mut self, _config: Value) -> Result<()> {
        // Config handling could be added here if we want to re-init
        Ok(())
    }

    async fn search(&self, query: &str) -> Result<SearchResults> {
        let tracks_res = self
            .client
            .search_tracks(query)
            .await
            .map_err(|e| anyhow!(e.to_string()))?;
        let albums_res = self
            .client
            .search_albums(query)
            .await
            .map_err(|e| anyhow!(e.to_string()))?;
        let artists_res = self
            .client
            .search_artists(query)
            .await
            .map_err(|e| anyhow!(e.to_string()))?;
        let playlists_res = self
            .client
            .search_playlists(query)
            .await
            .map_err(|e| anyhow!(e.to_string()))?;

        let tracks: Vec<Track> = tracks_res
            .items
            .into_iter()
            .map(|t| Track {
                id: format!("tidal:{}", t.id),
                title: t.title,
                artist: t
                    .artist
                    .as_ref()
                    .map(|a| a.name.clone())
                    .unwrap_or_default(),
                artist_id: t.artist.as_ref().map(|a| format!("tidal:{}", a.id)),
                album: t
                    .album
                    .as_ref()
                    .map(|a| a.title.clone())
                    .unwrap_or_default(),
                album_id: t.album.as_ref().map(|a| format!("tidal:{}", a.id)),
                duration: t.duration.unwrap_or(0) as u64,
                cover_url: t.cover
                    .or_else(|| t.album.as_ref().and_then(|a| a.cover.clone()))
                    .map(|c| crate::tidal::models::get_cover_url(&c, 640)),
            })
            .collect();

        let albums: Vec<Album> = albums_res
            .items
            .into_iter()
            .map(|a| Album {
                id: format!("tidal:{}", a.id),
                title: a.title,
                artist: a
                    .artist
                    .as_ref()
                    .map(|ar| ar.name.clone())
                    .unwrap_or_default(),
                artist_id: a.artist.as_ref().map(|ar| format!("tidal:{}", ar.id)),
                cover_url: a
                    .cover
                    .map(|c| crate::tidal::models::get_cover_url(&c, 640)),
                year: None,
                track_count: a.number_of_tracks,
                duration: None, // Tidal search doesn't return album duration
            })
            .collect();

        let artists: Vec<Artist> = artists_res
            .items
            .into_iter()
            .map(|a| Artist {
                id: format!("tidal:{}", a.id),
                name: a.name,
                cover_url: a
                    .picture
                    .map(|p| crate::tidal::models::get_cover_url(&p, 640)),
                banner: a.banner.map(|b| crate::tidal::models::get_cover_url(&b, 1280)),
            })
            .collect();


        let playlists: Vec<Playlist> = playlists_res
            .items
            .into_iter()
            .map(|p| Playlist {
                id: p.id,
                title: p.title,
                description: p.description,
                cover_url: p
                    .cover
                    .map(|c| crate::tidal::models::get_cover_url(&c, 640)),
                track_count: p.number_of_tracks.unwrap_or(0),
            })
            .collect();

        Ok(SearchResults {
            tracks,
            albums,
            artists,
            playlists,
        })
    }

    async fn get_stream_url(&self, track_id: &str, quality: Quality) -> Result<StreamInfo> {
        let tid = track_id
            .parse::<u64>()
            .map_err(|_| anyhow!("Invalid Tidal ID"))?;
        // Map generic Quality to Tidal Quality
        let tidal_quality = match quality {
            Quality::LOW => crate::tidal::Quality::LOW,
            Quality::HIGH => crate::tidal::Quality::HIGH,
            Quality::LOSSLESS => crate::tidal::Quality::LOSSLESS,
        };

        let info = self
            .client
            .get_track(tid, tidal_quality)
            .await
            .map_err(|e| anyhow!(e.to_string()))?;

        Ok(StreamInfo {
            url: info.url,
            quality,
            codec: info.codec,
        })
    }

    async fn get_track_details(&self, track_id: &str) -> Result<Track> {
        let tid = track_id
            .parse::<u64>()
            .map_err(|_| anyhow!("Invalid Tidal ID"))?;
        let _t = self
            .client
            .get_track(tid, crate::tidal::Quality::LOW)
            .await
            .map_err(|e| anyhow!(e.to_string()))?;
        // Wait, get_track returns StreamInfo. Does get_track return Metadata?
        // Checking client.rs... get_track returns TrackStreamInfo.
        // There is no get_track_metadata in client.rs?
        // In client.rs:
        // pub async fn get_track(...) -> Result<TrackStreamInfo, ...>
        // It seems `get_track` is for streaming.
        // `search_tracks` returns `Track` models.
        // Is there a way to get metadata for a single track?
        // I might need to implement `get_track_metadata` in `TidalClient` or use `get_album_tracks` if I know the album.
        // Let's assume for now I can't easily get single track metadata without adding a method to TidalClient.
        // I will check `TidalClient` again. It has `get_album`, `get_artist`.
        // It does NOT have `get_track_metadata`.
        // I should probably add `get_track_metadata` to `TidalClient` first.
        // "get_track" endpoint at "/track/" usually returns metadata if you don't pass quality? OR maybe the metadata is in the stream response?
        // `get_track` in client.rs calls `/track/` with id and quality.
        // The response parsing seems focused on stream URL.

        // I will stub this for now or implement it properly.
        // To be "Industry Grade", I should implement `get_track_metadata` in `TidalClient`.

        Err(anyhow!("get_track_details not implemented for Tidal yet"))
    }

    async fn get_artist_details(&self, artist_id: &str) -> Result<Artist> {
        let aid = artist_id
            .parse::<u64>()
            .map_err(|_| anyhow!("Invalid Tidal ID"))?;
        let a = self
            .client
            .get_artist(aid)
            .await
            .map_err(|e| anyhow!(e.to_string()))?;
        Ok(Artist {
            id: format!("tidal:{}", a.id),
            name: a.name,
            cover_url: a
                .picture
                .map(|p| crate::tidal::models::get_cover_url(&p, 640)),
            banner: a.banner.map(|b| crate::tidal::models::get_cover_url(&b, 1280)),
        })
    }

    async fn get_album_details(&self, album_id: &str) -> Result<Album> {
        let aid = album_id
            .parse::<u64>()
            .map_err(|_| anyhow!("Invalid Tidal ID"))?;
        let a = self
            .client
            .get_album(aid)
            .await
            .map_err(|e| anyhow!(e.to_string()))?;
        Ok(Album {
            id: format!("tidal:{}", a.id),
            title: a.title,
            artist: a
                .artist
                .as_ref()
                .map(|ar| ar.name.clone())
                .unwrap_or_default(),
            artist_id: a.artist.as_ref().map(|ar| format!("tidal:{}", ar.id)),
            cover_url: a
                .cover
                .map(|c| crate::tidal::models::get_cover_url(&c, 640)),
            year: a.release_date.map(|d| d.chars().take(4).collect()),
            track_count: a.number_of_tracks,
            duration: None, 
        })
    }

    async fn get_artist_top_tracks(&self, artist_id: &str) -> Result<Vec<Track>> {
        let aid = artist_id
            .parse::<u64>()
            .map_err(|_| anyhow!("Invalid Tidal ID"))?;
        
        // Fetch artist info first so we can inject it into tracks
        let artist_info = self
            .client
            .get_artist(aid)
            .await
            .map_err(|e| anyhow!(e.to_string()))?;
        
        let tracks_res = self
            .client
            .get_artist_top_tracks(aid)
            .await
            .map_err(|e| anyhow!(e.to_string()))?;

        let tracks: Vec<Track> = tracks_res
            .into_iter()
            .map(|t| {
                // Use track's artist if available, otherwise inject the fetched artist
                let (artist_name, track_artist_id) = if let Some(ref a) = t.artist {
                    (a.name.clone(), Some(format!("tidal:{}", a.id)))
                } else {
                    (artist_info.name.clone(), Some(format!("tidal:{}", artist_info.id)))
                };
                
                Track {
                    id: format!("tidal:{}", t.id),
                    title: t.title,
                    artist: artist_name,
                    artist_id: track_artist_id,
                    album: t
                        .album
                        .as_ref()
                        .map(|a| a.title.clone())
                        .unwrap_or_default(),
                    album_id: t.album.as_ref().map(|a| format!("tidal:{}", a.id)),
                    duration: t.duration.unwrap_or(0) as u64,
                    cover_url: t.album.as_ref().and_then(|a| {
                        a.cover
                            .as_ref()
                            .map(|c| crate::tidal::models::get_cover_url(c, 640))
                    }),
                }
            })
            .collect();

        Ok(tracks)
    }

    async fn get_artist_albums(&self, artist_id: &str) -> Result<Vec<Album>> {
        let aid = artist_id
            .parse::<u64>()
            .map_err(|_| anyhow!("Invalid Tidal ID"))?;
        let albums_res = self
            .client
            .get_artist_albums(aid)
            .await
            .map_err(|e| anyhow!(e.to_string()))?;

        let albums: Vec<Album> = albums_res
            .into_iter()
            .map(|a| Album {
                id: format!("tidal:{}", a.id),
                title: a.title,
                artist: a
                    .artist
                    .as_ref()
                    .map(|ar| ar.name.clone())
                    .unwrap_or_default(),
                artist_id: a.artist.as_ref().map(|ar| format!("tidal:{}", ar.id)),
                cover_url: a
                    .cover
                    .map(|c| crate::tidal::models::get_cover_url(&c, 640)),
                year: a.release_date.map(|d| d.chars().take(4).collect()),
                track_count: a.number_of_tracks,
                duration: None,
            })
            .collect();
        Ok(albums)
    }

    async fn get_album_tracks(&self, album_id: &str) -> Result<Vec<Track>> {
        let aid = album_id
            .parse::<u64>()
            .map_err(|_| anyhow!("Invalid Tidal ID"))?;
        let tracks_res = self
            .client
            .get_album_tracks(aid)
            .await
            .map_err(|e| anyhow!(e.to_string()))?;

        let tracks: Vec<Track> = tracks_res
            .into_iter()
            .map(|t| Track {
                id: format!("tidal:{}", t.id),
                title: t.title,
                artist: t
                    .artist
                    .as_ref()
                    .map(|a| a.name.clone())
                    .unwrap_or_default(),
                artist_id: t.artist.as_ref().map(|a| format!("tidal:{}", a.id)),
                album: t
                    .album
                    .as_ref()
                    .map(|a| a.title.clone())
                    .unwrap_or_default(),
                album_id: t.album.as_ref().map(|a| format!("tidal:{}", a.id)),
                duration: t.duration.unwrap_or(0) as u64,
                cover_url: t.album.as_ref().and_then(|a| {
                    a.cover
                        .as_ref()
                        .map(|c| crate::tidal::models::get_cover_url(c, 640))
                }),
            })
            .collect();

        Ok(tracks)
    }
}
