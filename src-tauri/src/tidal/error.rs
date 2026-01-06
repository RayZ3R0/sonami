use std::fmt;

#[derive(Debug)]
pub enum TidalError {
    NetworkError(String),
    ParseError(String),
    NotFound(String),
    AllEndpointsFailed,
    CacheError(String),
    InvalidResponse(String),
}

impl fmt::Display for TidalError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TidalError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            TidalError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            TidalError::NotFound(msg) => write!(f, "Not found: {}", msg),
            TidalError::AllEndpointsFailed => write!(f, "All API endpoints failed"),
            TidalError::CacheError(msg) => write!(f, "Cache error: {}", msg),
            TidalError::InvalidResponse(msg) => write!(f, "Invalid response: {}", msg),
        }
    }
}

impl std::error::Error for TidalError {}

impl From<reqwest::Error> for TidalError {
    fn from(err: reqwest::Error) -> Self {
        TidalError::NetworkError(err.to_string())
    }
}

impl From<serde_json::Error> for TidalError {
    fn from(err: serde_json::Error) -> Self {
        TidalError::ParseError(err.to_string())
    }
}

impl From<std::io::Error> for TidalError {
    fn from(err: std::io::Error) -> Self {
        TidalError::CacheError(err.to_string())
    }
}
