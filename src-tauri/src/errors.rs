use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "type", content = "message")]
pub enum AppError {
    #[error("Network error: {0}")]
    Network(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("File system error: {0}")]
    FileSystem(String),

    #[error("Invalid provider: {0}")]
    InvalidProvider(String),

    #[error("Track not found: {0}")]
    TrackNotFound(String),

    #[error("Download failed: {0}")]
    Download(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Authentication error: {0}")]
    Auth(String),
}

// Implement From traits for common error types to simplify conversion

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::FileSystem(e.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Network(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Internal(format!("Serialization error: {}", e))
    }
}

// Helper for implementing From<String> where appropriate,
// though usually we want more specific types.
impl From<String> for AppError {
    fn from(e: String) -> Self {
        AppError::Internal(e)
    }
}
