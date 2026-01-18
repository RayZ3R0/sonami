use crate::providers::traits::{LyricsProvider, MusicProvider};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub enabled: bool,
    pub config: serde_json::Value,
}

pub struct ProviderManager {
    providers: Arc<RwLock<HashMap<String, Box<dyn MusicProvider>>>>,
    lyrics_providers: Arc<RwLock<HashMap<String, Box<dyn LyricsProvider>>>>,
    active_provider: Arc<RwLock<Option<String>>>,
}

impl ProviderManager {
    pub fn new() -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
            lyrics_providers: Arc::new(RwLock::new(HashMap::new())),
            active_provider: Arc::new(RwLock::new(None)), // Default to None, set later
        }
    }

    pub async fn register_provider(&self, provider: Box<dyn MusicProvider>) {
        let mut providers = self.providers.write().await;
        let id = provider.id().to_string();
        log::info!("Registering music provider: {} ({})", provider.name(), id);
        providers.insert(id, provider);
    }

    pub async fn get_provider(&self, id: &str) -> Option<Box<dyn MusicProvider>> {
        // We can't return Box<dyn> easily from a map without cloning or something, 
        // but since we want to use it, we might need shared ownership or return a reference 
        // if we weren't async.
        // Actually, since MusicProvider is Send+Sync, maybe we store them in Arc?
        // Let's refactor to store Arc<dyn MusicProvider>.
        None // Placeholder, will fix in the structural definition below
    }
    
    // Better approach: Store Arc<dyn MusicProvider>
}

// Redefining struct for Arc usage
pub struct ProviderManagerArc {
    providers: Arc<RwLock<HashMap<String, Arc<dyn MusicProvider>>>>,
    lyrics_providers: Arc<RwLock<HashMap<String, Arc<dyn LyricsProvider>>>>,
    active_provider: Arc<RwLock<Option<String>>>,
}

impl ProviderManagerArc {
    pub fn new() -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
            lyrics_providers: Arc::new(RwLock::new(HashMap::new())),
            active_provider: Arc::new(RwLock::new(Some("tidal".to_string()))), // Default to tidal for now
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
}
