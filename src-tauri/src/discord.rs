//! Discord Rich Presence Integration
//!
//! This module handles Discord Rich Presence updates for Sonami.
//! It runs a background worker thread that maintains the connection
//! to Discord and updates the presence based on playback state.
//!
//! Key features:
//! - Automatic reconnection with exponential backoff
//! - State-based updates with sequence numbers to force immediate updates
//! - Paused state auto-clear after 30 seconds
//! - Thread-safe state management

use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use parking_lot::RwLock;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

const DISCORD_APPLICATION_ID: &str = "1459143320604508251";

/// How long to wait before clearing paused activity
const PAUSE_CLEAR_DELAY: Duration = Duration::from_secs(30);

/// How often to check for state updates (faster for better responsiveness)
const UPDATE_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Clone, Debug)]
pub struct TrackInfo {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: u64,
    pub cover_url: Option<String>,
}

#[derive(Clone, Debug)]
enum PresenceState {
    Idle,

    Playing {
        track: TrackInfo,
        started_at: Instant,
        position_secs: u64,
        /// Sequence number to force updates even if track is same
        seq: u64,
    },

    Paused {
        track: TrackInfo,
        paused_at: Instant,
        position_secs: u64,
        /// Sequence number to force updates
        seq: u64,
    },
}

#[derive(Clone)]
pub struct DiscordRpcManager {
    enabled: Arc<AtomicBool>,
    connected: Arc<AtomicBool>,
    state: Arc<RwLock<PresenceState>>,
    shutdown: Arc<AtomicBool>,
    /// Sequence counter for forcing updates
    sequence: Arc<AtomicU64>,
}

impl Default for DiscordRpcManager {
    fn default() -> Self {
        Self::new()
    }
}

impl DiscordRpcManager {
    pub fn new() -> Self {
        let manager = Self {
            enabled: Arc::new(AtomicBool::new(false)),
            connected: Arc::new(AtomicBool::new(false)),
            state: Arc::new(RwLock::new(PresenceState::Idle)),
            shutdown: Arc::new(AtomicBool::new(false)),
            sequence: Arc::new(AtomicU64::new(0)),
        };

        let enabled = manager.enabled.clone();
        let connected = manager.connected.clone();
        let state = manager.state.clone();
        let shutdown = manager.shutdown.clone();

        thread::spawn(move || {
            discord_worker_thread(enabled, connected, state, shutdown);
        });

        manager
    }

    /// Get next sequence number (always increments)
    fn next_seq(&self) -> u64 {
        self.sequence.fetch_add(1, Ordering::SeqCst)
    }

    pub fn connect(&self) {
        log::info!("Discord: Enabling Rich Presence");
        self.enabled.store(true, Ordering::SeqCst);
    }

    pub fn disconnect(&self) {
        log::info!("Discord: Disabling Rich Presence");
        self.enabled.store(false, Ordering::SeqCst);
        *self.state.write() = PresenceState::Idle;
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::Relaxed)
    }

    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::Relaxed)
    }

    pub fn set_playing(&self, track: TrackInfo, position_secs: u64) {
        if !self.enabled.load(Ordering::Relaxed) {
            log::debug!(
                "Discord: set_playing called but RPC is disabled (track: '{}')",
                track.title
            );
            return;
        }

        let seq = self.next_seq();
        log::info!(
            "Discord: Setting playing state for '{}' by '{}' at {}s (seq={})",
            track.title,
            track.artist,
            position_secs,
            seq
        );

        *self.state.write() = PresenceState::Playing {
            track,
            started_at: Instant::now(),
            position_secs,
            seq,
        };
    }

    pub fn set_paused(&self, track: TrackInfo, position_secs: u64) {
        if !self.enabled.load(Ordering::Relaxed) {
            log::debug!("Discord: set_paused called but RPC is disabled");
            return;
        }

        let seq = self.next_seq();
        log::info!(
            "Discord: Setting paused state for '{}' at {}s (seq={})",
            track.title,
            position_secs,
            seq
        );

        *self.state.write() = PresenceState::Paused {
            track,
            paused_at: Instant::now(),
            position_secs,
            seq,
        };
    }

    pub fn set_idle(&self) {
        log::info!("Discord: Setting idle state");
        *self.state.write() = PresenceState::Idle;
    }

    pub fn shutdown(&self) {
        self.shutdown.store(true, Ordering::SeqCst);
    }
}

