use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;

use parking_lot::RwLock;
use tauri::AppHandle;

use super::buffer::AudioBuffer;
use crate::dsp::DspChain;
use crate::media_controls::MediaControlsManager;
use crate::queue::PlayQueue;

#[derive(Clone)]
pub struct AudioContext {
    pub buffer_a: Arc<AudioBuffer>,
    pub buffer_b: Arc<AudioBuffer>,
    pub state: PlaybackState,
    pub queue: Arc<RwLock<PlayQueue>>,
    pub dsp: Arc<RwLock<DspChain>>,
    pub media_controls: Arc<MediaControlsManager>,
    pub crossfade_duration_ms: Arc<AtomicU32>,
    pub crossfade_active: Arc<AtomicBool>,
    pub app_handle: AppHandle,
    pub shutdown: Arc<AtomicBool>,
}

use serde::Serialize;
use symphonia::core::codecs::Decoder;
use symphonia::core::formats::FormatReader;

pub const DEFAULT_CROSSFADE_MS: u32 = 5000;

#[derive(Clone, Serialize)]
pub struct AudioError {
    pub code: String,
    pub title: String,
    pub message: String,
}

#[derive(Clone, Serialize)]
pub struct DeviceChanged {
    pub device_name: String,
}

pub type DecoderState = (Box<dyn FormatReader>, Box<dyn Decoder>, u32);
pub type LoadTrackResult = Result<(Box<dyn FormatReader>, Box<dyn Decoder>, u32, u64, u32), String>;

#[derive(Clone)]
pub struct PlaybackState {
    pub position_samples: Arc<AtomicU64>,
    pub duration_samples: Arc<AtomicU64>,
    pub sample_rate: Arc<AtomicU64>,
    pub is_playing: Arc<AtomicBool>,
    pub volume: Arc<AtomicU64>,
    pub current_path: Arc<RwLock<Option<String>>>,
    pub device_sample_rate: Arc<AtomicU32>,
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self::new()
    }
}

impl PlaybackState {
    pub fn new() -> Self {
        Self {
            position_samples: Arc::new(AtomicU64::new(0)),
            duration_samples: Arc::new(AtomicU64::new(0)),
            sample_rate: Arc::new(AtomicU64::new(44100)),
            is_playing: Arc::new(AtomicBool::new(false)),
            volume: Arc::new(AtomicU64::new(f32::to_bits(1.0) as u64)),
            current_path: Arc::new(RwLock::new(None)),
            device_sample_rate: Arc::new(AtomicU32::new(44100)),
        }
    }

    pub fn get_position_seconds(&self) -> f64 {
        let samples = self.position_samples.load(Ordering::Relaxed);
        let sample_rate = self.sample_rate.load(Ordering::Relaxed).max(1);
        samples as f64 / sample_rate as f64
    }

    pub fn get_duration_seconds(&self) -> f64 {
        let samples = self.duration_samples.load(Ordering::Relaxed);
        let sample_rate = self.sample_rate.load(Ordering::Relaxed).max(1);
        samples as f64 / sample_rate as f64
    }

    pub fn get_volume(&self) -> f32 {
        f32::from_bits(self.volume.load(Ordering::Relaxed) as u32)
    }

    pub fn set_volume(&self, vol: f32) {
        self.volume
            .store(f32::to_bits(vol.clamp(0.0, 1.0)) as u64, Ordering::Relaxed);
    }
}

pub enum DecoderCommand {
    Load(String),
    Seek(f64),
    Stop,
    QueueNext(String),
}

#[derive(Clone, Copy, PartialEq)]
pub enum CrossfadeState {
    Idle,
    Prebuffering,
    Crossfading {
        progress_samples: u64,
        total_samples: u64,
    },
}
