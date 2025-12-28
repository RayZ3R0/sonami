use std::cell::UnsafeCell;
use std::collections::VecDeque;
use std::fs::File;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use parking_lot::RwLock;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{Decoder, DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::units::Time;

use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const BUFFER_SIZE: usize = 65536;

// Debug logging for crossfade troubleshooting - set to false for production
const DEBUG_CROSSFADE: bool = false;

macro_rules! debug_cf {
    ($($arg:tt)*) => {
        if DEBUG_CROSSFADE {
            eprintln!("[CROSSFADE] {}", format!($($arg)*));
        }
    };
}

/// Error event payload for frontend notifications
#[derive(Clone, Serialize)]
pub struct AudioError {
    pub code: String,
    pub title: String,
    pub message: String,
}

/// Device change event payload
#[derive(Clone, Serialize)]
pub struct DeviceChanged {
    pub device_name: String,
}

type DecoderState = (Box<dyn FormatReader>, Box<dyn Decoder>, u32);
type LoadTrackResult = Result<(Box<dyn FormatReader>, Box<dyn Decoder>, u32, u64, u32), String>;

pub struct AudioBuffer {
    data: UnsafeCell<Box<[f32]>>,
    read_pos: AtomicU32,
    write_pos: AtomicU32,
    capacity: u32,
    lock: std::sync::Mutex<()>,
}

unsafe impl Sync for AudioBuffer {}
unsafe impl Send for AudioBuffer {}

impl AudioBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            data: UnsafeCell::new(vec![0.0; capacity].into_boxed_slice()),
            read_pos: AtomicU32::new(0),
            write_pos: AtomicU32::new(0),
            capacity: capacity as u32,
            lock: std::sync::Mutex::new(()),
        }
    }

    pub fn push_samples(&self, samples: &[f32]) -> usize {
        let _guard = self.lock.lock().unwrap();
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);

        let available = if write_pos >= read_pos {
            self.capacity - (write_pos - read_pos) - 1
        } else {
            read_pos - write_pos - 1
        };

        let to_write = (samples.len() as u32).min(available) as usize;
        let data_slice = unsafe { &mut *self.data.get() };

        for (i, &sample) in samples.iter().enumerate().take(to_write) {
            let pos = ((write_pos as usize) + i) % (self.capacity as usize);
            data_slice[pos] = sample;
        }

        let new_write = (write_pos + to_write as u32) % self.capacity;
        self.write_pos.store(new_write, Ordering::Release);
        to_write
    }

    pub fn pop_samples(&self, out: &mut [f32]) -> usize {
        let _guard = self.lock.lock().unwrap();
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);

        let available = if write_pos >= read_pos {
            write_pos - read_pos
        } else {
            self.capacity - read_pos + write_pos
        };

        let to_read = (out.len() as u32).min(available) as usize;
        let data_slice = unsafe { &*self.data.get() };

        for (i, out_sample) in out.iter_mut().enumerate().take(to_read) {
            let pos = ((read_pos as usize) + i) % (self.capacity as usize);
            *out_sample = data_slice[pos];
        }

        let new_read = (read_pos + to_read as u32) % self.capacity;
        self.read_pos.store(new_read, Ordering::Release);
        to_read
    }

    pub fn available_space(&self) -> usize {
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);
        let available = if write_pos >= read_pos {
            self.capacity - (write_pos - read_pos) - 1
        } else {
            read_pos - write_pos - 1
        };
        available as usize
    }

    pub fn clear(&self) {
        let _guard = self.lock.lock().unwrap();
        self.read_pos.store(0, Ordering::Release);
        self.write_pos.store(0, Ordering::Release);
    }
}

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

/// Crossfade state machine
#[derive(Clone, Copy, PartialEq)]
pub enum CrossfadeState {
    /// Normal playback, no crossfade active
    Idle,
    /// Pre-buffering next track, not yet mixing
    Prebuffering,
    /// Actively crossfading between two tracks
    Crossfading {
        progress_samples: u64,
        total_samples: u64,
    },
}

/// Default crossfade duration in milliseconds (user configurable)
pub const DEFAULT_CROSSFADE_MS: u32 = 5000;

use crate::dsp::DspChain;
use crate::media_controls::MediaControlsManager;
use crate::queue::{PlayQueue, RepeatMode};

pub struct AudioManager {
    pub state: PlaybackState,
    pub queue: Arc<RwLock<PlayQueue>>,
    pub dsp: Arc<RwLock<DspChain>>,
    pub media_controls: Arc<MediaControlsManager>,
    pub crossfade_duration_ms: Arc<AtomicU32>,
    pub crossfade_active: Arc<AtomicBool>,
    command_tx: std::sync::mpsc::Sender<DecoderCommand>,
    shutdown: Arc<AtomicBool>,
}

unsafe impl Send for AudioManager {}
unsafe impl Sync for AudioManager {}

