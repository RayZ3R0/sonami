use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, PlatformConfig};

pub struct MediaControlsManager {
    controls: Option<MediaControls>,
}

impl MediaControlsManager {
    pub fn new() -> Self {
        #[cfg(not(target_os = "windows"))]
        let hwnd = None;

        #[cfg(target_os = "windows")]
        let hwnd = None; // Will be set later with window handle

        let config = PlatformConfig {
            dbus_name: "sonami",
            display_name: "Sonami",
            hwnd,
        };

        let controls = MediaControls::new(config).ok();

        Self { controls }
    }

    pub fn attach_handler<F>(&mut self, handler: F)
    where
        F: Fn(MediaControlEvent) + Send + 'static,
    {
        if let Some(ref mut controls) = self.controls {
            let _ = controls.attach(handler);
        }
    }

    pub fn set_metadata(&mut self, title: &str, artist: &str, album: &str) {
        if let Some(ref mut controls) = self.controls {
            let _ = controls.set_metadata(MediaMetadata {
                title: Some(title),
                artist: Some(artist),
                album: Some(album),
                ..Default::default()
            });
        }
    }

    pub fn set_playback(&mut self, playing: bool) {
        if let Some(ref mut controls) = self.controls {
            let playback = if playing {
                MediaPlayback::Playing { progress: None }
            } else {
                MediaPlayback::Paused { progress: None }
            };
            let _ = controls.set_playback(playback);
        }
    }
}
