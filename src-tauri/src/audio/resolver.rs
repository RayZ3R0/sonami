use parking_lot::Mutex;
use std::path::Path;
use std::sync::mpsc;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager};

use crate::library::LibraryManager;

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
            if !uri.starts_with("http://") && !uri.starts_with("https://") && !Path::new(uri).exists() {
                log::warn!("[Resolver] Local file not found: {}. Cannot play.", uri);
                return Err(format!("File not found: {}", uri));
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
    // Try to find a matching provider
    if let Some((scheme, id_str)) = uri.split_once(':') {
        if let Some(state) = app_handle.try_state::<std::sync::Arc<crate::providers::ProviderManager>>() {
             if let Some(provider) = state.get_provider(scheme).await {
                // Found a valid provider!
                
                // 1. Get Quality Config
                let (target_quality, prefer_high_quality) =
                    if let Some(state) = app_handle.try_state::<crate::tidal::TidalConfigState>() {
                        let config = state.lock();
                        (config.quality.clone(), config.prefer_high_quality_stream)
                    } else {
                        (crate::tidal::Quality::LOSSLESS, false)
                    };

                 // Map to Unified Quality
                 let unified_quality = match target_quality {
                     crate::tidal::Quality::LOW => crate::models::Quality::LOW,
                     crate::tidal::Quality::HIGH => crate::models::Quality::HIGH,
                     crate::tidal::Quality::LOSSLESS => crate::models::Quality::LOSSLESS,
                 };

                 // 2. (Optional) Check Local Library for Offline Playback
                 // Currently only supported for Tidal IDs (numeric)
                 if scheme == "tidal" {
                     if let Ok(tid) = id_str.parse::<u64>() {
                         if let Some(library) = app_handle.try_state::<LibraryManager>() {
                            if let Ok(Some((path, quality_str))) = library.get_track_local_info(tid).await {
                                log::debug!("[Resolver] Found local file: {} (Quality: {:?})", path, quality_str);
                                
                                if Path::new(&path).exists() {
                                    // Smart Quality Check
                                    let local_is_sufficient = if prefer_high_quality {
                                        if let Some(ref q_str) = quality_str {
                                            if let Ok(local_quality) = q_str.parse::<crate::tidal::Quality>() {
                                                let sufficient = local_quality >= target_quality;
                                                if !sufficient {
                                                    log::warn!("[Resolver] Local quality {:?} < Target {:?}. Streaming preferred.", local_quality, target_quality);
                                                }
                                                sufficient
                                            } else { true }
                                        } else { true }
                                    } else { true };

                                    if local_is_sufficient {
                                        return Ok(ResolvedAudio {
                                            path,
                                            source: "LOCAL".to_string(),
                                            quality: quality_str.unwrap_or("UNKNOWN".to_string()),
                                        });
                                    }
                                } else {
                                    // Stale record cleanup
                                     let _ = library.clear_download_info(tid).await;
                                }
                            }
                         }
                     }
                 }

                 // 3. Stream from Provider
                 log::debug!("[Resolver] Streaming {} from {}", id_str, scheme);
                 let stream_info = provider.get_stream_url(id_str, unified_quality).await
                    .map_err(|e| format!("Failed to resolve stream from {}: {}", scheme, e))?;

                 return Ok(ResolvedAudio {
                     path: stream_info.url,
                     source: "STREAM".to_string(),
                     quality: format!("{:?}", stream_info.quality),
                 });
             }
        }
    }

    // Fallback: Local File Handling (Original Logic)
    if !uri.starts_with("http://") && !uri.starts_with("https://") && !Path::new(uri).exists() {
        log::warn!("[Resolver] Local file not found: {}. Cannot play.", uri);
        return Err(format!("File not found: {}", uri));
    }
    
    Ok(ResolvedAudio {
        path: uri.to_string(),
        source: "LOCAL".to_string(),
        quality: "UNKNOWN".to_string(),
    })
}