impl AudioManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let state = PlaybackState::new();
        let (command_tx, command_rx) = std::sync::mpsc::channel();
        let shutdown = Arc::new(AtomicBool::new(false));

        // Primary and secondary buffers for crossfade
        let buffer_a = Arc::new(AudioBuffer::new(BUFFER_SIZE));
        let buffer_b = Arc::new(AudioBuffer::new(BUFFER_SIZE));

        let queue = Arc::new(RwLock::new(PlayQueue::new()));
        let dsp = Arc::new(RwLock::new(DspChain::new()));
        let media_controls = Arc::new(MediaControlsManager::new());
        let crossfade_duration_ms = Arc::new(AtomicU32::new(DEFAULT_CROSSFADE_MS));
        let crossfade_active = Arc::new(AtomicBool::new(false));

        let state_decoder = state.clone();
        let state_output = state.clone();
        let buffer_a_decoder = buffer_a.clone();
        let buffer_b_decoder = buffer_b.clone();
        let buffer_a_output = buffer_a.clone();
        let buffer_b_output = buffer_b.clone();
        let crossfade_ms_decoder = crossfade_duration_ms.clone();
        let crossfade_ms_output = crossfade_duration_ms.clone();
        let crossfade_active_decoder = crossfade_active.clone();
        let crossfade_active_output = crossfade_active.clone();
        let shutdown_decoder = shutdown.clone();
        let shutdown_output = shutdown.clone();

        // Clone for threads
        let queue_decoder = queue.clone();
        let dsp_output = dsp.clone();
        let app_handle_output = app_handle.clone();

        thread::spawn(move || {
            decoder_thread(
                command_rx,
                buffer_a_decoder,
                buffer_b_decoder,
                state_decoder,
                queue_decoder,
                crossfade_ms_decoder,
                crossfade_active_decoder,
                app_handle,
                shutdown_decoder,
            );
        });

        thread::spawn(move || {
            run_audio_output(
                buffer_a_output,
                buffer_b_output,
                state_output,
                dsp_output,
                crossfade_ms_output,
                crossfade_active_output,
                app_handle_output,
                shutdown_output,
            );
        });

        Self {
            state,
            command_tx,
            queue,
            dsp,
            media_controls,
            crossfade_duration_ms,
            crossfade_active,
            shutdown,
        }
    }

    /// Signal all threads to shut down gracefully
    pub fn shutdown(&self) {
        self.shutdown.store(true, Ordering::Relaxed);
    }

    pub fn play(&self, path: String) {
        // Sync queue index
        {
            let mut q = self.queue.write();
            q.play_track_by_path(&path);
        }
        *self.state.current_path.write() = Some(path.clone());
        let _ = self.command_tx.send(DecoderCommand::Load(path));
    }

    pub fn pause(&self) {
        self.state.is_playing.store(false, Ordering::Relaxed);
    }
    pub fn resume(&self) {
        self.state.is_playing.store(true, Ordering::Relaxed);
    }
    pub fn stop(&self) {
        let _ = self.command_tx.send(DecoderCommand::Stop);
    }
    pub fn seek(&self, seconds: f64) {
        let _ = self.command_tx.send(DecoderCommand::Seek(seconds));
    }
    pub fn set_volume(&self, vol: f32) {
        self.state.set_volume(vol);
    }
    pub fn get_position(&self) -> f64 {
        self.state.get_position_seconds()
    }
    pub fn get_duration(&self) -> f64 {
        self.state.get_duration_seconds()
    }
    pub fn is_playing(&self) -> bool {
        self.state.is_playing.load(Ordering::Relaxed)
    }

    pub fn command_tx_clone(&self) -> std::sync::mpsc::Sender<DecoderCommand> {
        self.command_tx.clone()
    }
}

fn run_audio_output(
    buffer_a: Arc<AudioBuffer>,
    buffer_b: Arc<AudioBuffer>,
    state: PlaybackState,
    dsp: Arc<RwLock<DspChain>>,
    crossfade_ms: Arc<AtomicU32>,
    crossfade_active: Arc<AtomicBool>,
    app_handle: AppHandle,
    shutdown: Arc<AtomicBool>,
) {
    let host = cpal::default_host();
    let mut current_device_name: Option<String> = None;
    let mut no_device_notified = false;

    loop {
        // Check for shutdown signal
        if shutdown.load(Ordering::Relaxed) {
            break;
        }

        let device = match host.default_output_device() {
            Some(d) => {
                no_device_notified = false;
                d
            }
            None => {
                if !no_device_notified {
                    let _ = app_handle.emit(
                        "audio-error",
                        AudioError {
                            code: "NO_DEVICE".to_string(),
                            title: "No Audio Device".to_string(),
                            message: "No audio output device found. Please connect speakers or headphones.".to_string(),
                        },
                    );
                    no_device_notified = true;
                }
                thread::sleep(Duration::from_secs(1));
                continue;
            }
        };

        let device_name = device.name().unwrap_or_default();

        // Notify on device change
        if current_device_name.as_ref() != Some(&device_name) {
            if current_device_name.is_some() {
                // Device changed (not first connection)
                let _ = app_handle.emit(
                    "device-changed",
                    DeviceChanged {
                        device_name: device_name.clone(),
                    },
                );
            }
            current_device_name = Some(device_name.clone());
        }

        let config = match device.default_output_config() {
            Ok(c) => c,
            Err(e) => {
                let _ = app_handle.emit(
                    "audio-error",
                    AudioError {
                        code: "CONFIG_ERROR".to_string(),
                        title: "Audio Configuration Error".to_string(),
                        message: format!("Failed to get audio config: {}", e),
                    },
                );
                thread::sleep(Duration::from_secs(1));
                continue;
            }
        };

        let sample_rate = config.sample_rate().0;
        state
            .device_sample_rate
            .store(sample_rate, Ordering::Relaxed);

        let app_handle_err = app_handle.clone();
        let err_fn = move |err| {
            eprintln!("Audio output error: {}", err);
            let _ = app_handle_err.emit(
                "audio-error",
                AudioError {
                    code: "STREAM_ERROR".to_string(),
                    title: "Audio Stream Error".to_string(),
                    message: format!("{}", err),
                },
            );
        };

        let stream_result = match config.sample_format() {
            cpal::SampleFormat::F32 => run_stream::<f32>(
                &device,
                &config.into(),
                buffer_a.clone(),
                buffer_b.clone(),
                state.clone(),
                dsp.clone(),
                crossfade_ms.clone(),
                crossfade_active.clone(),
                err_fn,
            ),
            cpal::SampleFormat::I16 => run_stream::<i16>(
                &device,
                &config.into(),
                buffer_a.clone(),
                buffer_b.clone(),
                state.clone(),
                dsp.clone(),
                crossfade_ms.clone(),
                crossfade_active.clone(),
                err_fn,
            ),
            cpal::SampleFormat::U16 => run_stream::<u16>(
                &device,
                &config.into(),
                buffer_a.clone(),
                buffer_b.clone(),
                state.clone(),
                dsp.clone(),
                crossfade_ms.clone(),
                crossfade_active.clone(),
                err_fn,
            ),
            _ => Err(cpal::BuildStreamError::StreamConfigNotSupported),
        };

        if let Ok(stream) = stream_result {
            if stream.play().is_ok() {
                // Monitor for device changes or shutdown
                loop {
                    if shutdown.load(Ordering::Relaxed) {
                        break;
                    }

                    // Check if default device has changed
                    let new_device = host.default_output_device();
                    let new_name = new_device.as_ref().and_then(|d| d.name().ok());

                    if new_name.as_ref() != current_device_name.as_ref() {
                        // Device changed - break to reconnect
                        break;
                    }

                    thread::sleep(Duration::from_millis(500));
                }
            }
        } else {
            let _ = app_handle.emit(
                "audio-error",
                AudioError {
                    code: "STREAM_BUILD_ERROR".to_string(),
                    title: "Failed to Start Audio".to_string(),
                    message: "Could not create audio stream. Retrying...".to_string(),
                },
            );
        }
        thread::sleep(Duration::from_millis(500));
    }
}

