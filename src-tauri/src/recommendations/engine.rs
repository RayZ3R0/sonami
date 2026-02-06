//! Recommendation engine implementation.
//!
//! Generates music recommendations by:
//! 1. Finding artist radio playlists on Spotify
//! 2. Extracting tracks from those playlists
//! 3. Matching tracks against local providers (Tidal, Subsonic, Jellyfin)
//!
//! Includes TTL-based caching and rate limiting for provider searches.

use crate::providers::ProviderManager;
use crate::recommendations::cache::RecommendationCache;
use crate::recommendations::errors::RecommendationError;
use crate::recommendations::types::{RecommendationSection, RecommendedTrack};
use crate::spotify::romanize_japanese;
use spotapi::{PublicPlaylist, SpotifySearch};
use sqlx::{Pool, Sqlite};
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// How long cached recommendation sections remain valid.
const CACHE_TTL: Duration = Duration::from_secs(5 * 60); // 5 minutes

/// Delay between individual provider search calls to avoid rate limits.
const PROVIDER_SEARCH_DELAY: Duration = Duration::from_millis(100);

/// Maximum number of cached sections before evicting oldest entries.
const MAX_CACHE_ENTRIES: usize = 50;

/// A cached recommendation section with its insertion time.
struct CachedSection {
    section: RecommendationSection,
    cached_at: Instant,
}

impl CachedSection {
    fn is_expired(&self) -> bool {
        self.cached_at.elapsed() > CACHE_TTL
    }
}

/// Matched track info from provider search results.
struct MatchedTrackInfo {
    /// Raw external ID (without provider prefix)
    external_id: String,
    /// Artist ID on the provider (if available)
    artist_id: Option<String>,
    /// Album ID on the provider (if available)
    album_id: Option<String>,
}

/// Engine for generating music recommendations.
///
/// Holds a shared `SpotifySearch` instance and an in-memory TTL cache
/// keyed by lowercase artist name. Designed to be created once and
/// managed as Tauri state.
pub struct RecommendationEngine {
    search: Arc<Mutex<SpotifySearch>>,
    provider_manager: Arc<ProviderManager>,
    cache: Mutex<HashMap<String, CachedSection>>,
    /// Persistent SQLite cache, initialized once the database is ready.
    persistent_cache: OnceLock<RecommendationCache>,
}

impl RecommendationEngine {
    /// Create a new recommendation engine.
    pub fn new(provider_manager: Arc<ProviderManager>) -> Self {
        Self {
            search: Arc::new(Mutex::new(SpotifySearch::new())),
            provider_manager,
            cache: Mutex::new(HashMap::new()),
            persistent_cache: OnceLock::new(),
        }
    }

    /// Initialize the persistent cache layer once the database pool is available.
    ///
    /// Called from the async setup after DatabaseManager is created.
    pub fn init_persistent_cache(&self, pool: Pool<Sqlite>) {
        let _ = self.persistent_cache.set(RecommendationCache::new(pool));
        log::info!("Persistent recommendation cache initialized");
    }

