//! Centralized Playback Notification Service
//!
//! This module provides a single source of truth for notifying external services
//! (Discord RPC, MPRIS/Media Controls) about playback state changes.
//!
//! Architecture:
//! - All playback state changes flow through PlaybackNotifier
//! - Debounces rapid state changes to prevent flickering
//! - Ensures consistent state across Discord and MPRIS
//! - Thread-safe with interior mutability

use parking_lot::{Mutex, RwLock};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use crate::discord::{DiscordRpcManager, TrackInfo};
use crate::media_controls::MediaControlsManager;

/// Minimum interval between state updates to prevent flickering
const DEBOUNCE_INTERVAL: Duration = Duration::from_millis(100);

/// Interval for position sync updates
const POSITION_SYNC_INTERVAL: Duration = Duration::from_millis(1000);

/// Represents the current playback state
#[derive(Clone, Debug, PartialEq, Default)]
pub enum NotifierPlaybackState {
    #[default]
    Stopped,
    Playing {
        track: TrackMetadata,
        position_secs: f64,
        started_at: Instant,
    },
    Paused {
        track: TrackMetadata,
        position_secs: f64,
    },
}

/// Track metadata for notifications
#[derive(Clone, Debug, PartialEq)]
pub struct TrackMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: f64,
    pub cover_url: Option<String>,
}

impl TrackMetadata {
    pub fn new(
        title: impl Into<String>,
        artist: impl Into<String>,
        album: impl Into<String>,
        duration_secs: f64,
        cover_url: Option<String>,
    ) -> Self {
        Self {
            title: title.into(),
            artist: artist.into(),
            album: album.into(),
            duration_secs,
            cover_url,
        }
    }
}

impl From<&TrackMetadata> for TrackInfo {
    fn from(meta: &TrackMetadata) -> Self {
        TrackInfo {
            title: meta.title.clone(),
            artist: meta.artist.clone(),
            album: meta.album.clone(),
            duration_secs: meta.duration_secs as u64,
            cover_url: meta.cover_url.clone(),
        }
    }
}

/// Centralized service for managing playback notifications
pub struct PlaybackNotifier {
    /// Current playback state
    state: RwLock<NotifierPlaybackState>,

    /// Last time state was updated (for debouncing)
    last_update: Mutex<Instant>,

    /// Discord RPC manager reference
    discord_rpc: Option<Arc<DiscordRpcManager>>,

    /// Media controls (MPRIS) manager reference
    media_controls: Arc<MediaControlsManager>,

    /// Flag to track if notifier is enabled
    enabled: AtomicBool,

    /// Shutdown flag for background thread
    shutdown: AtomicBool,

    /// Current position in seconds (atomic for lock-free reads)
    current_position: AtomicU64,

    /// Flag indicating if we're currently playing
    is_playing: AtomicBool,
}

impl PlaybackNotifier {
    /// Create a new PlaybackNotifier
    pub fn new(
        discord_rpc: Option<Arc<DiscordRpcManager>>,
        media_controls: Arc<MediaControlsManager>,
    ) -> Arc<Self> {
        let notifier = Arc::new(Self {
            state: RwLock::new(NotifierPlaybackState::Stopped),
            last_update: Mutex::new(Instant::now() - DEBOUNCE_INTERVAL),
            discord_rpc,
            media_controls,
            enabled: AtomicBool::new(true),
            shutdown: AtomicBool::new(false),
            current_position: AtomicU64::new(0),
            is_playing: AtomicBool::new(false),
        });

        // Start background position sync thread
        let notifier_clone = notifier.clone();
        thread::spawn(move || {
            notifier_clone.position_sync_loop();
        });

        notifier
    }

    /// Background loop that syncs position to MPRIS periodically
    fn position_sync_loop(&self) {
        log::info!("[PlaybackNotifier] Position sync loop started");

        loop {
            if self.shutdown.load(Ordering::Relaxed) {
                break;
            }

            thread::sleep(POSITION_SYNC_INTERVAL);

            if !self.enabled.load(Ordering::Relaxed) {
                continue;
            }

            let is_playing = self.is_playing.load(Ordering::Relaxed);
            let position = f64::from_bits(self.current_position.load(Ordering::Relaxed));

            // Only sync if we have a valid position
            if position >= 0.0 {
                self.media_controls.set_playback(is_playing, Some(position));
            }
        }

        log::info!("[PlaybackNotifier] Position sync loop stopped");
    }

