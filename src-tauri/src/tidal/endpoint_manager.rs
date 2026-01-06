use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use super::config::*;
use super::error::TidalError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Endpoint {
    pub name: String,
    pub url: String,
    pub priority: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StickyEndpoint {
    endpoint: Endpoint,
    last_success: u64, // Unix timestamp
    failure_count: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct EndpointCache {
    timestamp: u64,
    endpoints: Vec<Endpoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sticky_endpoint: Option<StickyEndpoint>,
}

pub struct EndpointManager {
    endpoints: Vec<Endpoint>,
    sticky: Arc<RwLock<Option<StickyEndpoint>>>,
    cache_path: PathBuf,
    cache_timestamp: Arc<RwLock<Option<Instant>>>,
}

impl EndpointManager {
    pub async fn new() -> Result<Self, TidalError> {
        let cache_path = get_cache_file_path();

        // Ensure cache directory exists
        if let Some(parent) = cache_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let (endpoints, sticky, cache_time) = Self::load_endpoints_with_cache(&cache_path).await?;

        Ok(Self {
            endpoints,
            sticky: Arc::new(RwLock::new(sticky)),
            cache_path,
            cache_timestamp: Arc::new(RwLock::new(cache_time)),
        })
    }

    async fn load_endpoints_with_cache(
        cache_path: &PathBuf,
    ) -> Result<(Vec<Endpoint>, Option<StickyEndpoint>, Option<Instant>), TidalError> {
        // Try loading from cache first
        if let Ok(cache_data) = Self::load_from_cache(cache_path) {
            let age = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs()
                - cache_data.timestamp;

            if age < CACHE_TTL_SECONDS {
                log::info!(
                    "Loaded {} endpoints from cache (age: {}s)",
                    cache_data.endpoints.len(),
                    age
                );
                return Ok((
                    cache_data.endpoints,
                    cache_data.sticky_endpoint,
                    Some(Instant::now()),
                ));
            } else {
                log::info!("Cache expired (age: {}s), fetching from GitHub", age);
            }
        }

        // Try fetching from GitHub
        match Self::fetch_from_github().await {
            Ok(endpoints) => {
                log::info!("Fetched {} endpoints from GitHub", endpoints.len());
                Self::save_to_cache(cache_path, &endpoints, None)?;
                Ok((endpoints, None, Some(Instant::now())))
            }
            Err(e) => {
                log::warn!("Failed to fetch from GitHub: {}, trying cache fallback", e);
                // Fallback to expired cache if GitHub fails
                if let Ok(cache_data) = Self::load_from_cache(cache_path) {
                    log::warn!("Using expired cache as fallback");
                    Ok((cache_data.endpoints, cache_data.sticky_endpoint, None))
                } else {
                    Err(TidalError::AllEndpointsFailed)
                }
            }
        }
    }

    async fn fetch_from_github() -> Result<Vec<Endpoint>, TidalError> {
        let client = Client::builder().timeout(Duration::from_secs(10)).build()?;

        let response = client.get(ENDPOINTS_URL).send().await?;

        if !response.status().is_success() {
            return Err(TidalError::NetworkError(format!(
                "HTTP {}",
                response.status()
            )));
        }

        let text = response.text().await?;
        let json: serde_json::Value = serde_json::from_str(&text)?;
        Self::parse_instances_json(&json)
    }

    fn parse_instances_json(data: &serde_json::Value) -> Result<Vec<Endpoint>, TidalError> {
        let api_section = data
            .get("api")
            .ok_or_else(|| TidalError::ParseError("Missing 'api' section".to_string()))?;

        let mut endpoints = Vec::new();
        let mut priority = 1;

        if let Some(obj) = api_section.as_object() {
            for (provider_name, provider_data) in obj {
                if let Some(urls) = provider_data.get("urls").and_then(|v| v.as_array()) {
                    for url_value in urls {
                        if let Some(url) = url_value.as_str() {
                            let url = url.trim_end_matches('/').to_string();
                            let name = url
                                .replace("https://", "")
                                .replace("http://", "")
                                .split('.')
                                .next()
                                .unwrap_or("unknown")
                                .to_string();

                            endpoints.push(Endpoint {
                                name,
                                url,
                                priority,
                                provider: Some(provider_name.clone()),
                            });
                        }
                    }
                    priority += 1;
                }
            }
        }

        if endpoints.is_empty() {
            return Err(TidalError::ParseError(
                "No endpoints found in response".to_string(),
            ));
        }

        Ok(endpoints)
    }

    fn load_from_cache(path: &PathBuf) -> Result<EndpointCache, TidalError> {
        let content = fs::read_to_string(path)?;
        let cache: EndpointCache = serde_json::from_str(&content)?;
        Ok(cache)
    }

    fn save_to_cache(
        path: &PathBuf,
        endpoints: &[Endpoint],
        sticky: Option<&StickyEndpoint>,
    ) -> Result<(), TidalError> {
        let cache = EndpointCache {
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            endpoints: endpoints.to_vec(),
            sticky_endpoint: sticky.cloned(),
        };

        let json = serde_json::to_string_pretty(&cache)?;
        fs::write(path, json)?;
        Ok(())
    }

    pub fn get_next_endpoint(&self) -> Option<Endpoint> {
        // Check sticky endpoint first
        if let Ok(sticky_guard) = self.sticky.read() {
            if let Some(sticky) = sticky_guard.as_ref() {
                if sticky.failure_count < MAX_STICKY_FAILURES {
                    log::debug!(
                        "Using sticky endpoint: {} (failures: {})",
                        sticky.endpoint.name,
                        sticky.failure_count
                    );
                    return Some(sticky.endpoint.clone());
                } else {
                    log::warn!(
                        "Sticky endpoint {} failed {} times, cycling to others",
                        sticky.endpoint.name,
                        sticky.failure_count
                    );
                }
            }
        }

        // Sort by priority
        let mut sorted = self.endpoints.clone();
        sorted.sort_by_key(|e| (e.priority, e.name.clone()));

        sorted.into_iter().next()
    }

    pub fn get_all_endpoints(&self) -> Vec<Endpoint> {
        let mut sorted = self.endpoints.clone();
        sorted.sort_by_key(|e| (e.priority, e.name.clone()));
        sorted
    }

    pub fn record_success(&self, endpoint: &Endpoint) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let new_sticky = StickyEndpoint {
            endpoint: endpoint.clone(),
            last_success: now,
            failure_count: 0,
        };

        if let Ok(mut sticky_guard) = self.sticky.write() {
            *sticky_guard = Some(new_sticky.clone());
            log::info!("✓ Sticky endpoint set to: {}", endpoint.name);

            // Save to cache
            let _ = Self::save_to_cache(&self.cache_path, &self.endpoints, Some(&new_sticky));
        }
    }

    pub fn record_failure(&self, endpoint: &Endpoint) {
        if let Ok(mut sticky_guard) = self.sticky.write() {
            if let Some(sticky) = sticky_guard.as_mut() {
                if sticky.endpoint.url == endpoint.url {
                    sticky.failure_count += 1;
                    log::warn!(
                        "Sticky endpoint {} failed (count: {})",
                        endpoint.name,
                        sticky.failure_count
                    );

                    if sticky.failure_count >= MAX_STICKY_FAILURES {
                        log::warn!(
                            "Resetting sticky endpoint after {} failures",
                            sticky.failure_count
                        );
                        *sticky_guard = None;
                    }
                }
            }
        }
    }

    pub async fn refresh_cache(&mut self) -> Result<(), TidalError> {
        let endpoints = Self::fetch_from_github().await?;
        self.endpoints = endpoints.clone();

        let sticky = self.sticky.read().ok().and_then(|s| s.as_ref().cloned());
        Self::save_to_cache(&self.cache_path, &endpoints, sticky.as_ref())?;

        if let Ok(mut ts) = self.cache_timestamp.write() {
            *ts = Some(Instant::now());
        }

        log::info!("Cache refreshed with {} endpoints", self.endpoints.len());
        Ok(())
    }
}