    /// Generate recommendations for a specific artist.
    ///
    /// Returns a cached result if one exists and hasn't expired,
    /// otherwise fetches fresh data from Spotify and resolves provider matches.
    pub async fn generate_for_artist(
        &self,
        artist_name: &str,
    ) -> Result<RecommendationSection, RecommendationError> {
        let cache_key = artist_name.to_lowercase();

        // 1. Check in-memory cache first (5min hot cache)
        {
            let cache = self.cache.lock().await;
            if let Some(entry) = cache.get(&cache_key) {
                if !entry.is_expired() {
                    log::debug!("Memory cache hit for artist '{}'", artist_name);
                    return Ok(entry.section.clone());
                }
            }
        }

        // 2. Check persistent SQLite cache (24hr)
        if let Some(pcache) = self.persistent_cache.get() {
            match pcache.get(&cache_key).await {
                Ok(Some(cached)) if !cached.is_expired() => {
                    log::debug!("Persistent cache hit for artist '{}'", artist_name);

                    // Promote to in-memory cache
                    {
                        let mut cache = self.cache.lock().await;
                        cache.insert(
                            cache_key.clone(),
                            CachedSection {
                                section: cached.section.clone(),
                                cached_at: Instant::now(),
                            },
                        );
                    }

                    // Stale-while-revalidate: if >12hr old, refresh in background
                    if cached.is_stale() {
                        log::info!(
                            "Stale cache for '{}', triggering background refresh",
                            artist_name
                        );
                        let engine_search = self.search.clone();
                        let engine_providers = self.provider_manager.clone();
                        let pcache_clone = pcache.clone();
                        let artist = artist_name.to_string();

                        tokio::spawn(async move {
                            match Self::generate_fresh_static(
                                &artist,
                                &engine_search,
                                &engine_providers,
                            )
                            .await
                            {
                                Ok(section) => {
                                    let uri = section
                                        .source_playlist_uri
                                        .as_deref()
                                        .unwrap_or("");
                                    if let Err(e) =
                                        pcache_clone.set(&artist, &section, uri).await
                                    {
                                        log::warn!(
                                            "Background refresh cache write failed for '{}': {}",
                                            artist,
                                            e
                                        );
                                    } else {
                                        log::info!(
                                            "Background refresh complete for '{}'",
                                            artist
                                        );
                                    }
                                }
                                Err(e) => {
                                    log::warn!(
                                        "Background refresh failed for '{}': {}",
                                        artist,
                                        e
                                    );
                                }
                            }
                        });
                    }

                    return Ok(cached.section);
                }
                Ok(_) => {} // miss or expired
                Err(e) => {
                    log::warn!("Persistent cache read error for '{}': {}", artist_name, e);
                }
            }
        }

        log::info!("Generating recommendations for artist: {}", artist_name);

        // 1. Find artist radio playlist
        let playlist_uri = {
            let mut search = self.search.lock().await;
            search
                .artist_radio(artist_name)
                .await
                .map_err(|e| RecommendationError::SpotifyApi(e.to_string()))?
                .ok_or_else(|| {
                    RecommendationError::NoRadioPlaylist(artist_name.to_string())
                })?
        };

        log::info!("Found radio playlist: {}", playlist_uri);

        // 2. Fetch tracks from the playlist
        let mut playlist = PublicPlaylist::new(&playlist_uri);
        let raw_tracks = playlist
            .get_tracks()
            .await
            .map_err(|e| RecommendationError::SpotifyApi(e.to_string()))?;

        log::info!("Fetched {} tracks from radio", raw_tracks.len());

        // 3. Parse tracks into our format
        let mut tracks: Vec<RecommendedTrack> = Vec::new();
        for item in raw_tracks.iter().take(50) {
            if let Some(track) = Self::parse_spotify_track(item) {
                tracks.push(track);
            }
        }

        // 4. Try to match tracks against local providers (with rate limiting)
        self.resolve_provider_matches(&mut tracks).await;

        let playable = tracks.iter().filter(|t| t.is_playable()).count();
        log::info!(
            "Recommendations ready: {} tracks, {} playable",
            tracks.len(),
            playable
        );

        let section = RecommendationSection {
            title: format!("{} Radio", artist_name),
            description: format!("Music inspired by {}", artist_name),
            seed_artist: artist_name.to_string(),
            source_playlist_uri: Some(playlist_uri.clone()),
            tracks,
        };

        // Store in persistent cache
        if let Some(pcache) = self.persistent_cache.get() {
            if let Err(e) = pcache.set(&cache_key, &section, &playlist_uri).await {
                log::warn!("Failed to persist recommendation cache for '{}': {}", artist_name, e);
            }
        }

        // Store in in-memory cache (evict oldest if at capacity)
        {
            let mut cache = self.cache.lock().await;
            Self::evict_expired(&mut cache);
            if cache.len() >= MAX_CACHE_ENTRIES {
                // Remove the oldest entry
                if let Some(oldest_key) = cache
                    .iter()
                    .min_by_key(|(_, v)| v.cached_at)
                    .map(|(k, _)| k.clone())
                {
                    cache.remove(&oldest_key);
                }
            }
            cache.insert(
                cache_key,
                CachedSection {
                    section: section.clone(),
                    cached_at: Instant::now(),
                },
            );
        }

        Ok(section)
    }

    /// Remove all expired entries from the cache.
    fn evict_expired(cache: &mut HashMap<String, CachedSection>) {
        cache.retain(|_, v| !v.is_expired());
    }

    /// Clear all recommendation caches (in-memory + persistent).
    pub async fn clear_cache(&self) {
        let mut cache = self.cache.lock().await;
        cache.clear();

        if let Some(pcache) = self.persistent_cache.get() {
            if let Err(e) = pcache.clear().await {
                log::warn!("Failed to clear persistent cache: {}", e);
            }
        }

        log::info!("Recommendation cache cleared (memory + persistent)");
    }

