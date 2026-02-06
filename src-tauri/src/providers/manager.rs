use crate::providers::traits::{LyricsProvider, MusicProvider};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub enabled: bool,
    pub config: serde_json::Value,
}

pub struct ProviderManagerArc {
    providers: Arc<RwLock<HashMap<String, Arc<dyn MusicProvider>>>>,
    #[allow(dead_code)]
    lyrics_providers: Arc<RwLock<HashMap<String, Arc<dyn LyricsProvider>>>>,
    active_provider: Arc<RwLock<Option<String>>>,
}

impl Default for ProviderManagerArc {
    fn default() -> Self {
        Self::new()
    }
}

impl ProviderManagerArc {
    pub fn new() -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
            lyrics_providers: Arc::new(RwLock::new(HashMap::new())),
            active_provider: Arc::new(RwLock::new(Some("tidal".to_string()))),
        }
    }

    pub async fn register_provider(&self, provider: Arc<dyn MusicProvider>) {
        let mut providers = self.providers.write().await;
        let id = provider.id().to_string();
        log::info!("Registering music provider: {} ({})", provider.name(), id);
        providers.insert(id, provider);
    }

    pub async fn get_provider(&self, id: &str) -> Option<Arc<dyn MusicProvider>> {
        let providers = self.providers.read().await;
        providers.get(id).cloned()
    }

    pub async fn get_active_provider(&self) -> Option<Arc<dyn MusicProvider>> {
        let active = self.active_provider.read().await;
        if let Some(ref id) = *active {
            return self.get_provider(id).await;
        }
        None
    }

    pub async fn set_active_provider(&self, id: String) -> Result<(), String> {
        let providers = self.providers.read().await;
        if providers.contains_key(&id) {
            let mut active = self.active_provider.write().await;
            *active = Some(id);
            Ok(())
        } else {
            Err(format!("Provider {} not found", id))
        }
    }

    pub async fn list_providers(&self) -> Vec<String> {
        let providers = self.providers.read().await;
        providers.keys().cloned().collect()
    }

    /// Get all registered providers for iteration (used by recommendation engine)
    pub async fn get_all_providers(&self) -> Vec<Arc<dyn MusicProvider>> {
        let providers = self.providers.read().await;
        providers.values().cloned().collect()
    }
}
