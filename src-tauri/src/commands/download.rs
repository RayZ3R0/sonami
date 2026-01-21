use std::path::PathBuf;
use tauri::State;

use crate::download::{DownloadManager, TrackMetadata};
use crate::tidal::{Quality, TidalClient};

#[tauri::command]
pub async fn start_download(
    download_manager: State<'_, DownloadManager>,
    tidal_client: State<'_, TidalClient>,
    track_id: u64,
    metadata: TrackMetadata,
    quality: String,
) -> Result<String, String> {
    let quality = quality.parse::<Quality>().unwrap_or(Quality::LOSSLESS);

    let path = download_manager
        .download_tidal_track(track_id, metadata, &tidal_client, quality)
        .await?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_download_path(
    download_manager: State<'_, DownloadManager>,
) -> Result<String, String> {
    let path = download_manager.get_download_path();
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn set_download_path(
    download_manager: State<'_, DownloadManager>,
    path: String,
) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        std::fs::create_dir_all(&path_buf)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    download_manager.set_download_path(path_buf)
}

#[tauri::command]
pub async fn open_download_folder(
    download_manager: State<'_, DownloadManager>,
) -> Result<(), String> {
    let path = download_manager.get_download_path();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_track_download(
    library_manager: State<'_, crate::library::LibraryManager>,
    provider_id: String,
    external_id: String,
) -> Result<(), String> {
    // Clear from database and get the old path
    let old_path = library_manager
        .clear_download_info(&provider_id, &external_id)
        .await?;

    // Delete the file if it exists
    if let Some(path) = old_path {
        let path_buf = std::path::PathBuf::from(&path);
        if path_buf.exists() {
            std::fs::remove_file(&path_buf).map_err(|e| format!("Failed to delete file: {}", e))?;
            log::info!("Deleted downloaded file: {}", path);
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn download_provider_track(
    download_manager: State<'_, DownloadManager>,
    provider_manager: State<'_, std::sync::Arc<crate::providers::ProviderManager>>,
    provider_id: String,
    external_id: String,
    metadata: TrackMetadata,
    quality: String,
) -> Result<String, String> {
    let quality = quality
        .parse::<crate::models::Quality>()
        .unwrap_or(crate::models::Quality::LOSSLESS);

    let path = download_manager
        .download_provider_track(
            &provider_id,
            &external_id,
            metadata,
            &provider_manager,
            quality,
        )
        .await?;

    Ok(path.to_string_lossy().to_string())
}