    /// Generate fresh recommendations without any caching.
    ///
    /// Static version used by background refresh tasks that don't
    /// have access to `&self`.
    async fn generate_fresh_static(
        artist_name: &str,
        search: &Arc<Mutex<SpotifySearch>>,
        provider_manager: &Arc<ProviderManager>,
    ) -> Result<RecommendationSection, RecommendationError> {
        // 1. Find artist radio playlist
        let playlist_uri = {
            let mut s = search.lock().await;
            s.artist_radio(artist_name)
                .await
                .map_err(|e| RecommendationError::SpotifyApi(e.to_string()))?
                .ok_or_else(|| RecommendationError::NoRadioPlaylist(artist_name.to_string()))?
        };

        // 2. Fetch tracks from the playlist
        let mut playlist = PublicPlaylist::new(&playlist_uri);
        let raw_tracks = playlist
            .get_tracks()
            .await
            .map_err(|e| RecommendationError::SpotifyApi(e.to_string()))?;

        // 3. Parse tracks
        let mut tracks: Vec<RecommendedTrack> = Vec::new();
        for item in raw_tracks.iter().take(50) {
            if let Some(track) = Self::parse_spotify_track(item) {
                tracks.push(track);
            }
        }

        // 4. Resolve provider matches
        let providers = provider_manager.get_all_providers().await;
        if !providers.is_empty() {
            let max_matches = tracks.len().min(20);
            let mut search_count = 0u32;

            for track in tracks[..max_matches].iter_mut() {
                let primary_artist = Self::primary_artist(&track.artist);
                let clean_title = Self::clean_title(&track.title);
                let query = format!("{} {}", primary_artist, clean_title);

                for provider in &providers {
                    if search_count > 0 {
                        tokio::time::sleep(PROVIDER_SEARCH_DELAY).await;
                    }
                    search_count += 1;

                    if let Some(match_info) =
                        Self::try_search(provider.as_ref(), &query, &clean_title, &primary_artist)
                            .await
                    {
                        track.matched_provider_id = Some(provider.id().to_string());
                        track.matched_external_id = Some(match_info.external_id);
                        track.matched_artist_id = match_info.artist_id;
                        track.matched_album_id = match_info.album_id;
                        break;
                    }

                    // Romanization fallback
                    let romanized_title = romanize_japanese(&clean_title);
                    let romanized_artist = romanize_japanese(&primary_artist);
                    if romanized_title.is_some() || romanized_artist.is_some() {
                        let r_title = romanized_title.as_deref().unwrap_or(&clean_title);
                        let r_artist = romanized_artist.as_deref().unwrap_or(&primary_artist);
                        let romanized_query = format!("{} {}", r_artist, r_title);

                        tokio::time::sleep(PROVIDER_SEARCH_DELAY).await;
                        search_count += 1;

                        if let Some(match_info) = Self::try_search(
                            provider.as_ref(),
                            &romanized_query,
                            r_title,
                            r_artist,
                        )
                        .await
                        {
                            track.matched_provider_id = Some(provider.id().to_string());
                            track.matched_external_id = Some(match_info.external_id);
                            track.matched_artist_id = match_info.artist_id;
                            track.matched_album_id = match_info.album_id;
                            break;
                        }
                    }

                    // Title-only fallback
                    tokio::time::sleep(PROVIDER_SEARCH_DELAY).await;
                    search_count += 1;

                    if let Some(match_info) = Self::try_search(
                        provider.as_ref(),
                        &clean_title,
                        &clean_title,
                        &primary_artist,
                    )
                    .await
                    {
                        track.matched_provider_id = Some(provider.id().to_string());
                        track.matched_external_id = Some(match_info.external_id);
                        track.matched_artist_id = match_info.artist_id;
                        track.matched_album_id = match_info.album_id;
                        break;
                    }
                }
            }
        }

        Ok(RecommendationSection {
            title: format!("{} Radio", artist_name),
            description: format!("Music inspired by {}", artist_name),
            seed_artist: artist_name.to_string(),
            source_playlist_uri: Some(playlist_uri),
            tracks,
        })
    }

