use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use parking_lot::RwLock;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

const DISCORD_APPLICATION_ID: &str = "1459143320604508251";

const PAUSE_CLEAR_DELAY: Duration = Duration::from_secs(30);

const UPDATE_INTERVAL: Duration = Duration::from_secs(1);

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
    },

    Paused {
        track: TrackInfo,
        paused_at: Instant,
        position_secs: u64,
    },
}

pub struct DiscordRpcManager {
    enabled: Arc<AtomicBool>,
    connected: Arc<AtomicBool>,
    state: Arc<RwLock<PresenceState>>,
    shutdown: Arc<AtomicBool>,
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

    pub fn connect(&self) {
        self.enabled.store(true, Ordering::SeqCst);
    }

    pub fn disconnect(&self) {
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

        log::info!(
            "Discord: Setting playing state for '{}' by '{}'",
            track.title,
            track.artist
        );

        *self.state.write() = PresenceState::Playing {
            track,
            started_at: Instant::now(),
            position_secs,
        };
    }

    pub fn set_paused(&self, track: TrackInfo, position_secs: u64) {
        if !self.enabled.load(Ordering::Relaxed) {
            log::debug!("Discord: set_paused called but RPC is disabled");
            return;
        }

        log::info!("Discord: Setting paused state for '{}'", track.title);

        *self.state.write() = PresenceState::Paused {
            track,
            paused_at: Instant::now(),
            position_secs,
        };
    }

    pub fn set_idle(&self) {
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
    let mut client: Option<DiscordIpcClient> = None;
    let mut last_state_hash: u64 = 0;
    let mut reconnect_delay = Duration::from_secs(1);
    let mut last_connect_attempt = Instant::now() - Duration::from_secs(10);

    loop {
        if shutdown.load(Ordering::Relaxed) {
            if let Some(ref mut c) = client {
                let _ = c.clear_activity();
                let _ = c.close();
            }
            break;
        }

        let is_enabled = enabled.load(Ordering::Relaxed);

        if is_enabled && client.is_none() && last_connect_attempt.elapsed() >= reconnect_delay {
            last_connect_attempt = Instant::now();

            let mut c = DiscordIpcClient::new(DISCORD_APPLICATION_ID);
            match c.connect() {
                Ok(_) => {
                    log::info!("Discord: Connected to Discord RPC");
                    client = Some(c);
                    connected.store(true, Ordering::Relaxed);
                    reconnect_delay = Duration::from_secs(1);
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

        let mut should_reconnect = false;
        if let Some(ref mut c) = client {
            let current_state = state.read().clone();

            let should_clear = matches!(&current_state, PresenceState::Paused { paused_at, .. }
                if paused_at.elapsed() >= PAUSE_CLEAR_DELAY);

            if should_clear {
                drop(state.read());
                *state.write() = PresenceState::Idle;
            }

            let current_hash = calculate_state_hash(&current_state);

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
                    } => {
                        log::debug!(
                            "Discord: Setting playing activity for '{}' by '{}'",
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
                        log::debug!("Discord: Setting paused activity for '{}'", track.title);
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
}

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
            ..
        } => {
            1u8.hash(&mut hasher);
            track.title.hash(&mut hasher);
            track.artist.hash(&mut hasher);

            (position_secs / 5).hash(&mut hasher);
        }
        PresenceState::Paused {
            track,
            position_secs,
            paused_at,
        } => {
            2u8.hash(&mut hasher);
            track.title.hash(&mut hasher);
            track.artist.hash(&mut hasher);
            position_secs.hash(&mut hasher);

            (paused_at.elapsed().as_secs() / 10).hash(&mut hasher);
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
    let start_timestamp = now - (position_secs + elapsed_since_start) as i64;

    let details = &track.title;
    let state_text = format!("by {}", track.artist);

    let activity_builder = activity::Activity::new()
        .details(details)
        .state(&state_text)
        .timestamps(activity::Timestamps::new().start(start_timestamp));

    log::debug!(
        "Discord: Sending activity - details: '{}', state: '{}'",
        details,
        state_text
    );

    client.set_activity(activity_builder)?;
    Ok(())
}

fn update_paused_activity(
    client: &mut DiscordIpcClient,
    track: &TrackInfo,
    position_secs: u64,
) -> Result<(), discord_rich_presence::error::Error> {
    let details = &track.title;
    let state_text = format!("by {} • Paused", track.artist);

    let mins = position_secs / 60;
    let secs = position_secs % 60;

    log::debug!(
        "Discord: Sending paused activity - '{}' at {:02}:{:02}",
        details,
        mins,
        secs
    );

    let activity_builder = activity::Activity::new()
        .details(details)
        .state(&state_text);

    client.set_activity(activity_builder)?;
    Ok(())
}
