use base64::{engine::general_purpose, Engine as _};
use parking_lot::RwLock;
#[cfg(not(target_os = "android"))]
use souvlaki::{MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig};
#[cfg(not(target_os = "android"))]
use std::io::Write;
use std::time::Duration;

// Re-export MediaControlEvent and SeekDirection for use in other modules (or provide stub for Android)
#[cfg(not(target_os = "android"))]
pub use souvlaki::MediaControlEvent;
#[cfg(not(target_os = "android"))]
pub use souvlaki::SeekDirection;

#[cfg(target_os = "android")]
#[derive(Debug, Clone)]
pub enum MediaControlEvent {
    Play,
    Pause,
    Toggle,
    Next,
    Previous,
    Stop,
    Seek(SeekDirection),
    SetPosition(std::time::Duration),
    SetVolume(f64),
    OpenUri(String),
    Raise,
    Quit,
}

#[cfg(target_os = "android")]
#[derive(Debug, Clone, Copy)]
pub enum SeekDirection {
    Forward,
    Backward,
}

struct CachedMetadata {
    title: String,
    artist: String,
    album: String,
    cover_url: Option<String>,
    duration_secs: f64,
}

impl Default for CachedMetadata {
    fn default() -> Self {
        Self {
            title: String::new(),
            artist: String::new(),
            album: String::new(),
            cover_url: None,
            duration_secs: 0.0,
        }
    }
}

pub struct MediaControlsManager {
    #[cfg(not(target_os = "android"))]
    controls: RwLock<Option<MediaControls>>,
    metadata: RwLock<CachedMetadata>,
}

unsafe impl Send for MediaControlsManager {}
unsafe impl Sync for MediaControlsManager {}

impl Default for MediaControlsManager {
    fn default() -> Self {
        Self::new()
    }
}

impl MediaControlsManager {
    // Linux/macOS implementation
    #[cfg(all(not(target_os = "windows"), not(target_os = "android")))]
    pub fn new() -> Self {
        let config = PlatformConfig {
            dbus_name: "sonami",
            display_name: "Sonami",
            hwnd: None,
        };

        let controls = MediaControls::new(config).ok();
        Self {
            controls: RwLock::new(controls),
            metadata: RwLock::new(CachedMetadata::default()),
        }
    }

    // Windows implementation
    #[cfg(target_os = "windows")]
    pub fn new() -> Self {
        Self {
            controls: RwLock::new(None),
            metadata: RwLock::new(CachedMetadata::default()),
        }
    }

    // Android stub implementation
    #[cfg(target_os = "android")]
    pub fn new() -> Self {
        log::info!("MediaControlsManager: Android stub initialized (no-op)");
        Self {
            metadata: RwLock::new(CachedMetadata::default()),
        }
    }

    #[cfg(target_os = "windows")]
    pub fn init_with_hwnd(&self, hwnd: *mut std::ffi::c_void) {
        let config = PlatformConfig {
            dbus_name: "sonami",
            display_name: "Sonami",
            hwnd: Some(hwnd),
        };

        if let Ok(controls) = MediaControls::new(config) {
            *self.controls.write() = Some(controls);
        }
    }

    #[cfg(not(target_os = "android"))]
    pub fn attach_handler<F>(&self, handler: F)
    where
        F: Fn(MediaControlEvent) + Send + 'static,
    {
        if let Some(ref mut controls) = *self.controls.write() {
            let _ = controls.attach(handler);
        }
    }

    #[cfg(target_os = "android")]
    pub fn attach_handler<F>(&self, _handler: F)
    where
        F: Fn(MediaControlEvent) + Send + 'static,
    {
        // No-op on Android - media controls handled by system
    }

