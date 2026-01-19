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
    // 1. Test connection first
    let provider =
        SubsonicProvider::with_config(server_url.clone(), username.clone(), password.clone());
    provider
        .ping()
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
