use std::path::PathBuf;

pub const ENDPOINTS_URL: &str = "https://raw.githubusercontent.com/EduardPrigoana/hifi-instances/refs/heads/main/instances.json";
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