fn run_stream<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    buffer_a: Arc<AudioBuffer>,
    buffer_b: Arc<AudioBuffer>,
    state: PlaybackState,
    dsp: Arc<RwLock<DspChain>>,
    crossfade_ms: Arc<AtomicU32>,
    crossfade_active: Arc<AtomicBool>,
    err_fn: impl Fn(cpal::StreamError) + Send + 'static,
) -> Result<cpal::Stream, cpal::BuildStreamError>
where
    T: cpal::Sample + cpal::SizedSample + cpal::FromSample<f32>,
{
    let channels = config.channels as usize;
    let sample_rate = config.sample_rate.0;

    // Crossfade progress tracking within output callback
    let crossfade_progress = Arc::new(AtomicU64::new(0));
    
    // Track if we're draining buffer_b after crossfade transition
    // This ensures we play ALL of buffer_b before switching to buffer_a
    let draining_buffer_b = Arc::new(AtomicBool::new(false));
    let draining_buffer_b_clone = draining_buffer_b.clone();
    
    // Debug: state tracking
    let debug_state = Arc::new(AtomicU32::new(0)); // 0=normal, 1=crossfade, 2=crossfade_complete, 3=draining, 4=drain_end
    let debug_callback_count = Arc::new(AtomicU64::new(0));
    
    // Mini-crossfade state for the buffer_b to buffer_a transition
    const MICRO_FADE_SAMPLES: usize = 512; // ~10ms at 48kHz
    let micro_fade_active = Arc::new(AtomicBool::new(false));
    let micro_fade_active_clone = micro_fade_active.clone();
    let micro_fade_progress = Arc::new(AtomicU64::new(0));
    let micro_fade_progress_clone = micro_fade_progress.clone();

    device.build_output_stream(
        config,
        move |data: &mut [T], _: &cpal::OutputCallbackInfo| {
            let callback_num = debug_callback_count.fetch_add(1, Ordering::Relaxed);
            
            let is_playing = state.is_playing.load(Ordering::Relaxed);
            let volume = state.get_volume();

            if !is_playing {
                data.fill(T::from_sample(0.0));
                return;
            }

            // Check states FIRST before deciding which buffers to pop from
            let is_crossfading = crossfade_active.load(Ordering::Acquire);
            let is_draining = draining_buffer_b_clone.load(Ordering::Acquire);
            
            let cf_duration_samples = {
                let ms = crossfade_ms.load(Ordering::Relaxed) as u64;
                (ms * sample_rate as u64) / 1000
            };

            // Check buffer_b state BEFORE popping to determine if we need micro-fade
            let samples_in_b_before_pop = BUFFER_SIZE - buffer_b.available_space();
            let need_micro_fade = is_draining && !is_crossfading && 
                samples_in_b_before_pop > 0 && 
                samples_in_b_before_pop <= MICRO_FADE_SAMPLES + data.len(); // Start micro-fade early enough
            
            if need_micro_fade && !micro_fade_active_clone.load(Ordering::Relaxed) {
                micro_fade_active_clone.store(true, Ordering::Release);
                micro_fade_progress_clone.store(0, Ordering::Relaxed);
                debug_cf!("cb#{} MICRO_FADE START | samples_in_b={}", callback_num, samples_in_b_before_pop);
            }

            // Allocate temp buffers
            let mut temp_buf_a = vec![0.0; data.len()];
            let mut temp_buf_b = vec![0.0; data.len()];
            let mut read_a = 0;
            let mut read_b = 0;

            // Only pop from the buffers we actually need based on current state
            let is_micro_fading = micro_fade_active_clone.load(Ordering::Relaxed);
            
            if is_crossfading {
                // Crossfade: need both buffers
                read_a = buffer_a.pop_samples(&mut temp_buf_a);
                read_b = buffer_b.pop_samples(&mut temp_buf_b);
            } else if is_draining && is_micro_fading {
                // Micro-fade during drain: need both buffers
                read_a = buffer_a.pop_samples(&mut temp_buf_a);
                read_b = buffer_b.pop_samples(&mut temp_buf_b);
            } else if is_draining {
                // Normal draining: ONLY pop from buffer_b, leave buffer_a untouched!
                read_b = buffer_b.pop_samples(&mut temp_buf_b);
            } else {
                // Normal: only pop from buffer_a
                read_a = buffer_a.pop_samples(&mut temp_buf_a);
            }

            // Mix samples
            let mut output_buf = vec![0.0; data.len()];
            let read_samples = read_a.max(read_b);
            
            // Debug: track state transitions (only log on state change or every 100 callbacks during crossfade)
            let prev_state = debug_state.load(Ordering::Relaxed);

            if is_crossfading {
                // When crossfade starts, mark that we'll need to drain buffer_b
                draining_buffer_b_clone.store(true, Ordering::Release);
                
                // Crossfade mode - mix both buffers
                let progress = crossfade_progress.load(Ordering::Relaxed);
                let crossfade_complete = progress >= cf_duration_samples;
                
                let new_state = if crossfade_complete { 2 } else { 1 };
                if prev_state != new_state || callback_num % 50 == 0 {
                    debug_state.store(new_state, Ordering::Relaxed);
                    let t = progress as f64 / cf_duration_samples as f64;
                    let gain_a = (t * std::f64::consts::FRAC_PI_2).cos() as f32;
                    let gain_b = (t * std::f64::consts::FRAC_PI_2).sin() as f32;
                    debug_cf!(
                        "cb#{} STATE={} | read_a={} read_b={} | progress={}/{} ({:.1}%) | gain_a={:.3} gain_b={:.3} | sample_a[0]={:.4} sample_b[0]={:.4}",
                        callback_num,
                        if crossfade_complete { "CF_COMPLETE" } else { "CROSSFADE" },
                        read_a, read_b,
                        progress, cf_duration_samples,
                        t * 100.0,
                        gain_a, gain_b,
                        if read_a > 0 { temp_buf_a[0] } else { 0.0 },
                        if read_b > 0 { temp_buf_b[0] } else { 0.0 }
                    );
                }

                for i in 0..read_samples {
                    // Calculate crossfade gains
                    // After crossfade duration, Song 2 (buffer_b) plays at full volume
                    let (gain_a, gain_b) = if crossfade_complete {
                        (0.0_f32, 1.0_f32) // Song 1 silent, Song 2 full volume
                    } else {
                        let t = ((progress + i as u64) as f64 / cf_duration_samples as f64).min(1.0);
                        // Equal power crossfade: gain_a = cos(t * π/2), gain_b = sin(t * π/2)
                        let gain_a = (t * std::f64::consts::FRAC_PI_2).cos() as f32;
                        let gain_b = (t * std::f64::consts::FRAC_PI_2).sin() as f32;
                        (gain_a, gain_b)
                    };

                    let sample_a = if i < read_a { temp_buf_a[i] } else { 0.0 };
                    let sample_b = if i < read_b { temp_buf_b[i] } else { 0.0 };

                    output_buf[i] = sample_a * gain_a + sample_b * gain_b;
                }

                // Only increment progress during the fade portion
                if !crossfade_complete {
                    crossfade_progress.fetch_add(read_samples as u64, Ordering::Relaxed);
                }
                
                // Note: crossfade_active is now only set to false by handle_track_end
                // when the track transition actually occurs
            } else if is_draining && read_b > 0 {
                // Draining mode: play buffer_b until it's completely empty
                // Micro-fade is already detected and activated above before popping
                
                if prev_state != 3 || callback_num % 50 == 0 {
                    debug_state.store(3, Ordering::Relaxed);
                    debug_cf!(
                        "cb#{} STATE=DRAINING | read_a={} read_b={} | micro_fade={} | sample_b[0]={:.4}",
                        callback_num, read_a, read_b, is_micro_fading,
                        if read_b > 0 { temp_buf_b[0] } else { 0.0 }
                    );
                }
                
                if is_micro_fading {
                    // During micro-fade: blend buffer_b with buffer_a
                    // We already popped from both buffers above
                    let progress = micro_fade_progress_clone.load(Ordering::Relaxed) as usize;
                    
                    for i in 0..read_samples {
                        let sample_b = if i < read_b { temp_buf_b[i] } else { 0.0 };
                        let sample_a = if i < read_a { temp_buf_a[i] } else { 0.0 };
                        
                        // Crossfade from buffer_b to buffer_a
                        let t = ((progress + i) as f32 / MICRO_FADE_SAMPLES as f32).min(1.0);
                        let gain_b = 1.0 - t;
                        let gain_a = t;
                        output_buf[i] = sample_b * gain_b + sample_a * gain_a;
                    }
                    
                    micro_fade_progress_clone.fetch_add(read_samples as u64, Ordering::Relaxed);
                } else {
                    // Normal draining - just play buffer_b
                    for i in 0..read_samples {
                        output_buf[i] = if i < read_b { temp_buf_b[i] } else { 0.0 };
                    }
                }
            } else if is_draining && read_b == 0 {
                // buffer_b is now empty, switch to buffer_a and clear drain flag
                // If we're in micro-fade mode, buffer_a was already popped above
                // Otherwise we need to pop it now
                if !is_micro_fading {
                    read_a = buffer_a.pop_samples(&mut temp_buf_a);
                }
                let read_samples_now = read_a;
                
                let was_micro_fading = micro_fade_active_clone.swap(false, Ordering::AcqRel);
                let micro_progress = micro_fade_progress_clone.swap(0, Ordering::Relaxed);
                
                debug_state.store(4, Ordering::Relaxed);
                debug_cf!(
                    "cb#{} STATE=DRAIN_END | read_a={} | was_micro_fade={} progress={} | sample_a[0]={:.4}",
                    callback_num, read_a, was_micro_fading, micro_progress,
                    if read_a > 0 { temp_buf_a[0] } else { 0.0 }
                );
                draining_buffer_b_clone.store(false, Ordering::Release);
                crossfade_progress.store(0, Ordering::Relaxed); // Reset for next crossfade
                
                // If we were micro-fading and didn't complete, continue the fade-in
                let remaining_fade = if was_micro_fading && micro_progress < MICRO_FADE_SAMPLES as u64 {
                    (MICRO_FADE_SAMPLES as u64 - micro_progress) as usize
                } else {
                    0
                };
                
                for i in 0..read_samples_now {
                    let sample_a = if i < read_a { temp_buf_a[i] } else { 0.0 };
                    
                    if i < remaining_fade {
                        // Continue fade-in from where we left off
                        let t = ((micro_progress as usize + i) as f32 / MICRO_FADE_SAMPLES as f32).min(1.0);
                        output_buf[i] = sample_a * t;
                    } else {
                        output_buf[i] = sample_a;
                    }
                }
                
                // Update read_samples for position tracking below
                // Note: we need to handle this specially since we changed read_a mid-callback
            } else {
                // Normal playback from primary buffer
                if prev_state != 0 {
                    debug_state.store(0, Ordering::Relaxed);
                    debug_cf!(
                        "cb#{} STATE=NORMAL | read_a={} read_b={} | sample_a[0]={:.4}",
                        callback_num, read_a, read_b,
                        if read_a > 0 { temp_buf_a[0] } else { 0.0 }
                    );
                }
                for i in 0..read_samples {
                    output_buf[i] = if i < read_a { temp_buf_a[i] } else { 0.0 };
                }
            }

            // Apply DSP processing
            // Recalculate read_samples in case it changed during DRAIN_END
            let final_read_samples = if is_draining && read_b == 0 { read_a } else { read_samples };
            if final_read_samples > 0 {
                let mut dsp_lock = dsp.write();
                dsp_lock.process(&mut output_buf[0..final_read_samples], channels, sample_rate);
            }

            for (i, sample) in data.iter_mut().enumerate() {
                if i < final_read_samples {
                    *sample = T::from_sample(output_buf[i] * volume);
                } else {
                    *sample = T::from_sample(0.0);
                }
            }

            if final_read_samples > 0 {
                let dev_rate = state.device_sample_rate.load(Ordering::Relaxed) as f64;
                let src_rate = state.sample_rate.load(Ordering::Relaxed) as f64;
                let ratio = if dev_rate > 0.0 {
                    src_rate / dev_rate
                } else {
                    1.0
                };
                let frames_played = final_read_samples / channels;
                let source_frames = (frames_played as f64 * ratio) as u64;
                state
                    .position_samples
                    .fetch_add(source_frames, Ordering::Relaxed);
            }
        },
        err_fn,
        None,
    )
}

