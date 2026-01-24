use crate::errors::AppError;
use crate::providers::types::ProviderId;
use tauri::{AppHandle, Emitter, Manager, State};

pub mod download;
pub mod favorites;
pub mod history;
pub mod library;
pub mod playlist;
pub mod providers;
pub mod spotify;

use crate::audio::AudioManager;
use crate::library::LibraryManager;
use crate::models::SearchResults;
use crate::providers::ProviderManager;
use base64::{engine::general_purpose, Engine as _};
use lofty::picture::MimeType;
use lofty::prelude::*;
use lofty::probe::Probe;
use serde::Serialize;
use std::fs;
use std::path::Path;

const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "ogg", "m4a", "aac", "wma", "aiff", "ape", "opus", "webm",
];

use crate::queue::Track;

fn parse_audio_file(path_str: &str) -> Option<Track> {
    let path = Path::new(path_str);

    let tagged_file = match Probe::open(path).and_then(|p| p.read()) {
        Ok(f) => f,
        Err(_) => return None,
    };

    let tag = tagged_file.primary_tag();

    let title = tag
        .as_ref()
        .and_then(|t| t.title().map(|c| c.into_owned()))
        .unwrap_or_else(|| {
            path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown Title")
                .to_string()
        });
    let artist = tag
        .as_ref()
        .and_then(|t| t.artist().map(|c| c.into_owned()))
        .unwrap_or_else(|| "Unknown Artist".to_string());
    let album = tag
        .as_ref()
        .and_then(|t| t.album().map(|c| c.into_owned()))
        .unwrap_or_else(|| "Unknown Album".to_string());

    let duration = tagged_file.properties().duration().as_secs();

    let mut cover_image = None;
    if let Some(t) = tag {
        if let Some(picture) = t.pictures().first() {
            let b64 = general_purpose::STANDARD.encode(picture.data());
            let mime = picture.mime_type();
            let mime_type = mime.unwrap_or(&MimeType::Jpeg);
            let mime_str = match mime_type {
                MimeType::Png => "image/png",
                MimeType::Jpeg => "image/jpeg",
                MimeType::Tiff => "image/tiff",
                MimeType::Bmp => "image/bmp",
                MimeType::Gif => "image/gif",
                _ => "application/octet-stream",
            };
            cover_image = Some(format!("data:{};base64,{}", mime_str, b64));
        }
    }

    Some(Track {
        id: uuid::Uuid::new_v4().to_string(),
        title,
        artist,
        artist_id: None,
        album,
        album_id: None,
        duration,
        cover_image,
        path: path_str.to_string(),
        provider_id: Some("local".to_string()),
        external_id: None,
    })
}

fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn scan_directory(dir: &Path, tracks: &mut Vec<Track>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_directory(&path, tracks);
            } else if is_audio_file(&path) {
                if let Some(path_str) = path.to_str() {
                    if let Some(track) = parse_audio_file(path_str) {
                        tracks.push(track);
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub async fn import_music(app: AppHandle) -> Result<Vec<Track>, String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app.dialog().file().blocking_pick_file();

    if let Some(path_buf) = file_path {
        let path_str = path_buf.to_string();
        if let Some(track) = parse_audio_file(&path_str) {
            Ok(vec![track])
        } else {
            Err("Failed to parse audio file".to_string())
        }
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn import_folder(app: AppHandle) -> Result<Vec<Track>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder_path = app.dialog().file().blocking_pick_folder();

    if let Some(path_buf) = folder_path {
        let path_str = path_buf.to_string();
        let path = Path::new(&path_str);

        let mut tracks = Vec::new();
        scan_directory(path, &mut tracks);

        tracks.sort_by(|a, b| {
            a.artist
                .cmp(&b.artist)
                .then_with(|| a.album.cmp(&b.album))
                .then_with(|| a.title.cmp(&b.title))
        });

        Ok(tracks)
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn play_track(
    app: AppHandle,
    state: State<'_, AudioManager>,
    discord_rpc: State<'_, crate::discord::DiscordRpcManager>,
    path: String,
) -> Result<(), String> {
    log::info!("[Command] play_track called with path: {}", path);

    let resolved = crate::audio::resolver::resolve_uri(&app, &path).await?;

    state.play(resolved.path.clone());

    let _ = app.emit("playback-quality-changed", resolved);

    let track = {
        let q = state.queue.read();
        q.tracks.iter().find(|t| t.path == path).cloned()
    };

    if let Some(ref t) = track {
        let _ = app.emit("track-changed", t.clone());
        state.media_controls.set_metadata(
            &t.title,
            &t.artist,
            &t.album,
            t.cover_image.as_deref(),
            t.duration as f64,
        );
        state.media_controls.set_playback(true, Some(0.0));

        discord_rpc.set_playing(
            crate::discord::TrackInfo {
                title: t.title.clone(),
                artist: t.artist.clone(),
                album: t.album.clone(),
                duration_secs: t.duration,
                cover_url: t.cover_image.clone(),
            },
            0,
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn pause_track(
    state: State<'_, AudioManager>,
    discord_rpc: State<'_, crate::discord::DiscordRpcManager>,
) -> Result<(), String> {
    state.pause();
    let position = state.get_position();
    state.media_controls.set_playback(false, Some(position));

    let track = state.queue.read().get_current_track();
    if let Some(ref t) = track {
        discord_rpc.set_paused(
            crate::discord::TrackInfo {
                title: t.title.clone(),
                artist: t.artist.clone(),
                album: t.album.clone(),
                duration_secs: t.duration,
                cover_url: t.cover_image.clone(),
            },
            position as u64,
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn resume_track(
    state: State<'_, AudioManager>,
    discord_rpc: State<'_, crate::discord::DiscordRpcManager>,
) -> Result<(), String> {
    state.resume();
    let position = state.get_position();
    state.media_controls.set_playback(true, Some(position));

    let track = state.queue.read().get_current_track();
    if let Some(ref t) = track {
        discord_rpc.set_playing(
            crate::discord::TrackInfo {
                title: t.title.clone(),
                artist: t.artist.clone(),
                album: t.album.clone(),
                duration_secs: t.duration,
                cover_url: t.cover_image.clone(),
            },
            position as u64,
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn seek_track(state: State<'_, AudioManager>, position: f64) -> Result<(), String> {
    state.seek(position);
    Ok(())
}

#[tauri::command]
pub async fn set_volume(
    state: State<'_, AudioManager>,
    db: State<'_, crate::database::DatabaseManager>,
    volume: f32,
) -> Result<(), String> {
    state.set_volume(volume);
    let _ = db.set_setting("player_volume", &volume.to_string()).await;
    Ok(())
}

#[tauri::command]
pub async fn get_position(state: State<'_, AudioManager>) -> Result<f64, String> {
    Ok(state.get_position())
}

#[tauri::command]
pub async fn get_duration(state: State<'_, AudioManager>) -> Result<f64, String> {
    Ok(state.get_duration())
}

#[tauri::command]
pub async fn get_is_playing(state: State<'_, AudioManager>) -> Result<bool, String> {
    Ok(state.is_playing())
}

use crate::queue::RepeatMode;

#[tauri::command]
pub async fn set_queue(state: State<'_, AudioManager>, tracks: Vec<Track>) -> Result<(), String> {
    state.queue.write().set_tracks(tracks);
    Ok(())
}

#[tauri::command]
pub async fn add_to_queue(state: State<'_, AudioManager>, track: Track) -> Result<(), String> {
    state.queue.write().add_to_queue(track);
    Ok(())
}

#[tauri::command]
pub async fn clear_queue(state: State<'_, AudioManager>) -> Result<(), String> {
    state.queue.write().clear_queue();
    Ok(())
}

#[tauri::command]
pub async fn toggle_shuffle(
    state: State<'_, AudioManager>,
    db: State<'_, crate::database::DatabaseManager>,
) -> Result<bool, String> {
    let shuffle_state = {
        let mut q = state.queue.write();
        q.toggle_shuffle();
        q.shuffle
    };
    let _ = db.set_setting("player_shuffle", &shuffle_state.to_string()).await;
    Ok(shuffle_state)
}

#[tauri::command]
pub async fn set_repeat_mode(
    state: State<'_, AudioManager>,
    db: State<'_, crate::database::DatabaseManager>,
    mode: RepeatMode,
) -> Result<(), String> {
    state.queue.write().repeat = mode;
    let mode_str = match mode {
        RepeatMode::Off => "off",
        RepeatMode::All => "all",
        RepeatMode::One => "one",
    };
    let _ = db.set_setting("player_repeat", mode_str).await;
    Ok(())
}

#[tauri::command]
pub async fn next_track(
    app: AppHandle,
    state: State<'_, AudioManager>,
    discord_rpc: State<'_, crate::discord::DiscordRpcManager>,
) -> Result<(), String> {
    let next_track = {
        let mut q = state.queue.write();
        q.get_next_track(true)
    };

    if let Some(ref track) = next_track {
        match crate::audio::resolver::resolve_uri(&app, &track.path).await {
            Ok(resolved) => {
                state.play(resolved.path.clone());
                let _ = app.emit("playback-quality-changed", resolved);
            }
            Err(e) => return Err(e),
        }

        let _ = app.emit("track-changed", track.clone());
        state.media_controls.set_metadata(
            &track.title,
            &track.artist,
            &track.album,
            track.cover_image.as_deref(),
            track.duration as f64,
        );
        state.media_controls.set_playback(true, Some(0.0));

        discord_rpc.set_playing(
            crate::discord::TrackInfo {
                title: track.title.clone(),
                artist: track.artist.clone(),
                album: track.album.clone(),
                duration_secs: track.duration,
                cover_url: track.cover_image.clone(),
            },
            0,
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn prev_track(
    app: AppHandle,
    state: State<'_, AudioManager>,
    discord_rpc: State<'_, crate::discord::DiscordRpcManager>,
) -> Result<(), String> {
    let prev_track = {
        let mut q = state.queue.write();
        q.get_prev_track()
    };

    if let Some(ref track) = prev_track {
        match crate::audio::resolver::resolve_uri(&app, &track.path).await {
            Ok(resolved) => {
                state.play(resolved.path.clone());
                let _ = app.emit("playback-quality-changed", resolved);
            }
            Err(e) => return Err(e),
        }

        let _ = app.emit("track-changed", track.clone());
        state.media_controls.set_metadata(
            &track.title,
            &track.artist,
            &track.album,
            track.cover_image.as_deref(),
            track.duration as f64,
        );
        state.media_controls.set_playback(true, Some(0.0));

        discord_rpc.set_playing(
            crate::discord::TrackInfo {
                title: track.title.clone(),
                artist: track.artist.clone(),
                album: track.album.clone(),
                duration_secs: track.duration,
                cover_url: track.cover_image.clone(),
            },
            0,
        );
    }
    Ok(())
}

#[derive(Serialize)]
pub struct PlaybackInfo {
    pub position: f64,
    pub duration: f64,
    pub is_playing: bool,
}

#[tauri::command]
pub async fn get_playback_info(state: State<'_, AudioManager>) -> Result<PlaybackInfo, String> {
    Ok(PlaybackInfo {
        position: state.get_position(),
        duration: state.get_duration(),
        is_playing: state.is_playing(),
    })
}

#[tauri::command]
pub async fn get_current_track(state: State<'_, AudioManager>) -> Result<Option<Track>, String> {
    Ok(state.queue.read().get_current_track())
}

#[tauri::command]
pub async fn get_queue(state: State<'_, AudioManager>) -> Result<Vec<Track>, String> {
    Ok(state.queue.read().tracks.clone())
}

#[tauri::command]
pub async fn get_shuffle_mode(state: State<'_, AudioManager>) -> Result<bool, String> {
    Ok(state.queue.read().shuffle)
}

#[tauri::command]
pub async fn get_repeat_mode(state: State<'_, AudioManager>) -> Result<RepeatMode, String> {
    Ok(state.queue.read().repeat)
}

#[tauri::command]
pub async fn get_crossfade_duration(state: State<'_, AudioManager>) -> Result<u32, String> {
    Ok(state
        .crossfade_duration_ms
        .load(std::sync::atomic::Ordering::Relaxed))
}

#[tauri::command]
pub async fn set_crossfade_duration(
    state: State<'_, AudioManager>,
    duration_ms: u32,
) -> Result<(), String> {
    let clamped = duration_ms.min(12000);
    state
        .crossfade_duration_ms
        .store(clamped, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}

use crate::lyrics;

#[tauri::command]
pub async fn get_lyrics(
    db: State<'_, crate::database::DatabaseManager>,
    path: String,
    title: String,
    artist: String,
    album: String,
    duration: f64,
    provider: String, // "netease" or "lrclib"
) -> Result<Option<lyrics::LyricsResult>, String> {
    Ok(lyrics::get_lyrics(
        if path.is_empty() { None } else { Some(path) },
        &title,
        &artist,
        &album,
        duration,
        &provider,
        db,
    )
    .await)
}

#[tauri::command]
pub async fn play_stream(
    app: AppHandle,
    state: State<'_, AudioManager>,
    discord_rpc: State<'_, crate::discord::DiscordRpcManager>,
    url: String,
) -> Result<(), String> {
    let track = Track {
        id: "stream".to_string(),
        title: "Network Stream".to_string(),
        artist: "Tidal".to_string(),
        artist_id: None,
        album: "Unknown".to_string(),
        album_id: None,
        duration: 0,
        cover_image: None,
        path: url.clone(),
        provider_id: Some("tidal".to_string()),
        external_id: None,
    };

    {
        let mut q = state.queue.write();
        q.add_to_queue(track.clone());
    }

    state.play(url);

    state
        .media_controls
        .set_metadata(&track.title, &track.artist, &track.album, None, 0.0);
    state.media_controls.set_playback(true, Some(0.0));

    discord_rpc.set_playing(
        crate::discord::TrackInfo {
            title: track.title.clone(),
            artist: track.artist.clone(),
            album: track.album.clone(),
            duration_secs: track.duration,
            cover_url: track.cover_image.clone(),
        },
        0,
    );

    let _ = app.emit("track-changed", track);
    Ok(())
}

#[tauri::command]
pub async fn tidal_search_tracks(
    state: State<'_, crate::tidal::TidalClient>,
    query: String,
) -> Result<crate::tidal::SearchResponse<crate::tidal::Track>, String> {
    state.search_tracks(&query).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tidal_search_albums(
    state: State<'_, crate::tidal::TidalClient>,
    query: String,
) -> Result<crate::tidal::SearchResponse<crate::tidal::Album>, String> {
    state.search_albums(&query).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tidal_search_artists(
    state: State<'_, crate::tidal::TidalClient>,
    query: String,
) -> Result<crate::tidal::SearchResponse<crate::tidal::Artist>, String> {
    state
        .search_artists(&query)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tidal_get_album(
    state: State<'_, crate::tidal::TidalClient>,
    album_id: u64,
) -> Result<crate::tidal::Album, String> {
    state.get_album(album_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tidal_get_album_tracks(
    state: State<'_, crate::tidal::TidalClient>,
    album_id: u64,
) -> Result<Vec<crate::tidal::Track>, String> {
    state
        .get_album_tracks(album_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tidal_get_artist(
    state: State<'_, crate::tidal::TidalClient>,
    artist_id: u64,
) -> Result<crate::tidal::Artist, String> {
    state.get_artist(artist_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tidal_get_artist_top_tracks(
    state: State<'_, crate::tidal::TidalClient>,
    artist_id: u64,
) -> Result<Vec<crate::tidal::Track>, String> {
    state
        .get_artist_top_tracks(artist_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tidal_get_artist_albums(
    state: State<'_, crate::tidal::TidalClient>,
    artist_id: u64,
) -> Result<Vec<crate::tidal::Album>, String> {
    state
        .get_artist_albums(artist_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tidal_debug_endpoint(
    state: State<'_, crate::tidal::TidalClient>,
    path: String,
    params: std::collections::HashMap<String, String>,
) -> Result<String, String> {
    state
        .debug_endpoint(&path, params)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn play_tidal_track(
    app: AppHandle,
    audio_state: State<'_, AudioManager>,
    tidal_state: State<'_, crate::tidal::TidalClient>,
    discord_rpc: State<'_, crate::discord::DiscordRpcManager>,
    track_id: u64,
    title: String,
    artist: String,
    artist_id: Option<u64>,
    album: String,
    album_id: Option<u64>,
    duration: u64,
    cover_url: Option<String>,
    quality: String,
) -> Result<(), String> {
    let quality = quality
        .parse::<crate::tidal::Quality>()
        .unwrap_or(crate::tidal::Quality::LOSSLESS);

    let stream_info = tidal_state
        .get_track(track_id, quality)
        .await
        .map_err(|e| e.to_string())?;

    let track = Track {
        id: track_id.to_string(),
        title,
        artist,
        artist_id: artist_id.map(|id| id.to_string()),
        album,
        album_id: album_id.map(|id| id.to_string()),
        duration,
        cover_image: cover_url,
        path: stream_info.url.clone(),
        provider_id: Some("tidal".to_string()),
        external_id: Some(track_id.to_string()),
    };

    {
        let mut q = audio_state.queue.write();
        q.add_to_queue(track.clone());
    }

    audio_state.play(stream_info.url);

    audio_state.media_controls.set_metadata(
        &track.title,
        &track.artist,
        &track.album,
        track.cover_image.as_deref(),
        track.duration as f64,
    );
    audio_state.media_controls.set_playback(true, Some(0.0));

    discord_rpc.set_playing(
        crate::discord::TrackInfo {
            title: track.title.clone(),
            artist: track.artist.clone(),
            album: track.album.clone(),
            duration_secs: track.duration,
            cover_url: track.cover_image.clone(),
        },
        0,
    );

    let _ = app.emit("track-changed", track);
    Ok(())
}

#[tauri::command]
pub async fn get_tidal_stream_url(
    state: State<'_, crate::tidal::TidalClient>,
    track_id: u64,
    quality: String,
) -> Result<String, String> {
    let quality = quality
        .parse::<crate::tidal::Quality>()
        .unwrap_or(crate::tidal::Quality::LOSSLESS);

    let stream_info = state
        .get_track(track_id, quality)
        .await
        .map_err(|e| e.to_string())?;

    Ok(stream_info.url)
}

#[tauri::command]
pub async fn fetch_image_as_data_url(url: String) -> Result<String, String> {
    use base64::{engine::general_purpose, Engine as _};

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch image: {}", e))?;

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;

    let base64_data = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", content_type, base64_data))
}

#[tauri::command]
pub async fn refresh_tidal_cache(
    _state: State<'_, crate::tidal::TidalClient>,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn set_tidal_config(
    state: State<'_, crate::tidal::TidalConfigState>,
    quality: String,
    prefer_high_quality_stream: bool,
) -> Result<(), String> {
    let quality_enum = quality
        .parse::<crate::tidal::Quality>()
        .unwrap_or(crate::tidal::Quality::LOSSLESS);

    let mut config = state.lock();
    config.quality = quality_enum;
    config.prefer_high_quality_stream = prefer_high_quality_stream;

    log::debug!(
        "Updated Tidal Config: Quality={:?}, PreferHighQuality={}",
        config.quality,
        config.prefer_high_quality_stream
    );

    Ok(())
}

// ============================================================================
// DSP / Audio Processing Commands
// ============================================================================

#[tauri::command]
pub async fn set_loudness_normalization(
    state: State<'_, AudioManager>,
    enabled: bool,
) -> Result<(), String> {
    state.dsp.write().set_loudness_normalization(enabled);
    Ok(())
}

#[tauri::command]
pub async fn get_loudness_normalization(state: State<'_, AudioManager>) -> Result<bool, String> {
    Ok(state.dsp.read().is_loudness_normalization_enabled())
}

// ============================================================================
// Discord Rich Presence Commands
// ============================================================================

#[tauri::command]
pub async fn set_discord_rpc_enabled(
    state: State<'_, crate::discord::DiscordRpcManager>,
    enabled: bool,
) -> Result<(), String> {
    if enabled {
        state.connect();
    } else {
        state.disconnect();
    }
    Ok(())
}

#[tauri::command]
pub async fn get_discord_rpc_enabled(
    state: State<'_, crate::discord::DiscordRpcManager>,
) -> Result<bool, String> {
    Ok(state.is_enabled())
}

// ============================================================================
// Window Management Commands
// ============================================================================

/// Detect if running on a tiling window manager (Linux only)
/// Returns true for: hyprland, sway, i3, niri, bspwm, dwm, awesome, qtile, xmonad, herbstluftwm
#[tauri::command]
pub fn is_tiling_wm() -> bool {
    #[cfg(target_os = "linux")]
    {
        // Check common environment variables that indicate a tiling WM
        let tiling_wms = [
            "hyprland",
            "Hyprland",
            "sway",
            "Sway",
            "i3",
            "niri",
            "bspwm",
            "dwm",
            "awesome",
            "qtile",
            "xmonad",
            "herbstluftwm",
            "river",
            "leftwm",
        ];

        // Check XDG_CURRENT_DESKTOP
        if let Ok(desktop) = std::env::var("XDG_CURRENT_DESKTOP") {
            let desktop_lower = desktop.to_lowercase();
            for wm in &tiling_wms {
                if desktop_lower.contains(&wm.to_lowercase()) {
                    log::debug!("Detected tiling WM from XDG_CURRENT_DESKTOP: {}", desktop);
                    return true;
                }
            }
        }

        // Check XDG_SESSION_DESKTOP
        if let Ok(session) = std::env::var("XDG_SESSION_DESKTOP") {
            let session_lower = session.to_lowercase();
            for wm in &tiling_wms {
                if session_lower.contains(&wm.to_lowercase()) {
                    log::debug!("Detected tiling WM from XDG_SESSION_DESKTOP: {}", session);
                    return true;
                }
            }
        }

        // Check HYPRLAND_INSTANCE_SIGNATURE (specific to Hyprland)
        if std::env::var("HYPRLAND_INSTANCE_SIGNATURE").is_ok() {
            log::debug!("Detected Hyprland from HYPRLAND_INSTANCE_SIGNATURE");
            return true;
        }

        // Check SWAYSOCK (specific to Sway)
        if std::env::var("SWAYSOCK").is_ok() {
            log::debug!("Detected Sway from SWAYSOCK");
            return true;
        }

        // Check I3SOCK (specific to i3)
        if std::env::var("I3SOCK").is_ok() {
            log::debug!("Detected i3 from I3SOCK");
            return true;
        }

        // Check NIRI_SOCKET (specific to Niri)
        if std::env::var("NIRI_SOCKET").is_ok() {
            log::debug!("Detected Niri from NIRI_SOCKET");
            return true;
        }

        false
    }

    #[cfg(not(target_os = "linux"))]
    {
        false
    }
}

// ============================================================================
// Generic Provider Commands
// ============================================================================

#[tauri::command]
pub async fn search_music(
    state: State<'_, std::sync::Arc<ProviderManager>>,
    query: String,
    provider_id: Option<String>,
) -> Result<SearchResults, AppError> {
    log::info!(
        "search_music called: query='{}', provider_id={:?}",
        query,
        provider_id
    );

    let provider = if let Some(id) = provider_id {
        let _ = id
            .parse::<ProviderId>()
            .map_err(|_| AppError::InvalidProvider(id.clone()))?;

        log::debug!("Looking up provider: {}", id);
        state.get_provider(&id).await.ok_or_else(|| {
            log::warn!("Provider instance for {} not found", id);
            AppError::InvalidProvider(format!("Provider instance for {} not found", id))
        })?
    } else {
        state
            .get_active_provider()
            .await
            .ok_or(AppError::Config("No active provider".to_string()))?
    };

    log::info!("Searching with provider: {}", provider.id());
    let results = provider.search(&query).await.map_err(|e| {
        log::error!("Search failed for provider {}: {}", provider.id(), e);
        AppError::Network(e.to_string())
    })?;

    log::info!(
        "Search returned {} tracks, {} albums, {} artists",
        results.tracks.len(),
        results.albums.len(),
        results.artists.len()
    );

    Ok(results)
}

#[tauri::command]
pub async fn get_music_stream_url(
    state: State<'_, std::sync::Arc<ProviderManager>>,
    track_id: String,
    provider_id: String,
    quality: Option<String>,
) -> Result<String, AppError> {
    let _provider = provider_id
        .parse::<ProviderId>()
        .map_err(|_| AppError::InvalidProvider(provider_id.clone()))?;

    let provider = state
        .get_provider(&provider_id)
        .await
        .ok_or(AppError::InvalidProvider(format!(
            "Provider instance for {} not found",
            provider_id
        )))?;

    let q = if let Some(qs) = quality {
        qs.parse::<crate::models::Quality>()
            .unwrap_or(crate::models::Quality::LOSSLESS)
    } else {
        crate::models::Quality::LOSSLESS
    };

    let info = provider
        .get_stream_url(&track_id, q)
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;
    Ok(info.url)
}

#[tauri::command]
pub async fn get_providers_list(
    state: State<'_, std::sync::Arc<ProviderManager>>,
) -> Result<Vec<String>, AppError> {
    Ok(state.list_providers().await)
}

#[tauri::command]
pub async fn set_active_provider(
    state: State<'_, std::sync::Arc<ProviderManager>>,
    provider_id: String,
) -> Result<(), AppError> {
    let _ = provider_id
        .parse::<ProviderId>()
        .map_err(|_| AppError::InvalidProvider(provider_id.clone()))?;

    state
        .set_active_provider(provider_id)
        .await
        .map_err(AppError::Internal)
}

#[tauri::command]
pub async fn get_album(
    state: State<'_, std::sync::Arc<ProviderManager>>,
    provider_id: String,
    album_id: String,
) -> Result<crate::models::Album, AppError> {
    let _ = provider_id
        .parse::<ProviderId>()
        .map_err(|_| AppError::InvalidProvider(provider_id.clone()))?;

    let provider = state
        .get_provider(&provider_id)
        .await
        .ok_or(AppError::InvalidProvider(format!(
            "Provider instance for {} not found",
            provider_id
        )))?;

    provider
        .get_album_details(&album_id)
        .await
        .map_err(|e| AppError::Network(e.to_string()))
}

#[tauri::command]
pub async fn get_album_tracks(
    state: State<'_, std::sync::Arc<ProviderManager>>,
    provider_id: String,
    album_id: String,
) -> Result<Vec<crate::models::Track>, AppError> {
    let _ = provider_id
        .parse::<ProviderId>()
        .map_err(|_| AppError::InvalidProvider(provider_id.clone()))?;

    let provider = state
        .get_provider(&provider_id)
        .await
        .ok_or(AppError::InvalidProvider(format!(
            "Provider instance for {} not found",
            provider_id
        )))?;

    provider
        .get_album_tracks(&album_id)
        .await
        .map_err(|e| AppError::Network(e.to_string()))
}

#[tauri::command]
pub async fn get_artist(
    state: State<'_, std::sync::Arc<ProviderManager>>,
    provider_id: String,
    artist_id: String,
) -> Result<crate::models::Artist, AppError> {
    let _ = provider_id
        .parse::<ProviderId>()
        .map_err(|_| AppError::InvalidProvider(provider_id.clone()))?;

    let provider = state
        .get_provider(&provider_id)
        .await
        .ok_or(AppError::InvalidProvider(format!(
            "Provider instance for {} not found",
            provider_id
        )))?;

    provider
        .get_artist_details(&artist_id)
        .await
        .map_err(|e| AppError::Network(e.to_string()))
}

#[tauri::command]
pub async fn get_artist_top_tracks(
    state: State<'_, std::sync::Arc<ProviderManager>>,
    provider_id: String,
    artist_id: String,
) -> Result<Vec<crate::models::Track>, AppError> {
    let _ = provider_id
        .parse::<ProviderId>()
        .map_err(|_| AppError::InvalidProvider(provider_id.clone()))?;

    let provider = state
        .get_provider(&provider_id)
        .await
        .ok_or(AppError::InvalidProvider(format!(
            "Provider instance for {} not found",
            provider_id
        )))?;

    provider
        .get_artist_top_tracks(&artist_id)
        .await
        .map_err(|e| AppError::Network(e.to_string()))
}

#[tauri::command]
pub async fn get_artist_albums(
    state: State<'_, std::sync::Arc<ProviderManager>>,
    provider_id: String,
    artist_id: String,
) -> Result<Vec<crate::models::Album>, AppError> {
    let _ = provider_id
        .parse::<ProviderId>()
        .map_err(|_| AppError::InvalidProvider(provider_id.clone()))?;

    let provider = state
        .get_provider(&provider_id)
        .await
        .ok_or(AppError::InvalidProvider(format!(
            "Provider instance for {} not found",
            provider_id
        )))?;

    provider
        .get_artist_albums(&artist_id)
        .await
        .map_err(|e| AppError::Network(e.to_string()))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn play_provider_track(
    app: AppHandle,
    audio_state: State<'_, AudioManager>,
    provider_manager: State<'_, std::sync::Arc<ProviderManager>>,
    library: State<'_, LibraryManager>,
    tidal_state: State<'_, crate::tidal::TidalClient>,
    discord_rpc: State<'_, crate::discord::DiscordRpcManager>,
    provider_id: String,
    track_id: String,
    title: String,
    artist: String,
    artist_id: Option<String>,
    album: String,
    album_id: Option<String>,
    duration: u64,
    cover_url: Option<String>,
) -> Result<(), AppError> {
    let _provider = provider_id
        .parse::<ProviderId>()
        .map_err(|_| AppError::InvalidProvider(provider_id.clone()))?;

    let (stream_url, local_id) = if provider_id == "tidal" {
        let tid = track_id
            .parse::<u64>()
            .map_err(|_| AppError::Internal("Invalid Tidal ID".to_string()))?;

        let quality = if let Some(state) = app.try_state::<crate::tidal::TidalConfigState>() {
            state.lock().quality.clone()
        } else {
            crate::tidal::Quality::LOSSLESS
        };

        let stream_info = tidal_state
            .get_track(tid, quality)
            .await
            .map_err(|e| AppError::Network(e.to_string()))?;

        let tidal_track = crate::tidal::Track {
            id: tid,
            title: title.clone(),
            artist: Some(crate::tidal::Artist {
                id: 0, // We don't have artist ID here easily?
                name: artist.clone(),
                picture: None,
                banner: None,
            }),
            album: Some(crate::tidal::Album {
                id: 0,
                title: album.clone(),
                cover: None,
                artist: None,
                artists: None,
                number_of_tracks: None,
                release_date: None,
            }),
            duration: Some(duration as u32),
            audio_quality: None,
            cover: None,
            track_number: None,
        };

        match library
            .import_tidal_track(&tidal_track, cover_url.clone())
            .await
        {
            Ok(id) => (stream_info.url, id),
            Err(e) => {
                log::error!("Failed to import tidal track: {}", e);
                (stream_info.url, track_id.clone())
            }
        }
    } else {
        let provider = provider_manager
            .get_provider(&provider_id)
            .await
            .ok_or_else(|| {
                AppError::InvalidProvider(format!("Provider {} not found", provider_id))
            })?;

        let stream_info = provider
            .get_stream_url(&track_id, crate::models::Quality::LOSSLESS)
            .await
            .map_err(|e| AppError::Network(e.to_string()))?;

        let import_track = crate::models::Track {
            id: track_id.clone(),
            title: title.clone(),
            artist: artist.clone(),
            artist_id: None,
            album: album.clone(),
            album_id: None,
            duration,
            cover_url: cover_url.clone(),
        };

        match library
            .import_external_track(&import_track, &provider_id)
            .await
        {
            Ok(id) => (stream_info.url, id),
            Err(e) => {
                log::error!("Failed to import external track: {}", e);
                (stream_info.url, track_id.clone())
            }
        }
    };

    let track = Track {
        id: local_id,
        title,
        artist,
        artist_id: artist_id.clone(),
        album,
        album_id: album_id.clone(),
        duration,
        cover_image: cover_url,
        path: stream_url.clone(),
        provider_id: Some(provider_id.clone()),
        external_id: Some(track_id.clone()),
    };

    {
        let mut q = audio_state.queue.write();
        q.add_to_queue(track.clone());
    }

    audio_state.play(stream_url);

    audio_state.media_controls.set_metadata(
        &track.title,
        &track.artist,
        &track.album,
        track.cover_image.as_deref(),
        track.duration as f64,
    );
    audio_state.media_controls.set_playback(true, Some(0.0));

    discord_rpc.set_playing(
        crate::discord::TrackInfo {
            title: track.title.clone(),
            artist: track.artist.clone(),
            album: track.album.clone(),
            duration_secs: track.duration,
            cover_url: track.cover_image.clone(),
        },
        0,
    );

    let _ = app.emit("track-changed", track);
    Ok(())
}