    pub fn set_metadata(
        &self,
        title: &str,
        artist: &str,
        album: &str,
        cover_url: Option<&str>,
        duration_secs: f64,
    ) {
        #[cfg(not(target_os = "android"))]
        let processed_cover_url = cover_url.and_then(|url| {
            if url.starts_with("data:") {
                let cache_id = format!("{}_{}", title, artist);
                data_url_to_file_url(url, &cache_id)
            } else if url.starts_with("file://")
                || url.starts_with("http://")
                || url.starts_with("https://")
            {
                Some(url.to_string())
            } else if !url.is_empty() {
                Some(format!("file://{}", url))
            } else {
                None
            }
        });

        #[cfg(target_os = "android")]
        let processed_cover_url: Option<String> = cover_url.map(|s| s.to_string());

        {
            let mut cached = self.metadata.write();
            cached.title = title.to_string();
            cached.artist = artist.to_string();
            cached.album = album.to_string();
            cached.cover_url = processed_cover_url;
            cached.duration_secs = duration_secs;
        }

        self.apply_metadata();
    }

    #[cfg(not(target_os = "android"))]
    fn apply_metadata(&self) {
        if let Some(ref mut controls) = *self.controls.write() {
            let cached = self.metadata.read();

            let duration = if cached.duration_secs > 0.0 {
                Some(Duration::from_secs_f64(cached.duration_secs))
            } else {
                None
            };

            let _ = controls.set_metadata(MediaMetadata {
                title: Some(&cached.title),
                artist: Some(&cached.artist),
                album: Some(&cached.album),
                cover_url: cached.cover_url.as_deref(),
                duration,
            });
        }
    }

    #[cfg(target_os = "android")]
    fn apply_metadata(&self) {
        // No-op on Android
    }

    #[cfg(not(target_os = "android"))]
    pub fn set_playback(&self, playing: bool, position_secs: Option<f64>) {
        if let Some(ref mut controls) = *self.controls.write() {
            let progress = position_secs.map(|secs| MediaPosition(Duration::from_secs_f64(secs)));

            let playback = if playing {
                MediaPlayback::Playing { progress }
            } else {
                MediaPlayback::Paused { progress }
            };
            let _ = controls.set_playback(playback);
        }
    }

    #[cfg(target_os = "android")]
    pub fn set_playback(&self, _playing: bool, _position_secs: Option<f64>) {
        // No-op on Android
    }

    pub fn set_playback_simple(&self, playing: bool) {
        self.set_playback(playing, None);
    }

    #[cfg(not(target_os = "android"))]
    pub fn set_stopped(&self) {
        if let Some(ref mut controls) = *self.controls.write() {
            let _ = controls.set_playback(MediaPlayback::Stopped);
        }
    }

    #[cfg(target_os = "android")]
    pub fn set_stopped(&self) {
        // No-op on Android
    }

    pub fn get_duration(&self) -> f64 {
        self.metadata.read().duration_secs
    }
}

#[cfg(not(target_os = "android"))]
fn save_cover_art_to_temp(cover_data: &[u8], track_id: &str) -> Option<String> {
    use std::fs;

    let cache_dir = dirs::cache_dir()?.join("sonami").join("covers");
    fs::create_dir_all(&cache_dir).ok()?;

    let safe_id: String = track_id
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .take(64)
        .collect();

    let filename = format!("{}.jpg", safe_id);
    let cover_path = cache_dir.join(&filename);

    if !cover_path.exists() {
        let mut file = fs::File::create(&cover_path).ok()?;
        file.write_all(cover_data).ok()?;
    }

    Some(format!("file://{}", cover_path.to_string_lossy()))
}

#[cfg(not(target_os = "android"))]
fn data_url_to_file_url(data_url: &str, track_id: &str) -> Option<String> {
    if !data_url.starts_with("data:") {
        return Some(data_url.to_string());
    }

    let parts: Vec<&str> = data_url.splitn(2, ',').collect();
    if parts.len() != 2 {
        return None;
    }

    let data_part = parts[1];
    let is_base64 = parts[0].contains(";base64");

    let bytes = if is_base64 {
        general_purpose::STANDARD.decode(data_part).ok()?
    } else {
        data_part.as_bytes().to_vec()
    };

    save_cover_art_to_temp(&bytes, track_id)
}