impl Drop for DiscordRpcManager {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn discord_worker_thread(
    enabled: Arc<AtomicBool>,
    connected: Arc<AtomicBool>,
    state: Arc<RwLock<PresenceState>>,
    shutdown: Arc<AtomicBool>,
) {
    log::info!("Discord: Worker thread started");

    let mut client: Option<DiscordIpcClient> = None;
    let mut last_state_hash: u64 = 0;
    let mut reconnect_delay = Duration::from_secs(1);
    let mut last_connect_attempt = Instant::now() - Duration::from_secs(10);

    loop {
        if shutdown.load(Ordering::Relaxed) {
            log::info!("Discord: Worker thread shutting down");
            if let Some(ref mut c) = client {
                let _ = c.clear_activity();
                let _ = c.close();
            }
            break;
        }

        let is_enabled = enabled.load(Ordering::Relaxed);

        // Handle connection logic
        if is_enabled && client.is_none() && last_connect_attempt.elapsed() >= reconnect_delay {
            last_connect_attempt = Instant::now();

            let mut c = DiscordIpcClient::new(DISCORD_APPLICATION_ID);
            match c.connect() {
                Ok(_) => {
                    log::info!("Discord: Connected to Discord RPC");
                    client = Some(c);
                    connected.store(true, Ordering::Relaxed);
                    reconnect_delay = Duration::from_secs(1);
                    // Force update on reconnect
                    last_state_hash = 0;
                }
                Err(e) => {
                    log::debug!(
                        "Discord: Failed to connect - {} (retry in {:?})",
                        e,
                        reconnect_delay
                    );
                    reconnect_delay = (reconnect_delay * 2).min(Duration::from_secs(30));
                }
            }
        } else if !is_enabled && client.is_some() {
            if let Some(ref mut c) = client {
                let _ = c.clear_activity();
                let _ = c.close();
            }
            client = None;
            connected.store(false, Ordering::Relaxed);
            log::info!("Discord: Disconnected from Discord RPC");
        }

        // Handle state updates
        let mut should_reconnect = false;
        if let Some(ref mut c) = client {
            let current_state = state.read().clone();

            // Auto-clear paused state after delay
            let should_clear = matches!(&current_state, PresenceState::Paused { paused_at, .. }
                if paused_at.elapsed() >= PAUSE_CLEAR_DELAY);

            if should_clear {
                log::debug!("Discord: Auto-clearing paused state after timeout");
                drop(state.read());
                *state.write() = PresenceState::Idle;
                continue; // Re-loop to pick up new Idle state
            }

            let current_hash = calculate_state_hash(&current_state);

            // Update if state changed
            if current_hash != last_state_hash {
                last_state_hash = current_hash;

                let result = match &current_state {
                    PresenceState::Idle => {
                        log::debug!("Discord: Clearing activity (idle)");
                        c.clear_activity()
                    }
                    PresenceState::Playing {
                        track,
                        started_at,
                        position_secs,
                        ..
                    } => {
                        log::debug!(
                            "Discord: Updating playing activity for '{}' by '{}'",
                            track.title,
                            track.artist
                        );
                        update_playing_activity(c, track, *started_at, *position_secs)
                    }
                    PresenceState::Paused {
                        track,
                        position_secs,
                        ..
                    } => {
                        log::debug!(
                            "Discord: Updating paused activity for '{}' at {}s",
                            track.title,
                            position_secs
                        );
                        update_paused_activity(c, track, *position_secs)
                    }
                };

                if let Err(e) = result {
                    log::warn!("Discord: Activity update failed: {} - will reconnect", e);
                    let _ = c.close();
                    should_reconnect = true;
                    last_state_hash = 0;
                }
            }
        }

        if should_reconnect {
            client = None;
            connected.store(false, Ordering::Relaxed);
        }

        thread::sleep(UPDATE_INTERVAL);
    }

    log::info!("Discord: Worker thread exited");
}

/// Calculate a hash of the current state for change detection
/// Uses sequence number to force updates when state content is similar
fn calculate_state_hash(state: &PresenceState) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();

