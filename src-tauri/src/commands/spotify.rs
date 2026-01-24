use crate::database::DatabaseManager;
use crate::providers::manager::ProviderManagerArc;
use crate::spotify::{
    models::{SpotifyPlaylistResult, VerificationProgress, VerifiedSpotifyTrack},
    romanize_japanese, SpotifyClient,
};
use crate::tidal::{get_cover_url, CoverSize, TidalClient};
use std::sync::Arc;
use tauri::{command, AppHandle, Emitter, State};

#[command]
pub async fn fetch_spotify_playlist(url_or_id: String) -> Result<SpotifyPlaylistResult, String> {
    let playlist_id = SpotifyClient::extract_playlist_id(&url_or_id).map_err(|e| e.to_string())?;

    let client = SpotifyClient::new().map_err(|e| e.to_string())?;

    client
        .fetch_playlist(&playlist_id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn verify_spotify_track(
    db: State<'_, DatabaseManager>,
    tidal: State<'_, TidalClient>,
    provider_manager: State<'_, Arc<ProviderManagerArc>>,
    title: String,
    artist: String,
) -> Result<VerifiedSpotifyTrack, String> {
    let priority = db.get_spotify_import_priority().await?;
    verify_track_internal(
        &tidal,
        &provider_manager,
        &priority,
        &title,
        &artist,
        None,
        None,
        None,
    )
    .await
}

#[command]
pub async fn verify_spotify_tracks(
    app: AppHandle,
    db: State<'_, DatabaseManager>,
    tidal: State<'_, TidalClient>,
    provider_manager: State<'_, Arc<ProviderManagerArc>>,
    tracks: Vec<crate::spotify::SpotifyTrack>,
) -> Result<Vec<VerifiedSpotifyTrack>, String> {
    let total = tracks.len();
    let mut verified = Vec::with_capacity(total);
    let mut found_count = 0;

    // Fetch priority list once for all tracks
    let priority = db.get_spotify_import_priority().await?;

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
            &provider_manager,
            &priority,
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

/// Verify a track against multiple providers in priority order.
/// Falls back through the priority list until a match is found or all providers are exhausted.
/// Verify a track against multiple providers in priority order.
/// Falls back through the priority list until a match is found or all providers are exhausted.
#[allow(clippy::too_many_arguments)]
async fn verify_track_internal(
    tidal: &TidalClient,
    provider_manager: &ProviderManagerArc,
    priority_list: &[String],
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

    // Try each provider in priority order
    for provider_id in priority_list {
        match provider_id.as_str() {
            "tidal" => {
                // Tidal-specific search with romanization support
                if let Some(result) =
                    try_tidal_match(tidal, &spotify_track, &query, title, artist).await
                {
                    return Ok(result);
                }
            }
            _ => {
                // Generic provider search (Subsonic, Jellyfin, etc.)
                if let Some(provider) = provider_manager.get_provider(provider_id).await {
                    if let Some(result) =
                        try_generic_provider_match(provider, &spotify_track, &query, title, artist)
                            .await
                    {
                        return Ok(result);
                    }
                } else {
                    log::debug!(
                        "Skipping provider {} (not found or not enabled)",
                        provider_id
                    );
                }
            }
        }
    }

    // No match found on any provider
    Ok(VerifiedSpotifyTrack {
        spotify: spotify_track,
        found: false,
        provider_id: None,
        external_id: None,
        artist_id: None,
        album_id: None,
        album_name: None,
        cover_url: None,
        used_romanization: false,
        status_message: Some("Not found on any provider".to_string()),
        // Legacy fields
        tidal_id: None,
        tidal_artist_id: None,
        tidal_album_id: None,
        tidal_album: None,
    })
}

/// Try to find a match on a generic provider (Subsonic, Jellyfin, etc.)
async fn try_generic_provider_match(
    provider: Arc<dyn crate::providers::traits::MusicProvider>,
    spotify_track: &crate::spotify::SpotifyTrack,
    query: &str,
    title: &str,
    artist: &str,
) -> Option<VerifiedSpotifyTrack> {
    log::debug!("Searching {} for: {}", provider.name(), query);

    match provider.search(query).await {
        Ok(results) => {
            // Check first few results for a good match
            for track in results.tracks.iter().take(5) {
                let track_artist = track.artist.to_lowercase();
                let spotify_artist_lower = artist.to_lowercase();
                let track_title = track.title.to_lowercase();
                let spotify_title_lower = title.to_lowercase();

                // Simple fuzzy match: check if artist match and title match
                let artist_match = track_artist.contains(&spotify_artist_lower)
                    || spotify_artist_lower.contains(&track_artist);
                let title_match = track_title.contains(&spotify_title_lower)
                    || spotify_title_lower.contains(&track_title);

                if artist_match && title_match {
                    let provider_id = provider.id().to_string();
                    let provider_name = provider.name().to_string();

                    return Some(VerifiedSpotifyTrack {
                        spotify: spotify_track.clone(),
                        found: true,
                        provider_id: Some(provider_id.clone()),
                        external_id: Some(track.id.clone()),
                        artist_id: track.artist_id.clone(),
                        album_id: track.album_id.clone(),
                        album_name: Some(track.album.clone()),
                        cover_url: track.cover_url.clone(),
                        used_romanization: false,
                        status_message: Some(format!("Found on {}", provider_name)),
                        // Legacy fields (empty for non-Tidal)
                        tidal_id: None,
                        tidal_artist_id: None,
                        tidal_album_id: None,
                        tidal_album: None,
                    });
                }
            }
        }
        Err(e) => {
            log::warn!("Search failed on {}: {}", provider.name(), e);
        }
    }

    None
}

/// Try to find a match on Tidal, including romanization fallback
async fn try_tidal_match(
    tidal: &TidalClient,
    spotify_track: &crate::spotify::SpotifyTrack,
    query: &str,
    title: &str,
    artist: &str,
) -> Option<VerifiedSpotifyTrack> {
    log::debug!("Searching Tidal for: {}", query);

    // Primary search
    if let Ok(result) = tidal.search_tracks(query).await {
        if let Some(track) = result.items.first() {
            return Some(build_tidal_verified_track(
                spotify_track.clone(),
                track,
                false,
                "Found on Tidal",
            ));
        }
    }

    // Romanization fallback for Japanese text
    let romanized_title = romanize_japanese(title);
    let romanized_artist = romanize_japanese(artist);

    if romanized_title.is_some() || romanized_artist.is_some() {
        let search_title = romanized_title.as_deref().unwrap_or(title);
        let search_artist = romanized_artist.as_deref().unwrap_or(artist);
        let query_romanized = format!("{} {}", search_artist, search_title);

        log::debug!("Trying romanized search: {}", query_romanized);

        if let Ok(result) = tidal.search_tracks(&query_romanized).await {
            if let Some(track) = result.items.first() {
                return Some(build_tidal_verified_track(
                    spotify_track.clone(),
                    track,
                    true,
                    "Found on Tidal (romanized)",
                ));
            }
        }
    }

    // Title-only search with artist fuzzy match
    if let Ok(result) = tidal.search_tracks(title).await {
        if let Some(track) = result.items.first() {
            let tidal_artist = track
                .artist
                .as_ref()
                .map(|a| a.name.to_lowercase())
                .unwrap_or_default();
            let spotify_artist = artist.to_lowercase();

            if tidal_artist.contains(&spotify_artist) || spotify_artist.contains(&tidal_artist) {
                return Some(build_tidal_verified_track(
                    spotify_track.clone(),
                    track,
                    false,
                    "Found on Tidal (partial match)",
                ));
            }
        }
    }

    None
}

/// Build a VerifiedSpotifyTrack from a Tidal search result
fn build_tidal_verified_track(
    spotify: crate::spotify::SpotifyTrack,
    track: &crate::tidal::Track,
    used_romanization: bool,
    status: &str,
) -> VerifiedSpotifyTrack {
    let cover_url = track
        .album
        .as_ref()
        .and_then(|a| a.cover.as_ref())
        .map(|c| get_cover_url(c, CoverSize::Large.px()));

    let artist_id = track.artist.as_ref().map(|a| a.id.to_string());
    let album_id = track.album.as_ref().map(|a| a.id.to_string());
    let album_name = track.album.as_ref().map(|a| a.title.clone());

    VerifiedSpotifyTrack {
        spotify,
        found: true,
        // New provider-agnostic fields
        provider_id: Some("tidal".to_string()),
        external_id: Some(track.id.to_string()),
        artist_id: artist_id.clone(),
        album_id: album_id.clone(),
        album_name: album_name.clone(),
        cover_url,
        used_romanization,
        status_message: Some(status.to_string()),
        // Legacy fields for backward compatibility
        tidal_id: Some(track.id),
        tidal_artist_id: track.artist.as_ref().map(|a| a.id),
        tidal_album_id: track.album.as_ref().map(|a| a.id),
        tidal_album: album_name,
    }
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
                banner: None,
            }),
            album: track.tidal_album_id.map(|id| crate::tidal::Album {
                id,
                title: track
                    .tidal_album
                    .clone()
                    .unwrap_or_else(|| track.spotify.album.clone()),
                cover: None,
                artist: None,
                artists: None,
                number_of_tracks: None,
                release_date: None,
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

        if let Ok(Some(track_id)) = playlist
            .find_track_id_by_external_id("tidal", &tidal_id.to_string())
            .await
        {
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
        errors: if errors.is_empty() {
            None
        } else {
            Some(errors)
        },
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

        // Use new provider-agnostic fields if available, fall back to legacy Tidal fields
        let (provider_id, external_id) = match (&track.provider_id, &track.external_id) {
            (Some(pid), Some(eid)) => (pid.clone(), eid.clone()),
            // Fallback to legacy Tidal fields for backward compatibility
            _ => match track.tidal_id {
                Some(tid) => ("tidal".to_string(), tid.to_string()),
                None => {
                    skipped += 1;
                    continue;
                }
            },
        };

        let artist_id = track
            .artist_id
            .clone()
            .or_else(|| track.tidal_artist_id.map(|id| id.to_string()));
        let album_id = track
            .album_id
            .clone()
            .or_else(|| track.tidal_album_id.map(|id| id.to_string()));
        let album_name = track
            .album_name
            .clone()
            .or_else(|| track.tidal_album.clone());

        // Use the new generic import function
        if let Err(e) = library
            .import_provider_track(
                &provider_id,
                &external_id,
                &track.spotify.title,
                &track.spotify.artist,
                artist_id.as_deref(),
                album_name.as_deref(),
                album_id.as_deref(),
                Some(track.spotify.duration_ms / 1000),
                track.cover_url.clone(),
            )
            .await
        {
            errors.push(format!(
                "{} - {}: {}",
                track.spotify.artist, track.spotify.title, e
            ));
            continue;
        }

        // Find the imported track and add to playlist
        if let Ok(Some(track_id)) = playlist
            .find_track_id_by_external_id(&provider_id, &external_id)
            .await
        {
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
                "{} - {}: Failed to find imported track in database",
                track.spotify.artist, track.spotify.title
            ));
        }
    }

    Ok(AddTracksResult {
        added,
        skipped,
        errors: if errors.is_empty() {
            None
        } else {
            Some(errors)
        },
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
