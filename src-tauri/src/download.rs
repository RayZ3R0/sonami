use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Instant;

use futures_util::StreamExt;
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::*;
use lofty::tag::{Tag, TagExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::library::LibraryManager;
use crate::tidal::{Quality, TidalClient};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub cover_url: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub track_id: String,
    pub total: u64,
    pub downloaded: u64,
    pub progress: f64, // 0.0 to 1.0
    pub status: String,
}

pub struct DownloadManager {
    app_handle: AppHandle,
    music_dir: Arc<Mutex<PathBuf>>,
    active_downloads: Arc<Mutex<Vec<String>>>, // List of track IDs being downloaded
    client: Client,
}

impl DownloadManager {
    pub fn new(app_handle: &AppHandle) -> Self {
        // Default to "Music" directory in home/Sonami
        let music_dir = dirs::audio_dir()
            .unwrap_or_else(|| dirs::home_dir().unwrap().join("Music"))
            .join("Sonami");

        if !music_dir.exists() {
            let _ = fs::create_dir_all(&music_dir);
        }

        Self {
            app_handle: app_handle.clone(),
            music_dir: Arc::new(Mutex::new(music_dir)),
            active_downloads: Arc::new(Mutex::new(Vec::new())),
            client: Client::builder()
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .build()
                .unwrap(),
        }
    }

    pub fn set_download_path(&self, path: PathBuf) -> Result<(), String> {
        let mut dir = self.music_dir.lock().unwrap();
        *dir = path;
        Ok(())
    }

    pub fn get_download_path(&self) -> PathBuf {
        self.music_dir.lock().unwrap().clone()
    }

    pub async fn download_tidal_track(
        &self,
        track_id: u64,
        metadata: TrackMetadata,
        tidal_client: &TidalClient,
        quality: Quality,
    ) -> Result<PathBuf, String> {
        let id_str = track_id.to_string();

        {
            let mut active = self.active_downloads.lock().unwrap();
            if active.contains(&id_str) {
                return Err("Download already in progress".to_string());
            }
            active.push(id_str.clone());
        }

        let result = self
            .download_process(track_id, metadata, tidal_client, quality.clone())
            .await;

        {
            let mut active = self.active_downloads.lock().unwrap();
            active.retain(|id| id != &id_str);
        }

        if let Ok(ref path) = result {
            let library_manager = self.app_handle.state::<LibraryManager>();
            let quality_str = match quality {
                Quality::LOSSLESS => "LOSSLESS",
                Quality::HIGH => "HIGH",
                Quality::LOW => "LOW",
            };

            if let Err(e) = library_manager
                .update_track_download_info(
                    track_id,
                    path.to_str().unwrap_or_default(),
                    quality_str,
                )
                .await
            {
                log::error!("Failed to update database for download {}: {}", track_id, e);
            }
        }

        if let Err(ref e) = result {
            let _ = self.app_handle.emit(
                "download-error",
                format!("Failed to download track {}: {}", track_id, e),
            );
        }

        result
    }

    pub async fn download_provider_track(
        &self,
        provider_id: &str,
        external_id: &str,
        metadata: TrackMetadata,
        provider_manager: &crate::providers::ProviderManager,
        quality: crate::models::Quality,
    ) -> Result<PathBuf, String> {
        let id_str = format!("{}:{}", provider_id, external_id);

        {
            let mut active = self.active_downloads.lock().unwrap();
            if active.contains(&id_str) {
                return Err("Download already in progress".to_string());
            }
            active.push(id_str.clone());
        }

        let result = self
            .download_provider_process(provider_id, external_id, metadata, provider_manager, quality.clone())
            .await;

        {
            let mut active = self.active_downloads.lock().unwrap();
            active.retain(|id| id != &id_str);
        }

        // Update database with download info for persistence
        if let Ok(ref path) = result {
            let library_manager = self.app_handle.state::<LibraryManager>();
            let quality_str = match quality {
                crate::models::Quality::LOSSLESS => "LOSSLESS",
                crate::models::Quality::HIGH => "HIGH",
                crate::models::Quality::LOW => "LOW",
            };

            if let Err(e) = library_manager
                .update_provider_track_download_info(
                    provider_id,
                    external_id,
                    path.to_str().unwrap_or_default(),
                    quality_str,
                )
                .await
            {
                log::error!("Failed to update database for provider download {}:{}: {}", provider_id, external_id, e);
            }
        }

        if let Err(ref e) = result {
            let _ = self.app_handle.emit(
                "download-error",
                format!("Failed to download track {}:{}: {}", provider_id, external_id, e),
            );
        }

        result
    }

