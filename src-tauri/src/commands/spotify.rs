use crate::spotify::{
    models::{SpotifyPlaylistResult, VerificationProgress, VerifiedSpotifyTrack},
    romanize_japanese, SpotifyClient,
};
use crate::tidal::{get_cover_url, CoverSize, TidalClient};
use tauri::{command, AppHandle, Emitter, State};


#[command]
pub async fn fetch_spotify_playlist(url_or_id: String) -> Result<SpotifyPlaylistResult, String> {
    let playlist_id =
        SpotifyClient::extract_playlist_id(&url_or_id).map_err(|e| e.to_string())?;

    let client = SpotifyClient::new().map_err(|e| e.to_string())?;

    client
        .fetch_playlist(&playlist_id)
        .await
        .map_err(|e| e.to_string())
}



#[command]
pub async fn verify_spotify_track(
    tidal: State<'_, TidalClient>,
    title: String,
    artist: String,
) -> Result<VerifiedSpotifyTrack, String> {
    verify_track_internal(&tidal, &title, &artist, None, None, None).await
}



#[command]
pub async fn verify_spotify_tracks(
    app: AppHandle,
    tidal: State<'_, TidalClient>,
    tracks: Vec<crate::spotify::SpotifyTrack>,
) -> Result<Vec<VerifiedSpotifyTrack>, String> {
    let total = tracks.len();
    let mut verified = Vec::with_capacity(total);
    let mut found_count = 0;

    for (i, track) in tracks.into_iter().enumerate() {
        
        let progress = VerificationProgress {
            current: i + 1,
            total,
            current_track: format!("{} - {}", track.artist, track.title),
            found_count,
        };
        let _ = app.emit("spotify-import-progress", progress);

        let result = verify_track_internal(
            &tidal,
            &track.title,
            &track.artist,
            Some(&track.album),
            Some(track.duration_ms as u64),
            None, 
        )
        .await?;

        if result.found {
            found_count += 1;
        }

        verified.push(result);

        
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    
    let _ = app.emit(
        "spotify-import-progress",
        VerificationProgress {
            current: total,
            total,
            current_track: "Complete".to_string(),
            found_count,
        },
    );

    Ok(verified)
}


async fn verify_track_internal(
    tidal: &TidalClient,
    title: &str,
    artist: &str,
    album: Option<&str>,
    duration_ms: Option<u64>,
    _spotify_id: Option<String>,
) -> Result<VerifiedSpotifyTrack, String> {
    let spotify_track = crate::spotify::SpotifyTrack {
        title: title.to_string(),
        artist: artist.to_string(),
        album: album.unwrap_or("").to_string(),
        duration_ms: duration_ms.unwrap_or(0) as u32,
        isrc: String::new(),
    };

    
    let query = format!("{} {}", artist, title);
    log::debug!("Searching Tidal for: {}", query);

    if let Ok(result) = tidal.search_tracks(&query).await {
        if let Some(track) = result.items.first() {
            let cover_url = track
                .album
                .as_ref()
                .and_then(|a| a.cover.as_ref())
                .map(|c| get_cover_url(c, CoverSize::Large.px()));

            return Ok(VerifiedSpotifyTrack {
                spotify: spotify_track,
                found: true,
                tidal_id: Some(track.id),
                tidal_artist_id: track.artist.as_ref().map(|a| a.id),
                tidal_album_id: track.album.as_ref().map(|a| a.id),
                tidal_album: track.album.as_ref().map(|a| a.title.clone()),
                cover_url,
                used_romanization: false,
                status_message: Some("Found on Tidal".to_string()),
            });
        }
    }

    
    let romanized_title = romanize_japanese(title);
    let romanized_artist = romanize_japanese(artist);

    if romanized_title.is_some() || romanized_artist.is_some() {
        let search_title = romanized_title.as_deref().unwrap_or(title);
        let search_artist = romanized_artist.as_deref().unwrap_or(artist);
        let query_romanized = format!("{} {}", search_artist, search_title);

        log::debug!("Trying romanized search: {}", query_romanized);

        if let Ok(result) = tidal.search_tracks(&query_romanized).await {
            if let Some(track) = result.items.first() {
                let cover_url = track
                    .album
                    .as_ref()
                    .and_then(|a| a.cover.as_ref())
                    .map(|c| get_cover_url(c, CoverSize::Large.px()));

                return Ok(VerifiedSpotifyTrack {
                    spotify: spotify_track,
                    found: true,
                    tidal_id: Some(track.id),
                    tidal_artist_id: track.artist.as_ref().map(|a| a.id),
                    tidal_album_id: track.album.as_ref().map(|a| a.id),
                    tidal_album: track.album.as_ref().map(|a| a.title.clone()),
                    cover_url,
                    used_romanization: true,
                    status_message: Some("Found via romanization".to_string()),
                });
            }
        }
    }

    
    if let Ok(result) = tidal.search_tracks(title).await {
        if let Some(track) = result.items.first() {
            
            let tidal_artist = track
                .artist
                .as_ref()
                .map(|a| a.name.to_lowercase())
                .unwrap_or_default();
            let spotify_artist = artist.to_lowercase();

            if tidal_artist.contains(&spotify_artist) || spotify_artist.contains(&tidal_artist) {
                let cover_url = track
                    .album
                    .as_ref()
                    .and_then(|a| a.cover.as_ref())
                    .map(|c| get_cover_url(c, CoverSize::Large.px()));

                return Ok(VerifiedSpotifyTrack {
                    spotify: spotify_track,
                    found: true,
                    tidal_id: Some(track.id),
                    tidal_artist_id: track.artist.as_ref().map(|a| a.id),
                    tidal_album_id: track.album.as_ref().map(|a| a.id),
                    tidal_album: track.album.as_ref().map(|a| a.title.clone()),
                    cover_url,
                    used_romanization: false,
                    status_message: Some("Found with partial artist match".to_string()),
                });
            }
        }
    }

    
    Ok(VerifiedSpotifyTrack {
        spotify: spotify_track,
        found: false,
        tidal_id: None,
        tidal_artist_id: None,
        tidal_album_id: None,
        tidal_album: None,
        cover_url: None,
        used_romanization: romanized_title.is_some() || romanized_artist.is_some(),
        status_message: Some("Not found on Tidal".to_string()),
    })
}


#[command]
pub async fn add_spotify_tracks_to_playlist(
    library: State<'_, crate::library::LibraryManager>,
    playlist: State<'_, crate::playlist::PlaylistManager>,
    playlist_id: String,
    tracks: Vec<VerifiedSpotifyTrack>,
) -> Result<AddTracksResult, String> {
    let mut added = 0;
    let mut skipped = 0;
    let mut errors = Vec::new();

    for track in tracks {
        if !track.found {
            skipped += 1;
            continue;
        }

        let tidal_id = match track.tidal_id {
            Some(id) => id,
            None => {
                skipped += 1;
                continue;
            }
        };

        
        let tidal_track = crate::tidal::Track {
            id: tidal_id,
            title: track.spotify.title.clone(),
            artist: track.tidal_artist_id.map(|id| crate::tidal::Artist {
                id,
                name: track.spotify.artist.clone(),
                picture: None,
            }),
            album: track.tidal_album_id.map(|id| crate::tidal::Album {
                id,
                title: track.tidal_album.clone().unwrap_or_else(|| track.spotify.album.clone()),
                cover: None,
                artist: None,
                number_of_tracks: None,
            }),
            duration: Some(track.spotify.duration_ms / 1000),
            audio_quality: None,
            cover: None,
            track_number: None,
        };

        
        if let Err(e) = library
            .import_tidal_track(&tidal_track, track.cover_url)
            .await
        {
            errors.push(format!("{} - {}: {}", track.spotify.artist, track.spotify.title, e));
            continue;
        }

        
        if let Ok(Some(track_id)) = playlist.find_track_id_by_tidal_id(tidal_id).await {
            if let Err(e) = playlist.add_track_entry(&playlist_id, &track_id).await {
                errors.push(format!(
                    "{} - {}: {}",
                    track.spotify.artist, track.spotify.title, e
                ));
            } else {
                added += 1;
            }
        } else {
            errors.push(format!(
                "{} - {}: Failed to find imported track",
                track.spotify.artist, track.spotify.title
            ));
        }
    }

    Ok(AddTracksResult {
        added,
        skipped,
        errors: if errors.is_empty() { None } else { Some(errors) },
    })
}


#[command]
pub async fn create_playlist_from_spotify(
    library: State<'_, crate::library::LibraryManager>,
    playlist_manager: State<'_, crate::playlist::PlaylistManager>,
    name: String,
    description: Option<String>,
    tracks: Vec<VerifiedSpotifyTrack>,
) -> Result<CreatePlaylistResult, String> {
    
    let playlist = playlist_manager
        .create_playlist(name, description)
        .await
        .map_err(|e| e.to_string())?;

    
    let add_result =
        add_spotify_tracks_internal(&library, &playlist_manager, &playlist.id, tracks).await?;

    Ok(CreatePlaylistResult {
        playlist_id: playlist.id,
        playlist_title: playlist.title,
        tracks_added: add_result.added,
        tracks_skipped: add_result.skipped,
        errors: add_result.errors,
    })
}


async fn add_spotify_tracks_internal(
    library: &crate::library::LibraryManager,
    playlist: &crate::playlist::PlaylistManager,
    playlist_id: &str,
    tracks: Vec<VerifiedSpotifyTrack>,
) -> Result<AddTracksResult, String> {
    let mut added = 0;
    let mut skipped = 0;
    let mut errors = Vec::new();

    for track in tracks {
        if !track.found {
            skipped += 1;
            continue;
        }

        let tidal_id = match track.tidal_id {
            Some(id) => id,
            None => {
                skipped += 1;
                continue;
            }
        };

        let tidal_track = crate::tidal::Track {
            id: tidal_id,
            title: track.spotify.title.clone(),
            artist: track.tidal_artist_id.map(|id| crate::tidal::Artist {
                id,
                name: track.spotify.artist.clone(),
                picture: None,
            }),
            album: track.tidal_album_id.map(|id| crate::tidal::Album {
                id,
                title: track.tidal_album.unwrap_or_else(|| track.spotify.album.clone()),
                cover: None,
                artist: None,
                number_of_tracks: None,
            }),
            duration: Some(track.spotify.duration_ms / 1000),
            audio_quality: None,
            cover: None,
            track_number: None,
        };

        if let Err(e) = library
            .import_tidal_track(&tidal_track, track.cover_url)
            .await
        {
            errors.push(format!(
                "{} - {}: {}",
                track.spotify.artist, track.spotify.title, e
            ));
            continue;
        }

        if let Ok(Some(track_id)) = playlist.find_track_id_by_tidal_id(tidal_id).await {
            if let Err(e) = playlist.add_track_entry(playlist_id, &track_id).await {
                errors.push(format!(
                    "{} - {}: {}",
                    track.spotify.artist, track.spotify.title, e
                ));
            } else {
                added += 1;
            }
        } else {
            errors.push(format!(
                "{} - {}: Failed to find imported track",
                track.spotify.artist, track.spotify.title
            ));
        }
    }

    Ok(AddTracksResult {
        added,
        skipped,
        errors: if errors.is_empty() { None } else { Some(errors) },
    })
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AddTracksResult {
    pub added: usize,
    pub skipped: usize,
    pub errors: Option<Vec<String>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CreatePlaylistResult {
    pub playlist_id: String,
    pub playlist_title: String,
    pub tracks_added: usize,
    pub tracks_skipped: usize,
    pub errors: Option<Vec<String>>,
}
