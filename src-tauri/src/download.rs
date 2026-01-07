use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::queue::Track;

#[derive(Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub track_id: String,
    pub total: u64,
    pub downloaded: u64,
    pub progress: f64, // 0.0 to 1.0
}

pub struct DownloadManager {
    app_handle: AppHandle,
    music_dir: PathBuf,
    active_downloads: Arc<Mutex<Vec<String>>>, // List of track IDs being downloaded
}

impl DownloadManager {
    pub fn new(app_handle: &AppHandle) -> Self {
        // Default to "Music" directory in home
        let music_dir =
            dirs::audio_dir().unwrap_or_else(|| dirs::home_dir().unwrap().join("Music"));

        Self {
            app_handle: app_handle.clone(),
            music_dir,
            active_downloads: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn download_track(&self, track: Track) -> Result<(), String> {
        let track_id = track.id.clone();

        {
            let mut active = self.active_downloads.lock().unwrap();
            if active.contains(&track_id) {
                return Err("Download already in progress".to_string());
            }
            active.push(track_id.clone());
        }

        let app_handle = self.app_handle.clone();
        let music_dir = self.music_dir.clone();
        let active_downloads = self.active_downloads.clone();
        let url = track.path.clone();

        thread::spawn(move || {
            if let Err(e) = download_worker(url, track.clone(), music_dir, app_handle.clone()) {
                let _ = app_handle.emit(
                    "download-error",
                    format!("Failed to download {}: {}", track.title, e),
                );
            }

            // Remove from active list
            let mut active = active_downloads.lock().unwrap();
            active.retain(|id| id != &track.id);
        });

        Ok(())
    }
}

fn download_worker(
    url: String,
    track: Track,
    music_dir: PathBuf,
    app: AppHandle,
) -> io::Result<()> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(300)) // 5 minute timeout for large files
        .build()
        .map_err(io::Error::other)?;

    let mut response = client
        .get(&url)
        .send()
        .map_err(io::Error::other)?;

    if !response.status().is_success() {
        return Err(io::Error::other(format!("HTTP {}", response.status())));
    }

    let total_size = response.content_length().unwrap_or(0);

    // Create artist/album directories
    let safe_artist = sanitize_filename(&track.artist);
    let safe_album = sanitize_filename(&track.album);
    let safe_title = sanitize_filename(&track.title);

    let album_dir = music_dir.join(&safe_artist).join(&safe_album);
    fs::create_dir_all(&album_dir)?;

    let extension = if url.contains(".flac") { "flac" } else { "mp3" }; // Simple detection
    let file_path = album_dir.join(format!("{}.{}", safe_title, extension));

    let mut file = File::create(&file_path)?;

    let mut downloaded: u64 = 0;
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = response.read(&mut buffer)?;
        if bytes_read == 0 {
            break;
        }

        file.write_all(&buffer[..bytes_read])?;
        downloaded += bytes_read as u64;

        if total_size > 0 {
            let _ = app.emit(
                "download-progress",
                DownloadProgress {
                    track_id: track.id.clone(),
                    total: total_size,
                    downloaded,
                    progress: downloaded as f64 / total_size as f64,
                },
            );
        }
    }

    // TODO: Write metadata tags to file using existing logic or library

    let _ = app.emit("download-complete", track);
    Ok(())
}

fn sanitize_filename(name: &str) -> String {
    name.replace("/", "_")
        .replace("\\", "_")
        .replace(":", "_")
        .replace("?", "")
        .replace("*", "")
        .replace("\"", "")
        .replace("<", "")
        .replace(">", "")
        .replace("|", "")
}
