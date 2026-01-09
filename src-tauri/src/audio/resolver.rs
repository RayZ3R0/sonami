use parking_lot::Mutex;
use std::sync::mpsc;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager};

use crate::tidal::{Quality, TidalClient};

pub type ResolveRequest = (String, mpsc::Sender<Result<String, String>>);

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

    pub fn resolve(&self, uri: &str) -> Result<String, String> {
        if !uri.starts_with("tidal:") {
            return Ok(uri.to_string());
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

async fn resolve_uri(app_handle: &AppHandle, uri: &str) -> Result<String, String> {
    if !uri.starts_with("tidal:") {
        return Ok(uri.to_string());
    }

    let id_str = uri.trim_start_matches("tidal:");
    let id = id_str
        .parse::<u64>()
        .map_err(|_| format!("Invalid Tidal ID: {}", id_str))?;

    let client = app_handle
        .try_state::<TidalClient>()
        .ok_or_else(|| "Tidal client not initialized".to_string())?;

    let stream_info = client
        .get_track(id, Quality::LOSSLESS)
        .await
        .map_err(|e| format!("Failed to resolve Tidal track: {}", e))?;

    Ok(stream_info.url)
}
