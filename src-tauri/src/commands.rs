use tauri::{AppHandle, Emitter, State};

use crate::audio::AudioManager;
use base64::{engine::general_purpose, Engine as _};
use lofty::picture::MimeType;
use lofty::prelude::*;
use lofty::probe::Probe;
use serde::Serialize;
use std::fs;
use std::path::Path;

// Supported audio extensions
const AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "ogg", "m4a", "aac", "wma", "aiff", "ape", "opus", "webm",
];

use crate::queue::Track;

/// Parse a single audio file into a Track
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
        album,
        duration,
        cover_image,
        path: path_str.to_string(),
    })
}

/// Check if a file has a supported audio extension
fn is_audio_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// Recursively scan a directory for audio files
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

/// Import an entire folder of music recursively
#[tauri::command]
pub async fn import_folder(app: AppHandle) -> Result<Vec<Track>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder_path = app.dialog().file().blocking_pick_folder();

    if let Some(path_buf) = folder_path {
        let path_str = path_buf.to_string();
        let path = Path::new(&path_str);

        let mut tracks = Vec::new();
        scan_directory(path, &mut tracks);

        // Sort by artist, then album, then title
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
    path: String,
) -> Result<(), String> {
    state.play(path.clone());

    // Find the track info to emit event and update OS controls
    let track = {
        let q = state.queue.read();
        q.tracks.iter().find(|t| t.path == path).cloned()
    };

    if let Some(ref t) = track {
        let _ = app.emit("track-changed", t.clone());
        state
            .media_controls
            .set_metadata(&t.title, &t.artist, &t.album);
        state.media_controls.set_playback(true);
    }

    Ok(())
}

#[tauri::command]
pub async fn pause_track(state: State<'_, AudioManager>) -> Result<(), String> {
    state.pause();
    state.media_controls.set_playback(false);
    Ok(())
}

#[tauri::command]
pub async fn resume_track(state: State<'_, AudioManager>) -> Result<(), String> {
    state.resume();
    state.media_controls.set_playback(true);
    Ok(())
}

#[tauri::command]
pub async fn seek_track(state: State<'_, AudioManager>, position: f64) -> Result<(), String> {
    state.seek(position);
    Ok(())
}

#[tauri::command]
pub async fn set_volume(state: State<'_, AudioManager>, volume: f32) -> Result<(), String> {
    state.set_volume(volume);
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
pub async fn toggle_shuffle(state: State<'_, AudioManager>) -> Result<bool, String> {
    let mut q = state.queue.write();
    q.toggle_shuffle();
    Ok(q.shuffle)
}

#[tauri::command]
pub async fn set_repeat_mode(
    state: State<'_, AudioManager>,
    mode: RepeatMode,
) -> Result<(), String> {
    state.queue.write().repeat = mode;
    Ok(())
}

#[tauri::command]
pub async fn next_track(app: AppHandle, state: State<'_, AudioManager>) -> Result<(), String> {
    let next_track = {
        let mut q = state.queue.write();
        q.get_next_track(true)
    };

    if let Some(ref track) = next_track {
        state.play(track.path.clone());
        let _ = app.emit("track-changed", track.clone());
        state
            .media_controls
            .set_metadata(&track.title, &track.artist, &track.album);
        state.media_controls.set_playback(true);
    }
    Ok(())
}

#[tauri::command]
pub async fn prev_track(app: AppHandle, state: State<'_, AudioManager>) -> Result<(), String> {
    let prev_track = {
        let mut q = state.queue.write();
        q.get_prev_track()
    };

    if let Some(ref track) = prev_track {
        state.play(track.path.clone());
        let _ = app.emit("track-changed", track.clone());
        state
            .media_controls
            .set_metadata(&track.title, &track.artist, &track.album);
        state.media_controls.set_playback(true);
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
    // Return visible tracks (should it be shuffled list or original logic? usually original + indication)
    // For now return original list.
    // TODO: Maybe return play queue vs library context?
    // PlayQueue manages "tracks".
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
    // Clamp between 0 (disabled) and 12 seconds (Spotify max)
    let clamped = duration_ms.min(12000);
    state
        .crossfade_duration_ms
        .store(clamped, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}