fn decoder_thread(
    command_rx: std::sync::mpsc::Receiver<DecoderCommand>,
    buffer_a: Arc<AudioBuffer>,
    buffer_b: Arc<AudioBuffer>,
    state: PlaybackState,
    queue: Arc<RwLock<PlayQueue>>,
    crossfade_ms: Arc<AtomicU32>,
    crossfade_active: Arc<AtomicBool>,
    app_handle: AppHandle,
    shutdown: Arc<AtomicBool>,
) {
    let mut current_decoder: Option<DecoderState> = None;
    let mut next_decoder: Option<DecoderState> = None;
    let mut sample_buf: Option<SampleBuffer<f32>> = None;
    let mut next_sample_buf: Option<SampleBuffer<f32>> = None;
    let mut resampler: Option<SincFixedIn<f32>> = None;
    let mut next_resampler: Option<SincFixedIn<f32>> = None;
    let mut resampler_input_buffer: Vec<Vec<f32>> = Vec::new();
    let mut next_resampler_input_buffer: Vec<Vec<f32>> = Vec::new();
    let mut input_accumulator: VecDeque<f32> = VecDeque::new();
    let mut next_input_accumulator: VecDeque<f32> = VecDeque::new();
    let mut crossfade_state = CrossfadeState::Idle;
    let mut next_track_info: Option<crate::queue::Track> = None;

    loop {
        // Check for shutdown
        if shutdown.load(Ordering::Relaxed) {
            break;
        }

        let command = if current_decoder.is_some() && state.is_playing.load(Ordering::Relaxed) {
            command_rx.try_recv().ok()
        } else {
            // Use timeout to allow shutdown checks
            match command_rx.recv_timeout(Duration::from_millis(100)) {
                Ok(cmd) => Some(cmd),
                Err(_) => None,
            }
        };

        if let Some(cmd) = command {
            match cmd {
                DecoderCommand::Load(path) => match load_track(&path) {
                    Ok((reader, decoder, track_id, duration_samples, sample_rate)) => {
                        buffer_a.clear();
                        buffer_b.clear();
                        input_accumulator.clear();
                        next_input_accumulator.clear();
                        state.position_samples.store(0, Ordering::Relaxed);
                        state
                            .duration_samples
                            .store(duration_samples, Ordering::Relaxed);
                        state
                            .sample_rate
                            .store(sample_rate as u64, Ordering::Relaxed);
                        state.is_playing.store(true, Ordering::Relaxed);
                        crossfade_active.store(false, Ordering::Relaxed);
                        current_decoder = Some((reader, decoder, track_id));
                        next_decoder = None;
                        next_track_info = None;
                        sample_buf = None;
                        next_sample_buf = None;
                        crossfade_state = CrossfadeState::Idle;

                        let device_rate = state.device_sample_rate.load(Ordering::Relaxed);
                        if device_rate != 0 && device_rate != sample_rate {
                            let params = SincInterpolationParameters {
                                sinc_len: 256,
                                f_cutoff: 0.95,
                                interpolation: SincInterpolationType::Linear,
                                window: WindowFunction::BlackmanHarris2,
                                oversampling_factor: 128,
                            };
                            if let Ok(r) = SincFixedIn::<f32>::new(
                                device_rate as f64 / sample_rate as f64,
                                2.0,
                                params,
                                1024,
                                2,
                            ) {
                                resampler = Some(r);
                                resampler_input_buffer = vec![vec![0.0; 1024]; 2];
                            } else {
                                resampler = None;
                            }
                        } else {
                            resampler = None;
                        }
                    }
                    Err(e) => {
                        let filename = Path::new(&path)
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or(&path);
                        let _ = app_handle.emit(
                            "audio-error",
                            AudioError {
                                code: "DECODE_ERROR".to_string(),
                                title: "Failed to Load Track".to_string(),
                                message: format!("Could not play \"{}\": {}", filename, e),
                            },
                        );
                    }
                },
                DecoderCommand::Seek(seconds) => {
                    if let Some((ref mut reader, ref mut decoder, _)) = current_decoder {
                        let sample_rate = state.sample_rate.load(Ordering::Relaxed) as u32;
                        let seek_time = Time::new(seconds as u64, seconds.fract());
                        if reader
                            .seek(
                                SeekMode::Accurate,
                                SeekTo::Time {
                                    time: seek_time,
                                    track_id: None,
                                },
                            )
                            .is_ok()
                        {
                            decoder.reset();
                            buffer_a.clear();
                            input_accumulator.clear();
                            // Cancel any pending crossfade on seek
                            crossfade_active.store(false, Ordering::Relaxed);
                            crossfade_state = CrossfadeState::Idle;
                            next_decoder = None;
                            buffer_b.clear();
                            state
                                .position_samples
                                .store((seconds * sample_rate as f64) as u64, Ordering::Relaxed);
                        }
                    }
                }
                DecoderCommand::Stop => {
                    state.is_playing.store(false, Ordering::Relaxed);
                    state.position_samples.store(0, Ordering::Relaxed);
                    crossfade_active.store(false, Ordering::Relaxed);
                    buffer_a.clear();
                    buffer_b.clear();
                    input_accumulator.clear();
                    next_input_accumulator.clear();
                    current_decoder = None;
                    next_decoder = None;
                    next_track_info = None;
                    crossfade_state = CrossfadeState::Idle;
                }
                DecoderCommand::QueueNext(_) => {
                    // Deprecated command, queue is now managed internally
                }
            }
        }

        if let Some((ref mut reader, ref mut decoder, track_id)) = current_decoder {
            if !state.is_playing.load(Ordering::Relaxed) {
                thread::sleep(Duration::from_millis(10));
                continue;
            }

            // Get crossfade duration in samples
            let cf_duration_ms = crossfade_ms.load(Ordering::Relaxed) as u64;
            let sample_rate = state.sample_rate.load(Ordering::Relaxed);
            let cf_duration_samples = (cf_duration_ms * sample_rate) / 1000;
            let position = state.position_samples.load(Ordering::Relaxed);
            let duration = state.duration_samples.load(Ordering::Relaxed);

            // Check if we should start pre-buffering (approaching end of track)
            let should_prebuffer = cf_duration_ms > 0
                && duration > cf_duration_samples
                && position >= duration.saturating_sub(cf_duration_samples)
                && crossfade_state == CrossfadeState::Idle
                && next_decoder.is_none();

            if should_prebuffer {
                // Get next track from queue
                let next_track_opt = {
                    let q = queue.read();
                    q.peek_next_track()
                };

                if let Some(track) = next_track_opt {
                    if let Ok((r, d, tid, _dur, sr)) = load_track(&track.path) {
                        next_decoder = Some((r, d, tid));
                        next_track_info = Some(track);
                        next_sample_buf = None;
                        next_input_accumulator.clear();
                        buffer_b.clear();

                        // Set up resampler for next track if needed
                        let device_rate = state.device_sample_rate.load(Ordering::Relaxed);
                        if device_rate != 0 && device_rate != sr {
                            let params = SincInterpolationParameters {
                                sinc_len: 256,
                                f_cutoff: 0.95,
                                interpolation: SincInterpolationType::Linear,
                                window: WindowFunction::BlackmanHarris2,
                                oversampling_factor: 128,
                            };
                            if let Ok(r) = SincFixedIn::<f32>::new(
                                device_rate as f64 / sr as f64,
                                2.0,
                                params,
                                1024,
                                2,
                            ) {
                                next_resampler = Some(r);
                                next_resampler_input_buffer = vec![vec![0.0; 1024]; 2];
                            } else {
                                next_resampler = None;
                            }
                        } else {
                            next_resampler = None;
                        }

                        crossfade_state = CrossfadeState::Prebuffering;
                        debug_cf!("DECODER: Started prebuffering next track: {:?}", next_track_info.as_ref().map(|t| &t.path));
                    }
                }
            }

            // Decode primary track into buffer_a
            if buffer_a.available_space() >= 4096 {
                match reader.next_packet() {
                    Ok(packet) => {
                        if packet.track_id() == track_id {
                            if let Ok(decoded) = decoder.decode(&packet) {
                                let spec = *decoded.spec();
                                let dur = decoded.capacity() as u64;
                                if sample_buf.is_none()
                                    || sample_buf.as_ref().unwrap().capacity() < dur as usize
                                {
                                    sample_buf = Some(SampleBuffer::new(dur, spec));
                                }

                                if let Some(ref mut buf) = sample_buf {
                                    buf.copy_interleaved_ref(decoded);
                                    let samples = buf.samples();
                                    push_samples_to_buffer(
                                        samples,
                                        &buffer_a,
                                        &mut resampler,
                                        &mut resampler_input_buffer,
                                        &mut input_accumulator,
                                    );
                                }
                            }
                        }
                    }
                    Err(symphonia::core::errors::Error::IoError(ref e))
                        if e.kind() == std::io::ErrorKind::UnexpectedEof =>
                    {
                        // Primary track ended - handle transition
                        handle_track_end(
                            &mut current_decoder,
                            &mut next_decoder,
                            &mut sample_buf,
                            &mut next_sample_buf,
                            &mut resampler,
                            &mut next_resampler,
                            &mut resampler_input_buffer,
                            &mut next_resampler_input_buffer,
                            &mut input_accumulator,
                            &mut next_input_accumulator,
                            &mut crossfade_state,
                            &mut next_track_info,
                            &crossfade_active,
                            &crossfade_ms,
                            &state,
                            &queue,
                            &buffer_a,
                            &buffer_b,
                            &app_handle,
                        );
                        continue;
                    }
                    Err(_) => {}
                }
            }

            // Decode secondary track into buffer_b during prebuffering/crossfade
            if matches!(
                crossfade_state,
                CrossfadeState::Prebuffering | CrossfadeState::Crossfading { .. }
            ) {
                if let Some((ref mut next_reader, ref mut next_dec, next_tid)) = next_decoder {
                    if buffer_b.available_space() >= 4096 {
                        match next_reader.next_packet() {
                            Ok(packet) => {
                                if packet.track_id() == next_tid {
                                    if let Ok(decoded) = next_dec.decode(&packet) {
                                        let spec = *decoded.spec();
                                        let dur = decoded.capacity() as u64;
                                        if next_sample_buf.is_none()
                                            || next_sample_buf.as_ref().unwrap().capacity()
                                                < dur as usize
                                        {
                                            next_sample_buf = Some(SampleBuffer::new(dur, spec));
                                        }

                                        if let Some(ref mut buf) = next_sample_buf {
                                            buf.copy_interleaved_ref(decoded);
                                            let samples = buf.samples();
                                            push_samples_to_buffer(
                                                samples,
                                                &buffer_b,
                                                &mut next_resampler,
                                                &mut next_resampler_input_buffer,
                                                &mut next_input_accumulator,
                                            );
                                        }
                                    }
                                }

                                // Once we have enough in buffer_b, activate crossfade
                                if crossfade_state == CrossfadeState::Prebuffering
                                    && BUFFER_SIZE - buffer_b.available_space() >= 8192
                                {
                                    crossfade_state = CrossfadeState::Crossfading {
                                        progress_samples: 0,
                                        total_samples: cf_duration_samples,
                                    };
                                    crossfade_active.store(true, Ordering::Relaxed);
                                    debug_cf!("DECODER: CROSSFADE ACTIVATED! buffer_b has {} samples, cf_duration={} samples", 
                                        BUFFER_SIZE - buffer_b.available_space(), cf_duration_samples);
                                }
                            }
                            Err(_) => {}
                        }
                    }
                }
            }

            // Brief sleep to avoid spinning
            if buffer_a.available_space() < 4096 {
                thread::sleep(Duration::from_micros(500));
            }
        } else {
            thread::sleep(Duration::from_millis(10));
        }
    }
}

