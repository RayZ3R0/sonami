use parking_lot::Mutex;
use std::path::Path;
use std::sync::mpsc;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager};

use crate::library::LibraryManager;
use crate::tidal::{Quality, TidalClient};

#[derive(Debug, Clone, serde::Serialize)]
pub struct ResolvedAudio {
    pub path: String,
    pub source: String, // "LOCAL" or "STREAM"
    pub quality: String,
}

pub type ResolveRequest = (String, mpsc::Sender<Result<ResolvedAudio, String>>);

#[derive(Clone)]
pub struct UrlResolver {
    request_tx: mpsc::Sender<ResolveRequest>,
}

impl UrlResolver {
    pub fn new(app_handle: AppHandle) -> Self {
        let (request_tx, request_rx) = mpsc::channel::<ResolveRequest>();
        let request_rx = Arc::new(Mutex::new(request_rx));

        std::thread::spawn({
            let request_rx = request_rx.clone();
            let app_handle = app_handle.clone();
            move || {
                let rt = match tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                {
                    Ok(rt) => rt,
                    Err(e) => {
                        log::error!("Failed to create resolver runtime: {}", e);
                        return;
                    }
                };

                loop {
                    let req = {
                        let rx = request_rx.lock();
                        rx.recv_timeout(Duration::from_millis(100))
                    };

                    match req {
                        Ok((uri, response_tx)) => {
                            let resolved = rt.block_on(resolve_uri(&app_handle, &uri));
                            let _ = response_tx.send(resolved);
                        }
                        Err(mpsc::RecvTimeoutError::Timeout) => continue,
                        Err(mpsc::RecvTimeoutError::Disconnected) => break,
                    }
                }
            }
        });

        Self { request_tx }
    }

    pub fn resolve(&self, uri: &str) -> Result<ResolvedAudio, String> {
        if !uri.starts_with("tidal:") {
            // For local file paths, verify the file exists
            if !uri.starts_with("http://") && !uri.starts_with("https://") {
                if !Path::new(uri).exists() {
                    log::warn!("[Resolver] Local file not found: {}. Cannot play.", uri);
                    return Err(format!("File not found: {}", uri));
                }
            }
            return Ok(ResolvedAudio {
                path: uri.to_string(),
                source: "LOCAL".to_string(),
                quality: "UNKNOWN".to_string(),
            });
        }

        let (response_tx, response_rx) = mpsc::channel();
        self.request_tx
            .send((uri.to_string(), response_tx))
            .map_err(|e| format!("Failed to send resolve request: {}", e))?;

        response_rx
            .recv_timeout(Duration::from_secs(30))
            .map_err(|e| format!("Resolve timeout: {}", e))?
    }
}

pub async fn resolve_uri(app_handle: &AppHandle, uri: &str) -> Result<ResolvedAudio, String> {
    if !uri.starts_with("tidal:") {
        return Ok(ResolvedAudio {
            path: uri.to_string(),
            source: "LOCAL".to_string(),
            quality: "UNKNOWN".to_string(),
        });
    }

    let id_str = uri.trim_start_matches("tidal:");
    let id = id_str
        .parse::<u64>()
        .map_err(|_| format!("Invalid Tidal ID: {}", id_str))?;

    // Get configuration
    let (target_quality, prefer_high_quality) = if let Some(state) = app_handle.try_state::<crate::tidal::TidalConfigState>() {
        let config = state.lock();
        (config.quality.clone(), config.prefer_high_quality_stream)
    } else {
        (Quality::LOSSLESS, false)
    };

    log::debug!("[Resolver] resolving {} with Target: {:?}, PreferHighQuality: {}", id, target_quality, prefer_high_quality);

    // 1. Try Local File
    if let Some(library) = app_handle.try_state::<LibraryManager>() {
        // We ignore db errors and fall back to streaming
        if let Ok(Some((path, quality_str))) = library.get_track_local_info(id).await {
            log::debug!("[Resolver] Found local file: {} (Quality: {:?})", path, quality_str);
            
            if Path::new(&path).exists() {
                // Smart check: If user prefers high quality stream AND local file is lower quality than target
                let local_is_sufficient = if prefer_high_quality {
                    if let Some(ref q_str) = quality_str {
                        if let Ok(local_quality) = q_str.parse::<Quality>() {
                            let sufficient = local_quality >= target_quality;
                            if !sufficient {
                                log::warn!("[Resolver] Local quality {:?} < Target {:?}. Streaming preferred.", local_quality, target_quality);
                            }
                            sufficient
                        } else {
                            true // Assume sufficient if unknown
                        }
                    } else {
                        true // Assume sufficient if unknown
                    }
                } else {
                    true // Always sufficient if check is disabled
                };

                if local_is_sufficient {
                    log::debug!("[Resolver] Using local file: Path={}, Quality={:?}", path, quality_str);
                    return Ok(ResolvedAudio {
                        path,
                        source: "LOCAL".to_string(),
                        quality: quality_str.unwrap_or("UNKNOWN".to_string()),
                    });
                } else {
                    log::debug!("[Resolver] Local file insufficient. Fallback to stream.");
                }
            } else {
                 log::warn!("[Resolver] Local file record exists but file not found on disk: {}. Clearing download info.", path);
                 // Clear the stale download info from database
                 if let Err(e) = library.clear_download_info(id).await {
                     log::error!("[Resolver] Failed to clear stale download info for {}: {}", id, e);
                 }
                 // Fall through to streaming
            }
        } else {
            log::debug!("[Resolver] No local file found in library for {}", id);
        }
    }

    // 2. Fallback to Stream
    let client = app_handle
        .try_state::<TidalClient>()
        .ok_or_else(|| "Tidal client not initialized".to_string())?;

    let stream_info = client
        .get_track(id, target_quality.clone())
        .await
        .map_err(|e| format!("Failed to resolve Tidal track: {}", e))?;

    Ok(ResolvedAudio {
        path: stream_info.url,
        source: "STREAM".to_string(),
        quality: format!("{:?}", target_quality), // e.g. "LOSSLESS"
    })
}