    /// Update the current position (called frequently from audio output)
    pub fn update_position(&self, position_secs: f64) {
        self.current_position
            .store(position_secs.to_bits(), Ordering::Relaxed);
    }

    /// Notify that playback has started for a track
    pub fn notify_playing(&self, track: TrackMetadata, position_secs: f64) {
        if !self.should_update() {
            // Queue for later or just update state without external notification
            log::debug!(
                "[PlaybackNotifier] Debounced playing notification for '{}'",
                track.title
            );
        }

        log::info!(
            "[PlaybackNotifier] Playing: '{}' by '{}' at {:.1}s",
            track.title,
            track.artist,
            position_secs
        );

        let now = Instant::now();

        // Update internal state
        {
            let mut state = self.state.write();
            *state = NotifierPlaybackState::Playing {
                track: track.clone(),
                position_secs,
                started_at: now,
            };
        }

        self.is_playing.store(true, Ordering::Relaxed);
        self.current_position
            .store(position_secs.to_bits(), Ordering::Relaxed);

        // Update Discord
        if let Some(ref discord) = self.discord_rpc {
            discord.set_playing(TrackInfo::from(&track), position_secs as u64);
        }

        // Update Media Controls (MPRIS)
        self.media_controls.set_metadata(
            &track.title,
            &track.artist,
            &track.album,
            track.cover_url.as_deref(),
            track.duration_secs,
        );
        self.media_controls.set_playback(true, Some(position_secs));

        *self.last_update.lock() = now;
    }

    /// Notify that playback has been paused
    pub fn notify_paused(&self, position_secs: f64) {
        log::info!("[PlaybackNotifier] Paused at {:.1}s", position_secs);

        let track = {
            let state = self.state.read();
            match &*state {
                NotifierPlaybackState::Playing { track, .. } => Some(track.clone()),
                NotifierPlaybackState::Paused { track, .. } => Some(track.clone()),
                NotifierPlaybackState::Stopped => None,
            }
        };

        let Some(track) = track else {
            log::warn!("[PlaybackNotifier] Paused but no track info available");
            return;
        };

        // Update internal state
        {
            let mut state = self.state.write();
            *state = NotifierPlaybackState::Paused {
                track: track.clone(),
                position_secs,
            };
        }

        self.is_playing.store(false, Ordering::Relaxed);
        self.current_position
            .store(position_secs.to_bits(), Ordering::Relaxed);

        // Update Discord
        if let Some(ref discord) = self.discord_rpc {
            discord.set_paused(TrackInfo::from(&track), position_secs as u64);
        }

        // Update Media Controls (MPRIS)
        self.media_controls.set_playback(false, Some(position_secs));

        *self.last_update.lock() = Instant::now();
    }

    /// Notify that playback has resumed
    pub fn notify_resumed(&self, position_secs: f64) {
        log::info!("[PlaybackNotifier] Resumed at {:.1}s", position_secs);

        let track = {
            let state = self.state.read();
            match &*state {
                NotifierPlaybackState::Playing { track, .. } => Some(track.clone()),
                NotifierPlaybackState::Paused { track, .. } => Some(track.clone()),
                NotifierPlaybackState::Stopped => None,
            }
        };

        let Some(track) = track else {
            log::warn!("[PlaybackNotifier] Resumed but no track info available");
            return;
        };

        let now = Instant::now();

        // Update internal state
        {
            let mut state = self.state.write();
            *state = NotifierPlaybackState::Playing {
                track: track.clone(),
                position_secs,
                started_at: now,
            };
        }

        self.is_playing.store(true, Ordering::Relaxed);
        self.current_position
            .store(position_secs.to_bits(), Ordering::Relaxed);

        // Update Discord
        if let Some(ref discord) = self.discord_rpc {
            discord.set_playing(TrackInfo::from(&track), position_secs as u64);
        }

        // Update Media Controls (MPRIS)
        self.media_controls.set_playback(true, Some(position_secs));

        *self.last_update.lock() = now;
    }