/// Push samples to buffer with optional resampling
fn push_samples_to_buffer(
    samples: &[f32],
    buffer: &Arc<AudioBuffer>,
    resampler: &mut Option<SincFixedIn<f32>>,
    resampler_input_buffer: &mut Vec<Vec<f32>>,
    input_accumulator: &mut VecDeque<f32>,
) {
    if let Some(ref mut r) = resampler {
        input_accumulator.extend(samples.iter());
        let chunk_size = r.input_frames_max();
        let channels = 2;
        let chunk_len = chunk_size * channels;

        while input_accumulator.len() >= chunk_len {
            for c in 0..channels {
                for i in 0..chunk_size {
                    resampler_input_buffer[c][i] = input_accumulator[(i * channels) + c];
                }
            }
            input_accumulator.drain(0..chunk_len);

            if let Ok(output_frames) = r.process(resampler_input_buffer, None) {
                let out_len = output_frames[0].len();
                if out_len > 0 {
                    let mut interleaved = Vec::with_capacity(out_len * channels);
                    for i in 0..out_len {
                        for c in 0..channels {
                            interleaved.push(output_frames[c][i]);
                        }
                    }
                    let mut written = 0;
                    while written < interleaved.len() {
                        let w = buffer.push_samples(&interleaved[written..]);
                        if w == 0 {
                            thread::sleep(Duration::from_micros(100));
                        }
                        written += w;
                    }
                }
            }
        }
    } else {
        let mut written = 0;
        while written < samples.len() {
            let w = buffer.push_samples(&samples[written..]);
            if w == 0 {
                thread::sleep(Duration::from_micros(100));
            }
            written += w;
        }
    }
}