    async fn download_provider_process(
        &self,
        provider_id: &str,
        external_id: &str,
        metadata: TrackMetadata,
        provider_manager: &crate::providers::ProviderManager,
        quality: crate::models::Quality,
    ) -> Result<PathBuf, String> {
        let id_str = format!("{}:{}", provider_id, external_id);

        // Get provider and stream URL
        let provider = provider_manager
            .get_provider(provider_id)
            .await
            .ok_or_else(|| format!("Provider {} not found", provider_id))?;

        let stream_info = provider
            .get_stream_url(external_id, quality.clone())
            .await
            .map_err(|e| format!("Failed to fetch stream URL: {}", e))?;

        // Prepare File Path
        let music_dir = self.music_dir.lock().unwrap().clone();
        let safe_artist = sanitize_filename(&metadata.artist);
        let safe_album = sanitize_filename(&metadata.album);
        let safe_title = sanitize_filename(&metadata.title);

        let album_dir = music_dir.join(&safe_artist).join(&safe_album);
        fs::create_dir_all(&album_dir).map_err(|e| format!("Failed to create directory: {}", e))?;

        // Determine extension based on codec
        let extension = match stream_info.codec.as_deref() {
            Some("flac") => "flac",
            Some("mp3") => "mp3",
            Some("opus") => "opus",
            Some("ogg") => "ogg",
            _ => if quality == crate::models::Quality::LOSSLESS { "flac" } else { "mp3" },
        };
        let file_path = album_dir.join(format!("{}.{}", safe_title, extension));

        // Download Audio
        let response = self
            .client
            .get(&stream_info.url)
            .send()
            .await
            .map_err(|e| format!("Failed to request stream: {}", e))?;

        let total_size = response.content_length().unwrap_or(0);
        let mut file =
            File::create(&file_path).map_err(|e| format!("Failed to create file: {}", e))?;
        let mut stream = response.bytes_stream();
        let mut downloaded: u64 = 0;
        let mut last_emit = Instant::now();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| format!("Download error: {}", e))?;
            downloaded += chunk.len() as u64;
            file.write_all(&chunk)
                .map_err(|e| format!("Write error: {}", e))?;