    match state {
        PresenceState::Idle => {
            0u8.hash(&mut hasher);
        }
        PresenceState::Playing {
            track,
            position_secs,
            seq,
            ..
        } => {
            1u8.hash(&mut hasher);
            track.title.hash(&mut hasher);
            track.artist.hash(&mut hasher);
            track.album.hash(&mut hasher);
            // Include sequence number to force updates on state transitions
            seq.hash(&mut hasher);
            // Coarse position for periodic updates (every 15 seconds)
            (position_secs / 15).hash(&mut hasher);
        }
        PresenceState::Paused {
            track,
            position_secs,
            seq,
            ..
        } => {
            2u8.hash(&mut hasher);
            track.title.hash(&mut hasher);
            track.artist.hash(&mut hasher);
            track.album.hash(&mut hasher);
            // Include sequence number to force updates on state transitions
            seq.hash(&mut hasher);
            // Exact position for paused state (doesn't change)
            position_secs.hash(&mut hasher);
        }
    }

    hasher.finish()
}

fn update_playing_activity(
    client: &mut DiscordIpcClient,
    track: &TrackInfo,
    started_at: Instant,
    position_secs: u64,
) -> Result<(), discord_rich_presence::error::Error> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let elapsed_since_start = started_at.elapsed().as_secs();
    let current_position = position_secs.saturating_add(elapsed_since_start);
    let start_timestamp = now - current_position as i64;
    let end_timestamp = start_timestamp + track.duration_secs as i64;

    let details = &track.title;
    let state_text = &track.artist;

    let mut activity_builder = activity::Activity::new()
        .activity_type(activity::ActivityType::Listening)
        .details(details)
        .state(state_text)
        .timestamps(
            activity::Timestamps::new()
                .start(start_timestamp)
                .end(end_timestamp),
        )
        .assets(
            activity::Assets::new()
                .large_image("sonami_logo")
                .large_text(&track.album),
        );

    if let Some(ref cover_url) = track.cover_url {
        // Only use cover URL if it's not a data URL (Discord doesn't support those)
        if !cover_url.starts_with("data:") {
            activity_builder = activity_builder.assets(
                activity::Assets::new()
                    .large_image(cover_url)
                    .large_text(&track.album)
                    .small_image("sonami_logo")
                    .small_text("Sonami"),
            );
        }
    }

    log::debug!(
        "Discord: Activity update - '{}' by '{}' ({} secs, pos {})",
        details,
        state_text,
        track.duration_secs,
        current_position
    );

    client.set_activity(activity_builder)?;
    Ok(())
}

/// Update Discord activity for paused state
fn update_paused_activity(
    client: &mut DiscordIpcClient,
    track: &TrackInfo,
    position_secs: u64,
) -> Result<(), discord_rich_presence::error::Error> {
    let details = &track.title;
    let state_text = format!("{} • Paused", track.artist);

    let mins = position_secs / 60;
    let secs = position_secs % 60;
    let total_mins = track.duration_secs / 60;
    let total_secs = track.duration_secs % 60;
    let position_text = format!(
        "{} • {:02}:{:02} / {:02}:{:02}",
        track.album, mins, secs, total_mins, total_secs
    );

    log::debug!(
        "Discord: Paused activity update - '{}' at {:02}:{:02}",
        details,
        mins,
        secs
    );

    let mut activity_builder = activity::Activity::new()
        .activity_type(activity::ActivityType::Listening)
        .details(details)
        .state(&state_text)
        .assets(
            activity::Assets::new()
                .large_image("sonami_logo")
                .large_text(&position_text),
        );

    if let Some(ref cover_url) = track.cover_url {
        if !cover_url.starts_with("data:") {
            activity_builder = activity_builder.assets(
                activity::Assets::new()
                    .large_image(cover_url)
                    .large_text(&position_text)
                    .small_image("sonami_logo")
                    .small_text("Sonami"),
            );
        }
    }

    client.set_activity(activity_builder)?;
    Ok(())
}
