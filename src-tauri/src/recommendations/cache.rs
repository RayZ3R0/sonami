//! Persistent SQLite-backed recommendation cache.
//!
//! Provides a 24-hour TTL cache layer that survives app restarts.
//! Works alongside the in-memory cache (5min hot) for two-tier caching:
//!
//! ```text
//! [Request] → [In-Memory 5min] → [SQLite 24hr] → [Spotify API + Providers]
//! ```

use crate::recommendations::errors::RecommendationError;
use crate::recommendations::types::RecommendationSection;
use chrono::{DateTime, TimeDelta, Utc};
use sqlx::{Pool, Sqlite};

/// How long persistent cache entries remain valid (24 hours).
const PERSISTENT_CACHE_TTL_SECS: i64 = 24 * 60 * 60;

/// After this age, data is considered stale and a background refresh is triggered (12 hours).
const STALE_THRESHOLD_SECS: i64 = 12 * 60 * 60;

/// Persistent recommendation cache backed by SQLite.
#[derive(Debug, Clone)]
pub struct RecommendationCache {
    pool: Pool<Sqlite>,
}

/// A cached recommendation entry retrieved from the database.
#[derive(Debug, Clone)]
pub struct CachedRecommendation {
    pub artist_name: String,
    pub section: RecommendationSection,
    pub playlist_uri: String,
    pub cached_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

impl CachedRecommendation {
    /// Whether this entry has expired (older than 24 hours).
    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }

    /// Whether this entry is stale (older than 12 hours but not yet expired).
    /// Stale entries are served immediately but trigger a background refresh.
    pub fn is_stale(&self) -> bool {
        let age = Utc::now() - self.cached_at;
        age > TimeDelta::seconds(STALE_THRESHOLD_SECS) && !self.is_expired()
    }
}

impl RecommendationCache {
    /// Create a new persistent cache backed by the given SQLite pool.
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    /// Look up a cached recommendation for the given artist.
    ///
    /// Returns `None` if no entry exists or it has expired.
    pub async fn get(
        &self,
        artist_name: &str,
    ) -> Result<Option<CachedRecommendation>, RecommendationError> {
        let key = artist_name.to_lowercase();
        let now = Utc::now().timestamp();

        let row: Option<(String, String, i64, i64)> = sqlx::query_as(
            r#"
            SELECT section_json, playlist_uri, cached_at, expires_at
            FROM recommendation_cache
            WHERE artist_name = ? AND expires_at > ?
            "#,
        )
        .bind(&key)
        .bind(now)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some((section_json, playlist_uri, cached_at, expires_at)) => {
                let section: RecommendationSection =
                    serde_json::from_str(&section_json).map_err(|e| {
                        RecommendationError::Internal(format!(
                            "Failed to deserialize cached section: {}",
                            e
                        ))
                    })?;

                Ok(Some(CachedRecommendation {
                    artist_name: key,
                    section,
                    playlist_uri,
                    cached_at: DateTime::from_timestamp(cached_at, 0)
                        .unwrap_or_else(Utc::now),
                    expires_at: DateTime::from_timestamp(expires_at, 0)
                        .unwrap_or_else(Utc::now),
                }))
            }
            None => Ok(None),
        }
    }

    /// Store a recommendation section in the persistent cache.
    ///
    /// Uses UPSERT to handle concurrent writes safely.
    pub async fn set(
        &self,
        artist_name: &str,
        section: &RecommendationSection,
        playlist_uri: &str,
    ) -> Result<(), RecommendationError> {
        let key = artist_name.to_lowercase();
        let now = Utc::now();
        let expires = now
            + TimeDelta::seconds(PERSISTENT_CACHE_TTL_SECS);
        let section_json = serde_json::to_string(section).map_err(|e| {
            RecommendationError::Internal(format!("Failed to serialize section: {}", e))
        })?;

        sqlx::query(
            r#"
            INSERT INTO recommendation_cache (artist_name, section_json, playlist_uri, cached_at, expires_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(artist_name) DO UPDATE SET
                section_json = excluded.section_json,
                playlist_uri = excluded.playlist_uri,
                cached_at = excluded.cached_at,
                expires_at = excluded.expires_at
            "#,
        )
        .bind(&key)
        .bind(&section_json)
        .bind(playlist_uri)
        .bind(now.timestamp())
        .bind(expires.timestamp())
        .execute(&self.pool)
        .await?;

        log::debug!(
            "Persisted recommendation cache for '{}' (expires {})",
            artist_name,
            expires
        );

        Ok(())
    }

    /// Remove all expired entries from the persistent cache.
    ///
    /// Returns the number of evicted rows.
    pub async fn evict_expired(&self) -> Result<u64, RecommendationError> {
        let now = Utc::now().timestamp();
        let result = sqlx::query("DELETE FROM recommendation_cache WHERE expires_at <= ?")
            .bind(now)
            .execute(&self.pool)
            .await?;

        let count = result.rows_affected();
        if count > 0 {
            log::info!("Evicted {} expired recommendation cache entries", count);
        }
        Ok(count)
    }

    /// Clear the entire persistent cache.
    pub async fn clear(&self) -> Result<(), RecommendationError> {
        sqlx::query("DELETE FROM recommendation_cache")
            .execute(&self.pool)
            .await?;
        log::info!("Persistent recommendation cache cleared");
        Ok(())
    }
}