    /// Parse a Spotify track JSON into our RecommendedTrack format.
    fn parse_spotify_track(item: &serde_json::Value) -> Option<RecommendedTrack> {
        let data = item.get("itemV2")?.get("data")?;

        let title = data.get("name")?.as_str()?.to_string();

        let artists: Vec<&str> = data
            .get("artists")?
            .get("items")?
            .as_array()?
            .iter()
            .filter_map(|a| a.get("profile")?.get("name")?.as_str())
            .collect();
        let artist = artists.join(", ");

        let album = data
            .get("albumOfTrack")
            .and_then(|a| a.get("name"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string());

        let duration_ms = data
            .get("duration")
            .and_then(|d| d.get("totalMilliseconds"))
            .and_then(|ms| ms.as_u64())
            .unwrap_or(0) as u32;

        let cover_url = data
            .get("albumOfTrack")
            .and_then(|a| a.get("coverArt"))
            .and_then(|c| c.get("sources"))
            .and_then(|s| s.as_array())
            .and_then(|arr| arr.first())
            .and_then(|src| src.get("url"))
            .and_then(|u| u.as_str())
            .map(|s| s.to_string());

        let spotify_uri = data.get("uri")?.as_str()?.to_string();

        Some(RecommendedTrack {
            title,
            artist,
            album,
            duration_ms,
            cover_url,
            spotify_uri,
            matched_provider_id: None,
            matched_external_id: None,
            matched_local_id: None,
            matched_artist_id: None,
            matched_album_id: None,
        })
    }

    /// Try to match recommended tracks against registered providers.
    ///
    /// Uses the same multi-step search strategy as the Spotify import:
    /// 1. Primary search: "{primary_artist} {clean_title}"
    /// 2. Romanization fallback for Japanese/CJK text
    /// 3. Title-only fallback with artist fuzzy-match on results
    ///
    /// Only matches the first N tracks to keep response times reasonable.
    async fn resolve_provider_matches(&self, tracks: &mut [RecommendedTrack]) {
        let providers = self.provider_manager.get_all_providers().await;

        if providers.is_empty() {
            log::warn!("No providers registered, cannot resolve track matches");
            return;
        }

        // Only try to match up to 20 tracks to keep latency reasonable
        let max_matches = tracks.len().min(20);
        let mut search_count = 0u32;

        for track in tracks[..max_matches].iter_mut() {
            let primary_artist = Self::primary_artist(&track.artist);
            let clean_title = Self::clean_title(&track.title);
            let query = format!("{} {}", primary_artist, clean_title);

            for provider in &providers {
                // Rate limit between searches
                if search_count > 0 {
                    tokio::time::sleep(PROVIDER_SEARCH_DELAY).await;
                }
                search_count += 1;

                // --- Step 1: Primary search "{artist} {title}" ---
                if let Some(match_info) =
                    Self::try_search(provider.as_ref(), &query, &clean_title, &primary_artist).await
                {
                    track.matched_provider_id = Some(provider.id().to_string());
                    track.matched_external_id = Some(match_info.external_id);
                    track.matched_artist_id = match_info.artist_id;
                    track.matched_album_id = match_info.album_id;
                    break;
                }

                // --- Step 2: Romanization fallback for Japanese text ---
                let romanized_title = romanize_japanese(&clean_title);
                let romanized_artist = romanize_japanese(&primary_artist);

                if romanized_title.is_some() || romanized_artist.is_some() {
                    let r_title = romanized_title.as_deref().unwrap_or(&clean_title);
                    let r_artist = romanized_artist.as_deref().unwrap_or(&primary_artist);
                    let romanized_query = format!("{} {}", r_artist, r_title);

                    tokio::time::sleep(PROVIDER_SEARCH_DELAY).await;
                    search_count += 1;

                    log::debug!("Trying romanized search: {}", romanized_query);
                    if let Some(match_info) =
                        Self::try_search(provider.as_ref(), &romanized_query, r_title, r_artist).await
                    {
                        track.matched_provider_id = Some(provider.id().to_string());
                        track.matched_external_id = Some(match_info.external_id);
                        track.matched_artist_id = match_info.artist_id;
                        track.matched_album_id = match_info.album_id;
                        break;
                    }
                }

                // --- Step 3: Title-only fallback with artist fuzzy match ---
                tokio::time::sleep(PROVIDER_SEARCH_DELAY).await;
                search_count += 1;

                if let Some(match_info) =
                    Self::try_search(provider.as_ref(), &clean_title, &clean_title, &primary_artist).await
                {
                    track.matched_provider_id = Some(provider.id().to_string());
                    track.matched_external_id = Some(match_info.external_id);
                    track.matched_artist_id = match_info.artist_id;
                    track.matched_album_id = match_info.album_id;
                    break;
                }
            }
        }

        log::info!(
            "Provider matching complete: {} searches, {}/{} tracks matched",
            search_count,
            tracks.iter().filter(|t| t.is_playable()).count(),
            tracks.len()
        );
    }

    /// Execute a single search and check results for a match.
    ///
    /// Returns MatchedTrackInfo with complete track data if a good match is found.
    async fn try_search(
        provider: &dyn crate::providers::traits::MusicProvider,
        query: &str,
        expected_title: &str,
        expected_artist: &str,
    ) -> Option<MatchedTrackInfo> {
        match provider.search_tracks_only(query).await {
            Ok(results) => {
                // Check first few results for a good match (same logic as Spotify import)
                for result_track in results.iter().take(5) {
                    let result_artist = result_track.artist.to_lowercase();
                    let result_title = result_track.title.to_lowercase();
                    let target_artist = expected_artist.to_lowercase();
                    let target_title = expected_title.to_lowercase();

                    let artist_match = result_artist.contains(&target_artist)
                        || target_artist.contains(&result_artist);
                    let title_match = result_title.contains(&target_title)
                        || target_title.contains(&result_title);

                    if artist_match && title_match {
                        // Strip provider prefix from ID (e.g. "tidal:12345" -> "12345")
                        // Provider search returns IDs like "provider:id" but we store
                        // only the raw external ID; the provider_id is stored separately.
                        let raw_id = result_track
                            .id
                            .split_once(':')
                            .map(|(_, id)| id.to_string())
                            .unwrap_or_else(|| result_track.id.clone());
                        
                        log::debug!(
                            "Match found: original_id='{}', stripped_id='{}', provider='{}', artist_id={:?}, album_id={:?}",
                            result_track.id,
                            raw_id,
                            provider.id(),
                            result_track.artist_id,
                            result_track.album_id,
                        );
                        
                        return Some(MatchedTrackInfo {
                            external_id: raw_id,
                            artist_id: result_track.artist_id.clone(),
                            album_id: result_track.album_id.clone(),
                        });
                    }
                }
                None
            }
            Err(e) => {
                log::debug!("Search failed on provider {}: {}", provider.id(), e);
                None
            }
        }
    }

    /// Extract the primary (first) artist from a comma-separated artist string.
    ///
    /// "Reol, Kradness" → "Reol"
    /// "Airiel, Stella Tran" → "Airiel"
    fn primary_artist(artist: &str) -> String {
        artist
            .split(',')
            .next()
            .unwrap_or(artist)
            .trim()
            .to_string()
    }

    /// Clean a Spotify track title for searching.
    ///
    /// Strips parenthetical noise like "(Remastered)", "(feat. ...)",
    /// "(Deluxe Edition)", etc. that trip up provider search APIs.
    fn clean_title(title: &str) -> String {
        // Remove parenthetical and bracketed content
        let mut result = String::with_capacity(title.len());
        let mut depth = 0i32;
        for c in title.chars() {
            match c {
                '(' | '[' => depth += 1,
                ')' | ']' => {
                    depth -= 1;
                    continue;
                }
                _ if depth <= 0 => result.push(c),
                _ => {}
            }
        }

        // Also strip "feat." / "ft." suffixes that aren't in parens
        let result = result
            .split(" feat.")
            .next()
            .unwrap_or(&result)
            .to_string();
        let result = result.split(" ft.").next().unwrap_or(&result).to_string();

        result.trim().to_string()
    }

    /// Generate recommendations for multiple artists.
    ///
    /// Processes artists sequentially to be friendly to external APIs.
    /// Skips individual failures and continues with remaining artists.
    pub async fn generate_for_artists(
        &self,
        artists: &[String],
    ) -> Result<Vec<RecommendationSection>, RecommendationError> {
        let mut sections = Vec::new();

        for artist in artists {
            match self.generate_for_artist(artist).await {
                Ok(section) => sections.push(section),
                Err(e) => {
                    log::warn!("Failed to generate for '{}': {}", artist, e);
                    // Continue with other artists
                }
            }
        }

        Ok(sections)
    }
}
