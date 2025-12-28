use parking_lot::RwLock;
use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, PlatformConfig};

pub struct MediaControlsManager {
    controls: RwLock<Option<MediaControls>>,
}

unsafe impl Send for MediaControlsManager {}
unsafe impl Sync for MediaControlsManager {}

impl Default for MediaControlsManager {
    fn default() -> Self {
        Self::new()
    }
}

impl MediaControlsManager {
    #[cfg(not(target_os = "windows"))]
    pub fn new() -> Self {
        let config = PlatformConfig {
            dbus_name: "sonami",
            display_name: "Sonami",
            hwnd: None,
        };

        let controls = MediaControls::new(config).ok();
        Self {
            controls: RwLock::new(controls),
        }
    }

    #[cfg(target_os = "windows")]
    pub fn new() -> Self {
        Self {
            controls: RwLock::new(None),
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

    pub fn attach_handler<F>(&self, handler: F)
    where
        F: Fn(MediaControlEvent) + Send + 'static,
    {
        if let Some(ref mut controls) = *self.controls.write() {
            let _ = controls.attach(handler);
        }
    }

    pub fn set_metadata(&self, title: &str, artist: &str, album: &str) {
        if let Some(ref mut controls) = *self.controls.write() {
            let _ = controls.set_metadata(MediaMetadata {
                title: Some(title),
                artist: Some(artist),
                album: Some(album),
                ..Default::default()
            });
        }
    }

    pub fn set_playback(&self, playing: bool) {
        if let Some(ref mut controls) = *self.controls.write() {
            let playback = if playing {
                MediaPlayback::Playing { progress: None }
            } else {
                MediaPlayback::Paused { progress: None }
            };
            let _ = controls.set_playback(playback);
        }
    }

    pub fn set_stopped(&self) {
        if let Some(ref mut controls) = *self.controls.write() {
            let _ = controls.set_playback(MediaPlayback::Stopped);
        }
    }
}