/// Handle end of current track - transition to next or stop
#[allow(clippy::too_many_arguments)]
fn handle_track_end(
    current_decoder: &mut Option<DecoderState>,
    next_decoder: &mut Option<DecoderState>,
    sample_buf: &mut Option<SampleBuffer<f32>>,
    next_sample_buf: &mut Option<SampleBuffer<f32>>,
    resampler: &mut Option<SincFixedIn<f32>>,
    next_resampler: &mut Option<SincFixedIn<f32>>,
    resampler_input_buffer: &mut Vec<Vec<f32>>,
    next_resampler_input_buffer: &mut Vec<Vec<f32>>,
    input_accumulator: &mut VecDeque<f32>,
    next_input_accumulator: &mut VecDeque<f32>,
    crossfade_state: &mut CrossfadeState,
    next_track_info: &mut Option<crate::queue::Track>,
    crossfade_active: &Arc<AtomicBool>,
    crossfade_ms: &Arc<AtomicU32>,
    state: &PlaybackState,
    queue: &Arc<RwLock<PlayQueue>>,
    buffer_a: &Arc<AudioBuffer>,
    buffer_b: &Arc<AudioBuffer>,
    app_handle: &AppHandle,
) {
    let _ = app_handle.emit("track-ended", ());

    // Check if Repeat One is active - if so, seek to beginning instead of loading next
    let repeat_mode = queue.read().repeat;
    if repeat_mode == RepeatMode::One && current_decoder.is_some() {
        // Seek to beginning of current track
        if let Some((ref mut reader, ref mut decoder, _)) = current_decoder {
            let seek_time = Time::new(0, 0.0);
            if reader
                .seek(
                    SeekMode::Accurate,
                    SeekTo::Time {
                        time: seek_time,
                        track_id: None,
                    },
                )
                .is_ok()
            {
                decoder.reset();
                buffer_a.clear();
                buffer_b.clear();
                input_accumulator.clear();
                state.position_samples.store(0, Ordering::Relaxed);
                *crossfade_state = CrossfadeState::Idle;
                crossfade_active.store(false, Ordering::Relaxed);
                *next_decoder = None;
                *next_track_info = None;
                return;
            }
        }
        // If seek fails, fall through to reload
    }

    // If we were crossfading, the next decoder is already set up
    if next_decoder.is_some() {
        debug_cf!("HANDLE_TRACK_END: Crossfade complete, promoting next decoder");
        debug_cf!("  buffer_a space={} buffer_b space={}", buffer_a.available_space(), buffer_b.available_space());
        debug_cf!("  next_input_accumulator has {} samples", next_input_accumulator.len());
        
        // IMPORTANT: Flush any remaining samples from next_input_accumulator to buffer_b
        // These samples are the continuation of what's already in buffer_b and should
        // play BEFORE we switch to buffer_a
        if !next_input_accumulator.is_empty() {
            let remaining: Vec<f32> = next_input_accumulator.drain(..).collect();
            debug_cf!("  Flushing {} samples from accumulator to buffer_b", remaining.len());
            let mut written = 0;
            while written < remaining.len() {
                let w = buffer_b.push_samples(&remaining[written..]);
                if w == 0 {
                    break; // buffer_b is full, can't push more
                }
                written += w;
            }
        }
        
        // Promote next decoder to current
        *current_decoder = next_decoder.take();
        *sample_buf = next_sample_buf.take();
        *resampler = next_resampler.take();
        std::mem::swap(resampler_input_buffer, next_resampler_input_buffer);
        // Clear the accumulator instead of swapping - we already flushed next's samples to buffer_b
        input_accumulator.clear();
        next_input_accumulator.clear();

        // Don't clear buffer_a yet - let the output drain buffer_b first
        // The decoder will start writing to buffer_a from where it left off
        // Note: buffer_b may still have Song 2 data that output is playing
        
        if let Some(track) = next_track_info.take() {
            debug_cf!("  New track: {:?}", track.path);
            *state.current_path.write() = Some(track.path.clone());
            let _ = app_handle.emit("track-changed", track.clone());

            // Update queue position
            {
                let mut q = queue.write();
                q.get_next_track(false); // Advance queue to match
            }

            // Update state for new track
            // Note: We set position to the crossfade duration since that's roughly
            // how far into Song 2 we already are
            if let Some((ref reader, _, _)) = current_decoder {
                if let Some(audio_track) = reader.tracks().iter().find(|t| t.codec_params.codec != CODEC_TYPE_NULL) {
                    let sample_rate = audio_track.codec_params.sample_rate.unwrap_or(44100) as u64;
                    let cf_ms = crossfade_ms.load(Ordering::Relaxed);
                    let cf_samples = (cf_ms as u64 * sample_rate) / 1000;
                    // Position is approximately the crossfade duration into the song
                    debug_cf!("  Setting position to {} samples ({}ms into song)", cf_samples, cf_ms);
                    state.position_samples.store(cf_samples, Ordering::Relaxed);
                    state.duration_samples.store(audio_track.codec_params.n_frames.unwrap_or(0), Ordering::Relaxed);
                    state.sample_rate.store(sample_rate, Ordering::Relaxed);
                }
            }
        }

        *crossfade_state = CrossfadeState::Idle;
        
        // IMPORTANT: Clear buffer_a FIRST before setting crossfade_active to false.
        // Otherwise output callback might read stale Song 1 data from buffer_a.
        // After clearing, output will use the special case to keep reading buffer_b.
        debug_cf!("  Clearing buffer_a and setting crossfade_active=false");
        buffer_a.clear();
        std::sync::atomic::fence(Ordering::SeqCst); // Memory barrier to ensure clear is visible
        crossfade_active.store(false, Ordering::Release);
        debug_cf!("  After clear: buffer_a space={} buffer_b space={}", buffer_a.available_space(), buffer_b.available_space());
        return;
    }

    // No crossfade - load next track directly
    let next_track_opt = {
        let mut q = queue.write();
        q.get_next_track(false)
    };

    if let Some(track) = next_track_opt {
        let next_path = track.path.clone();
        *state.current_path.write() = Some(next_path.clone());
        let _ = app_handle.emit("track-changed", track);

        if let Ok((r, d, tid, dur, sr)) = load_track(&next_path) {
            state.position_samples.store(0, Ordering::Relaxed);
            state.duration_samples.store(dur, Ordering::Relaxed);
            state.sample_rate.store(sr as u64, Ordering::Relaxed);
            *current_decoder = Some((r, d, tid));
            *sample_buf = None;
            input_accumulator.clear();
            buffer_a.clear();
            buffer_b.clear();

            let device_rate = state.device_sample_rate.load(Ordering::Relaxed);
            if device_rate != 0 && device_rate != sr {
                let params = SincInterpolationParameters {
                    sinc_len: 256,
                    f_cutoff: 0.95,
                    interpolation: SincInterpolationType::Linear,
                    window: WindowFunction::BlackmanHarris2,
                    oversampling_factor: 128,
                };
                if let Ok(r) = SincFixedIn::<f32>::new(
                    device_rate as f64 / sr as f64,
                    2.0,
                    params,
                    1024,
                    2,
                ) {
                    *resampler = Some(r);
                    *resampler_input_buffer = vec![vec![0.0; 1024]; 2];
                } else {
                    *resampler = None;
                }
            } else {
                *resampler = None;
            }
        } else {
            state.is_playing.store(false, Ordering::Relaxed);
            *current_decoder = None;
        }
    } else {
        state.is_playing.store(false, Ordering::Relaxed);
        *current_decoder = None;
    }

    *crossfade_state = CrossfadeState::Idle;
    crossfade_active.store(false, Ordering::Relaxed);
}

fn load_track(path: &str) -> LoadTrackResult {
    let path = Path::new(path);
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let format_opts = FormatOptions {
        enable_gapless: true,
        ..Default::default()
    };
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &MetadataOptions::default())
        .map_err(|e| e.to_string())?;

    let reader = probed.format;
    let track = reader
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or("No audio track")?;
    let track_id = track.id;
    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    let duration_samples = track.codec_params.n_frames.unwrap_or(0);
    let decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| e.to_string())?;

    Ok((reader, decoder, track_id, duration_samples, sample_rate))
}