            if last_emit.elapsed().as_millis() > 500 {
                let _ = self.app_handle.emit(
                    "download-progress",
                    DownloadProgress {
                        track_id: id_str.clone(),
                        total: total_size,
                        downloaded,
                        progress: if total_size > 0 {
                            downloaded as f64 / total_size as f64
                        } else {
                            0.0
                        },
                        status: "downloading".to_string(),
                    },
                );
                last_emit = Instant::now();
            }
        }

        // Download Cover Art (if available)
        let mut cover_data: Option<Vec<u8>> = None;
        let mut mime_type = MimeType::Jpeg;

        if let Some(url) = &metadata.cover_url {
            match self.client.get(url).send().await {
                Ok(resp) => {
                    if let Ok(bytes) = resp.bytes().await {
                        cover_data = Some(bytes.to_vec());
                        if url.to_lowercase().ends_with(".png") {
                            mime_type = MimeType::Png;
                        }
                    }
                }
                Err(e) => log::warn!("Failed to download cover art: {}", e),
            }
        }

        // Write Metadata Tags
        if let Err(e) = self.write_metadata(
            &file_path,
            &metadata.title,
            &metadata.artist,
            &metadata.album,
            cover_data,
            mime_type,
        ) {
            log::error!("Failed to write tags: {}", e);
        }

        // Emit 100% progress before completion
        let _ = self.app_handle.emit(
            "download-progress",
            DownloadProgress {
                track_id: id_str.clone(),
                total: 100,
                downloaded: 100,
                progress: 1.0,
                status: "complete".to_string(),
            },
        );
        log::info!("Emitting download-complete for provider track {}", id_str);

        // Emit completion
        let _ = self.app_handle.emit(
            "download-complete",
            serde_json::json!({
                "track_id": id_str,
                "title": metadata.title,
                "artist": metadata.artist,
                "album": metadata.album,
                "path": file_path.to_string_lossy(),
            }),
        );
        Ok(file_path)
    }

    async fn download_process(
        &self,
        track_id: u64,
        metadata: TrackMetadata,
        tidal_client: &TidalClient,
        quality: Quality,
    ) -> Result<PathBuf, String> {
        // 1. Fetch Stream URL (Metadata provided by caller)
        let stream_info = tidal_client
            .get_track(track_id, quality.clone())
            .await
            .map_err(|e| format!("Failed to fetch stream URL: {}", e))?;

        // 3. Prepare File Path
        let music_dir = self.music_dir.lock().unwrap().clone();
        let safe_artist = sanitize_filename(&metadata.artist);
        let safe_album = sanitize_filename(&metadata.album);
        let safe_title = sanitize_filename(&metadata.title);

        let album_dir = music_dir.join(&safe_artist).join(&safe_album);
        fs::create_dir_all(&album_dir).map_err(|e| format!("Failed to create directory: {}", e))?;

        // Determine extension based on codec/quality.
        // Usually FLAC for lossless, MP4/M4A for High/Low (AAC).
        let extension = if quality == Quality::LOSSLESS {
            "flac"
        } else {
            "m4a"
        };
        let file_path = album_dir.join(format!("{}.{}", safe_title, extension));

        // 4. Download Audio
        let response = self
            .client
            .get(&stream_info.url)
            .send()
            .await
            .map_err(|e| format!("Failed to request stream: {}", e))?;

        let total_size = response.content_length().unwrap_or(0);
        let mut file =
            File::create(&file_path).map_err(|e| format!("Failed to create file: {}", e))?;
        let mut stream = response.bytes_stream();
        let mut downloaded: u64 = 0;
        let mut last_emit = Instant::now();

        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| format!("Download error: {}", e))?;
            downloaded += chunk.len() as u64;
            file.write_all(&chunk)
                .map_err(|e| format!("Write error: {}", e))?;

            if last_emit.elapsed().as_millis() > 500 {
                let _ = self.app_handle.emit(
                    "download-progress",
                    DownloadProgress {
                        track_id: track_id.to_string(),
                        total: total_size,
                        downloaded,
                        progress: if total_size > 0 {
                            downloaded as f64 / total_size as f64
                        } else {
                            0.0
                        },
                        status: "downloading".to_string(),
                    },
                );
                if total_size > 0 {
                    log::debug!(
                        "Download progress for {}: {:.2}%",
                        track_id,
                        (downloaded as f64 / total_size as f64) * 100.0
                    );
                }
                last_emit = Instant::now();
            }
        }

        // 5. Download Cover Art (if available)
        let mut cover_data: Option<Vec<u8>> = None;
        let mut mime_type = MimeType::Jpeg;

        if let Some(url) = &metadata.cover_url {
            match self.client.get(url).send().await {
                Ok(resp) => {
                    if let Ok(bytes) = resp.bytes().await {
                        cover_data = Some(bytes.to_vec());
                        if url.to_lowercase().ends_with(".png") {
                            mime_type = MimeType::Png;
                        }
                    }
                }
                Err(e) => log::warn!("Failed to download cover art: {}", e),
            }
        }

        // 6. Write Metadata Tags
        if let Err(e) = self.write_metadata(
            &file_path,
            &metadata.title,
            &metadata.artist,
            &metadata.album,
            cover_data,
            mime_type,
        ) {
            log::error!("Failed to write tags: {}", e);
        }

        // Emit 100% progress before completion to ensure UI updates
        let _ = self.app_handle.emit(
            "download-progress",
            DownloadProgress {
                track_id: track_id.to_string(),
                total: 100,
                downloaded: 100,
                progress: 1.0, // 100%
                status: "complete".to_string(),
            },
        );
        log::info!("Emitting download-complete for track {}", track_id);

        // Emit completion with basic info
        let _ = self.app_handle.emit(
            "download-complete",
            serde_json::json!({
                "track_id": track_id.to_string(),
                "title": metadata.title,
                "artist": metadata.artist,
                "album": metadata.album,
                "path": file_path.to_string_lossy(),
            }),
        );
        Ok(file_path)
    }

    fn write_metadata(
        &self,
        path: &Path,
        title: &str,
        artist: &str,
        album: &str,
        cover_data: Option<Vec<u8>>,
        mime_type: MimeType,
    ) -> Result<(), String> {
        let mut tagged_file = lofty::probe::Probe::open(path)
            .map_err(|e| e.to_string())?
            .read()
            .map_err(|e| e.to_string())?;

        let tag_type = tagged_file.primary_tag_type();
        let mut tag = if let Some(t) = tagged_file.primary_tag_mut() {
            t.clone()
        } else {
            Tag::new(tag_type)
        };

        tag.set_title(title.to_string());
        tag.set_artist(artist.to_string());
        tag.set_album(album.to_string());

        if let Some(data) = cover_data {
            tag.remove_picture_type(PictureType::CoverFront);
            tag.push_picture(Picture::new_unchecked(
                PictureType::CoverFront,
                Some(mime_type),
                None,
                data,
            ));
        }

        tag.save_to_path(path, lofty::config::WriteOptions::default())
            .map_err(|e| e.to_string())?;
        Ok(())
    }
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
        .trim()
        .to_string()
}
