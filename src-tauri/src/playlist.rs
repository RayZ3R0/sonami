use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use crate::queue::Track;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub tracks: Vec<Track>,
    pub created_at: String,
}

pub struct PlaylistManager {
    pub playlists: Arc<RwLock<Vec<Playlist>>>,
    file_path: PathBuf,
}

impl PlaylistManager {
    pub fn new(app_handle: &AppHandle) -> Self {
        let app_data_dir = app_handle.path().app_data_dir().expect("failed to get app data dir");
        // Ensure directory exists
        if !app_data_dir.exists() {
            let _ = fs::create_dir_all(&app_data_dir);
        }
        let file_path = app_data_dir.join("playlists.json");

        let playlists = if file_path.exists() {
            let content = fs::read_to_string(&file_path).unwrap_or_else(|_| "[]".to_string());
            serde_json::from_str(&content).unwrap_or_else(|_| Vec::new())
        } else {
            Vec::new()
        };

        Self {
            playlists: Arc::new(RwLock::new(playlists)),
            file_path,
        }
    }

    fn save(&self) -> Result<(), String> {
        let playlists = self.playlists.read().map_err(|e| e.to_string())?;
        let content = serde_json::to_string_pretty(&*playlists).map_err(|e| e.to_string())?;
        fs::write(&self.file_path, content).map_err(|e| e.to_string())
    }
}

// Commands

#[tauri::command]
pub async fn get_playlists(state: State<'_, PlaylistManager>) -> Result<Vec<Playlist>, String> {
    let playlists = state.playlists.read().map_err(|e| e.to_string())?;
    Ok(playlists.clone())
}

#[tauri::command]
pub async fn create_playlist(
    state: State<'_, PlaylistManager>,
    name: String,
) -> Result<Playlist, String> {
    let mut playlists = state.playlists.write().map_err(|e| e.to_string())?;
    
    let new_playlist = Playlist {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        tracks: Vec::new(),
        created_at: chrono::Local::now().to_rfc3339(),
    };
    
    playlists.push(new_playlist.clone());
    drop(playlists); // Unlock before saving to avoid deadlocks (though save doesn't lock write, it reads)
    
    state.save()?;
    Ok(new_playlist)
}

#[tauri::command]
pub async fn delete_playlist(state: State<'_, PlaylistManager>, id: String) -> Result<(), String> {
    let mut playlists = state.playlists.write().map_err(|e| e.to_string())?;
    playlists.retain(|p| p.id != id);
    drop(playlists);
    state.save()?;
    Ok(())
}

#[tauri::command]
pub async fn rename_playlist(
    state: State<'_, PlaylistManager>,
    id: String,
    new_name: String,
) -> Result<(), String> {
    let mut playlists = state.playlists.write().map_err(|e| e.to_string())?;
    if let Some(playlist) = playlists.iter_mut().find(|p| p.id == id) {
        playlist.name = new_name;
    } else {
        return Err("Playlist not found".to_string());
    }
    drop(playlists);
    state.save()?;
    Ok(())
}

#[tauri::command]
pub async fn add_to_playlist(
    state: State<'_, PlaylistManager>,
    playlist_id: String,
    track: Track,
) -> Result<(), String> {
    let mut playlists = state.playlists.write().map_err(|e| e.to_string())?;
    if let Some(playlist) = playlists.iter_mut().find(|p| p.id == playlist_id) {
        // Check for duplicates? For now allow.
        playlist.tracks.push(track);
    } else {
        return Err("Playlist not found".to_string());
    }
    drop(playlists);
    state.save()?;
    Ok(())
}

#[tauri::command]
pub async fn remove_from_playlist(
    state: State<'_, PlaylistManager>,
    playlist_id: String,
    track_id: String,
) -> Result<(), String> {
    let mut playlists = state.playlists.write().map_err(|e| e.to_string())?;
    if let Some(playlist) = playlists.iter_mut().find(|p| p.id == playlist_id) {
        playlist.tracks.retain(|t| t.id != track_id);
    } else {
        return Err("Playlist not found".to_string());
    }
    drop(playlists);
    state.save()?;
    Ok(())
}
