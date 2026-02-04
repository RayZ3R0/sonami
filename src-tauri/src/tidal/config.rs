use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;

use super::models::Quality;

// Default HiFi instances URL - can be overridden by user
pub const DEFAULT_ENDPOINTS_URL: &str = "https://raw.githubusercontent.com/EduardPrigoana/hifi-instances/refs/heads/main/instances.json";
pub const CACHE_TTL_SECONDS: u64 = 86400; // 24 hours
pub const REQUEST_TIMEOUT_SECONDS: u64 = 10;
pub const RATE_LIMIT_SLEEP_MS: u64 = 2000;
pub const MAX_STICKY_FAILURES: u32 = 3;

pub fn get_cache_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("sonami")
}

pub fn get_cache_file_path() -> PathBuf {
    get_cache_dir().join("tidal_cache.json")
}

pub fn get_hifi_config_path() -> PathBuf {
    get_cache_dir().join("hifi_config.json")
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HifiConfig {
    pub endpoints_url: String,
}

impl Default for HifiConfig {
    fn default() -> Self {
        Self {
            endpoints_url: DEFAULT_ENDPOINTS_URL.to_string(),
        }
    }
}

impl HifiConfig {
    pub fn load() -> Self {
        let path = get_hifi_config_path();
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(config) = serde_json::from_str(&content) {
                    return config;
                }
            }
        }
        Self::default()
    }

    pub fn save(&self) -> Result<(), std::io::Error> {
        let path = get_hifi_config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(path, content)
    }

    pub fn get_endpoints_url(&self) -> &str {
        if self.endpoints_url.is_empty() {
            DEFAULT_ENDPOINTS_URL
        } else {
            &self.endpoints_url
        }
    }
}

pub type HifiConfigState = Arc<Mutex<HifiConfig>>;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TidalConfig {
    pub quality: Quality,
    pub prefer_high_quality_stream: bool,
}

impl Default for TidalConfig {
    fn default() -> Self {
        Self {
            quality: Quality::LOSSLESS,
            prefer_high_quality_stream: true,
        }
    }
}

pub type TidalConfigState = Arc<Mutex<TidalConfig>>;
