use crate::database::DatabaseManager;
use crate::jellyfin::JellyfinProvider;
use crate::providers::ProviderManager;
use crate::subsonic::SubsonicProvider;
use std::sync::Arc;
use tauri::State;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ProviderConfig {
    pub provider_id: String,
    pub server_url: String,
    pub username: String,
    pub enabled: bool,
}

#[tauri::command]
pub async fn configure_subsonic(
    db: State<'_, DatabaseManager>,
    provider_manager: State<'_, Arc<ProviderManager>>,
    server_url: String,
    username: String,
    password: String,
) -> Result<String, String> {
    // 1. Test connection first using getUser.view (compatible with hifi)
    let provider =
        SubsonicProvider::with_config(server_url.clone(), username.clone(), password.clone());
    provider
        .authenticate()
        .await
        .map_err(|e| format!("Connection test failed: {}", e))?;

    // 2. Save to database
    sqlx::query(
        r#"
        INSERT OR REPLACE INTO provider_configs (provider_id, server_url, username, password, updated_at)
        VALUES ('subsonic', ?, ?, ?, strftime('%s', 'now'))
        "#
    )
    .bind(&server_url)
    .bind(&username)
    .bind(&password)
    .execute(&db.pool)
    .await
    .map_err(|e| format!("Failed to save config: {}", e))?;

    // 3. Register provider
    provider_manager.register_provider(Arc::new(provider)).await;

    log::info!(
        "Subsonic provider configured successfully for {}",
        server_url
    );
    Ok("Subsonic configured successfully".to_string())
}

#[tauri::command]
pub async fn configure_jellyfin(
    db: State<'_, DatabaseManager>,
    provider_manager: State<'_, Arc<ProviderManager>>,
    server_url: String,
    username: String,
    password: String,
) -> Result<String, String> {
    // 1. Test connection by authenticating
    let mut provider = JellyfinProvider::new();
    provider.server_url = server_url.clone();
    provider
        .authenticate(&username, &password)
        .await
        .map_err(|e| format!("Authentication failed: {}", e))?;

    // 2. Save to database
    sqlx::query(
        r#"
        INSERT OR REPLACE INTO provider_configs (provider_id, server_url, username, password, updated_at)
        VALUES ('jellyfin', ?, ?, ?, strftime('%s', 'now'))
        "#
    )
    .bind(&server_url)
    .bind(&username)
    .bind(&password)
    .execute(&db.pool)
    .await
    .map_err(|e| format!("Failed to save config: {}", e))?;

    // 3. Register provider
    provider_manager.register_provider(Arc::new(provider)).await;

    log::info!(
        "Jellyfin provider configured successfully for {}",
        server_url
    );
    Ok("Jellyfin configured successfully".to_string())
}

#[tauri::command]
pub async fn get_provider_configs(
    db: State<'_, DatabaseManager>,
) -> Result<Vec<ProviderConfig>, String> {
    let configs: Vec<(String, String, String, i32)> =
        sqlx::query_as("SELECT provider_id, server_url, username, enabled FROM provider_configs")
            .fetch_all(&db.pool)
            .await
            .map_err(|e| format!("Failed to fetch configs: {}", e))?;

    Ok(configs
        .into_iter()
        .map(|(id, url, user, enabled)| ProviderConfig {
            provider_id: id,
            server_url: url,
            username: user,
            enabled: enabled == 1,
        })
        .collect())
}

#[tauri::command]
pub async fn remove_provider_config(
    db: State<'_, DatabaseManager>,
    provider_id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM provider_configs WHERE provider_id = ?")
        .bind(&provider_id)
        .execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to remove config: {}", e))?;

    log::info!("Removed provider config: {}", provider_id);
    Ok(())
}

#[derive(serde::Serialize)]
pub struct HifiInstanceConfig {
    pub endpoints_url: String,
    pub is_default: bool,
}

#[tauri::command]
pub async fn get_hifi_config() -> Result<HifiInstanceConfig, String> {
    use crate::tidal::config::HifiConfig;

    let config = HifiConfig::load();
    // is_default now means "not configured" (empty URL)
    let is_default = config.endpoints_url.is_empty();

    Ok(HifiInstanceConfig {
        endpoints_url: config.endpoints_url,
        is_default,
    })
}

#[tauri::command]
pub async fn set_hifi_config(endpoints_url: String) -> Result<String, String> {
    use crate::tidal::config::HifiConfig;

    let config = HifiConfig {
        endpoints_url: endpoints_url.clone(),
    };

    config
        .save()
        .map_err(|e| format!("Failed to save HiFi config: {}", e))?;

    // Clear the endpoint cache so it reloads with new URL
    let cache_path = crate::tidal::config::get_cache_file_path();
    if cache_path.exists() {
        let _ = std::fs::remove_file(&cache_path);
        log::info!("Cleared endpoint cache after URL change");
    }

    log::info!("HiFi instance URL updated to: {}", endpoints_url);
    Ok("HiFi configuration saved successfully".to_string())
}

#[tauri::command]
pub async fn reset_hifi_config() -> Result<String, String> {
    use crate::tidal::config::HifiConfig;

    let config = HifiConfig {
        endpoints_url: String::new(),
    };

    config
        .save()
        .map_err(|e| format!("Failed to clear HiFi config: {}", e))?;

    // Clear the endpoint cache
    let cache_path = crate::tidal::config::get_cache_file_path();
    if cache_path.exists() {
        let _ = std::fs::remove_file(&cache_path);
    }

    log::info!("HiFi instance URL cleared");
    Ok("HiFi configuration cleared".to_string())
}