    /// Notify that a seek occurred
    pub fn notify_seek(&self, position_secs: f64) {
        log::info!("[PlaybackNotifier] Seek to {:.1}s", position_secs);

        self.current_position
            .store(position_secs.to_bits(), Ordering::Relaxed);

        let is_playing = self.is_playing.load(Ordering::Relaxed);

        // Update internal state position
        {
            let mut state = self.state.write();
            match &mut *state {
                NotifierPlaybackState::Playing {
                    position_secs: pos,
                    started_at,
                    ..
                } => {
                    *pos = position_secs;
                    *started_at = Instant::now();
                }
                NotifierPlaybackState::Paused {
                    position_secs: pos, ..
                } => {
                    *pos = position_secs;
                }
                NotifierPlaybackState::Stopped => {}
            }
        }

        // Get track info for Discord update
        let track = {
            let state = self.state.read();
            match &*state {
                NotifierPlaybackState::Playing { track, .. } => Some(track.clone()),
                NotifierPlaybackState::Paused { track, .. } => Some(track.clone()),
                NotifierPlaybackState::Stopped => None,
            }
        };

        // Update Discord with new position
        if let Some(ref discord) = self.discord_rpc {
            if let Some(ref track) = track {
                if is_playing {
                    discord.set_playing(TrackInfo::from(track), position_secs as u64);
                } else {
                    discord.set_paused(TrackInfo::from(track), position_secs as u64);
                }
            }
        }

        // Update Media Controls (MPRIS) with new position
        self.media_controls.set_playback(is_playing, Some(position_secs));

        *self.last_update.lock() = Instant::now();
    }

    /// Notify that playback has stopped
    pub fn notify_stopped(&self) {
        log::info!("[PlaybackNotifier] Stopped");

        // Update internal state
        {
            let mut state = self.state.write();
            *state = NotifierPlaybackState::Stopped;
        }

        self.is_playing.store(false, Ordering::Relaxed);
        self.current_position.store(0f64.to_bits(), Ordering::Relaxed);

        // Update Discord
        if let Some(ref discord) = self.discord_rpc {
            discord.set_idle();
        }

        // Update Media Controls (MPRIS)
        self.media_controls.set_stopped();

        *self.last_update.lock() = Instant::now();
    }

    /// Notify that track metadata has changed (without changing playback state)
    pub fn notify_track_changed(&self, track: TrackMetadata, position_secs: f64) {
        log::info!(
            "[PlaybackNotifier] Track changed: '{}' by '{}'",
            track.title,
            track.artist
        );

        let is_playing = self.is_playing.load(Ordering::Relaxed);

        // Update internal state
        {
            let mut state = self.state.write();
            if is_playing {
                *state = NotifierPlaybackState::Playing {
                    track: track.clone(),
                    position_secs,
                    started_at: Instant::now(),
                };
            } else {
                *state = NotifierPlaybackState::Paused {
                    track: track.clone(),
                    position_secs,
                };
            }
        }

        self.current_position
            .store(position_secs.to_bits(), Ordering::Relaxed);

        // Update Discord
        if let Some(ref discord) = self.discord_rpc {
            if is_playing {
                discord.set_playing(TrackInfo::from(&track), position_secs as u64);
            } else {
                discord.set_paused(TrackInfo::from(&track), position_secs as u64);
            }
        }

        // Update Media Controls (MPRIS)
        self.media_controls.set_metadata(
            &track.title,
            &track.artist,
            &track.album,
            track.cover_url.as_deref(),
            track.duration_secs,
        );
        self.media_controls.set_playback(is_playing, Some(position_secs));

        *self.last_update.lock() = Instant::now();
    }

    /// Check if we should update (debouncing)
    fn should_update(&self) -> bool {
        let last = self.last_update.lock();
        last.elapsed() >= DEBOUNCE_INTERVAL
    }

    /// Get current playback state
    pub fn get_state(&self) -> NotifierPlaybackState {
        self.state.read().clone()
    }

    /// Check if currently playing
    pub fn is_playing(&self) -> bool {
        self.is_playing.load(Ordering::Relaxed)
    }

    /// Get current position
    pub fn get_position(&self) -> f64 {
        f64::from_bits(self.current_position.load(Ordering::Relaxed))
    }

    /// Shutdown the notifier
    pub fn shutdown(&self) {
        self.shutdown.store(true, Ordering::SeqCst);
        self.notify_stopped();
    }
}

impl Drop for PlaybackNotifier {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_track_metadata_conversion() {
        let meta = TrackMetadata::new("Test Song", "Test Artist", "Test Album", 180.0, None);

        let track_info: TrackInfo = (&meta).into();

        assert_eq!(track_info.title, "Test Song");
        assert_eq!(track_info.artist, "Test Artist");
        assert_eq!(track_info.album, "Test Album");
        assert_eq!(track_info.duration_secs, 180);
    }
}
