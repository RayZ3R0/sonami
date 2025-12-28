use tauri::{AppHandle, State};

use crate::audio::AudioManager;
use base64::{engine::general_purpose, Engine as _};
use lofty::picture::MimeType;
use lofty::prelude::*;
use lofty::probe::Probe;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: u64,
    pub cover_image: Option<String>,
    pub path: String,
}

#[tauri::command]
pub async fn import_music(app: AppHandle) -> Result<Vec<Track>, String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app.dialog().file().blocking_pick_file();

    if let Some(path_buf) = file_path {
        let path_str = path_buf.to_string();
        let path = Path::new(&path_str);


        let tagged_file = Probe::open(path)
            .map_err(|e| e.to_string())?
            .read()
            .map_err(|e| e.to_string())?;

        let tag = tagged_file.primary_tag();

        let title = tag
            .as_ref()
            .and_then(|t| t.title().map(|c| c.into_owned()))
            .unwrap_or_else(|| "Unknown Title".to_string());
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

        let track = Track {
            id: uuid::Uuid::new_v4().to_string(),
            title,
            artist,
            album,
            duration,
            cover_image,
            path: path_str,
        };

        Ok(vec![track])
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn play_track(state: State<'_, AudioManager>, path: String) -> Result<(), String> {
    state.play(path);
    Ok(())
}

#[tauri::command]
pub async fn pause_track(state: State<'_, AudioManager>) -> Result<(), String> {
    state.pause();
    Ok(())
}

#[tauri::command]
pub async fn resume_track(state: State<'_, AudioManager>) -> Result<(), String> {
    state.resume();
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


#[tauri::command]
pub async fn queue_next_track(state: State<'_, AudioManager>, path: String) -> Result<(), String> {
    state.queue_next(path);
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
