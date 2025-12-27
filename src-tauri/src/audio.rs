use std::fs::File;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleRate, StreamConfig};
use parking_lot::{Mutex, RwLock};
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{Decoder, DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::formats::{FormatOptions, FormatReader, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::units::Time;

const BUFFER_SIZE: usize = 65536; // Larger buffer for stability

/// Type alias for the decoder tuple to reduce complexity
type DecoderState = (Box<dyn FormatReader>, Box<dyn Decoder>, u32);

/// Result type for load_track function
type LoadTrackResult = Result<(Box<dyn FormatReader>, Box<dyn Decoder>, u32, u64, u32), String>;

/// A simple thread-safe ring buffer for audio samples using a fixed-size array
pub struct AudioBuffer {
    data: Box<[f32]>,
    read_pos: AtomicU32,
    write_pos: AtomicU32,
    capacity: u32,
    lock: Mutex<()>,
}

impl AudioBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            data: vec![0.0; capacity].into_boxed_slice(),
            read_pos: AtomicU32::new(0),
            write_pos: AtomicU32::new(0),
            capacity: capacity as u32,
            lock: Mutex::new(()),
        }
    }

    pub fn push_samples(&self, samples: &[f32]) -> usize {
        let _guard = self.lock.lock();
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);

        let available = if write_pos >= read_pos {
            self.capacity - (write_pos - read_pos) - 1
        } else {
            read_pos - write_pos - 1
        };

        let to_write = (samples.len() as u32).min(available) as usize;

        // SAFETY: We hold the lock so no concurrent access
        let data_ptr = self.data.as_ptr() as *mut f32;
        for (i, &sample) in samples.iter().enumerate().take(to_write) {
            let pos = ((write_pos as usize) + i) % (self.capacity as usize);
            unsafe {
                *data_ptr.add(pos) = sample;
            }
        }

        let new_write = (write_pos + to_write as u32) % self.capacity;
        self.write_pos.store(new_write, Ordering::Release);

        to_write
    }

    pub fn pop_samples(&self, out: &mut [f32]) -> usize {
        let _guard = self.lock.lock();
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);

        let available = if write_pos >= read_pos {
            write_pos - read_pos
        } else {
            self.capacity - read_pos + write_pos
        };

        let to_read = (out.len() as u32).min(available) as usize;

        // SAFETY: We hold the lock so no concurrent access
        let data_ptr = self.data.as_ptr();
        for (i, out_sample) in out.iter_mut().enumerate().take(to_read) {
            let pos = ((read_pos as usize) + i) % (self.capacity as usize);
            *out_sample = unsafe { *data_ptr.add(pos) };
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
        let _guard = self.lock.lock();
        self.read_pos.store(0, Ordering::Release);
        self.write_pos.store(0, Ordering::Release);
    }

    pub fn len(&self) -> usize {
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);

        if write_pos >= read_pos {
            (write_pos - read_pos) as usize
        } else {
            (self.capacity - read_pos + write_pos) as usize
        }
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

/// Playback state shared between audio thread and main thread
#[derive(Clone)]
pub struct PlaybackState {
    pub position_samples: Arc<AtomicU64>,
    pub duration_samples: Arc<AtomicU64>,
    pub sample_rate: Arc<AtomicU64>,
    pub is_playing: Arc<AtomicBool>,
    pub volume: Arc<AtomicU64>,
    pub current_path: Arc<RwLock<Option<String>>>,
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

pub struct AudioManager {
    pub state: PlaybackState,
    command_tx: std::sync::mpsc::Sender<DecoderCommand>,
}

unsafe impl Send for AudioManager {}
unsafe impl Sync for AudioManager {}

impl Default for AudioManager {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioManager {
    pub fn new() -> Self {
        let state = PlaybackState::new();
        let (command_tx, command_rx) = std::sync::mpsc::channel();

        let audio_buffer = Arc::new(AudioBuffer::new(BUFFER_SIZE));
        let state_decoder = state.clone();
        let state_output = state.clone();
        let buffer_decoder = audio_buffer.clone();
        let buffer_output = audio_buffer.clone();

        let next_track: Arc<RwLock<Option<String>>> = Arc::new(RwLock::new(None));
        let next_track_decoder = next_track.clone();

        // Decoder thread
        thread::spawn(move || {
            decoder_thread(
                command_rx,
                buffer_decoder,
                state_decoder,
                next_track_decoder,
            );
        });

        // Audio output thread
        thread::spawn(move || {
            run_audio_output(buffer_output, state_output);
        });

        Self { state, command_tx }
    }

    pub fn play(&self, path: String) {
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

    pub fn queue_next(&self, path: String) {
        let _ = self.command_tx.send(DecoderCommand::QueueNext(path));
    }

    pub fn is_playing(&self) -> bool {
        self.state.is_playing.load(Ordering::Relaxed)
    }
}

fn run_audio_output(buffer: Arc<AudioBuffer>, state: PlaybackState) {
    let host = cpal::default_host();
    let device = host.default_output_device().expect("No output device");

    let config = StreamConfig {
        channels: 2,
        sample_rate: SampleRate(44100),
        buffer_size: cpal::BufferSize::Default,
    };

    let stream = device
        .build_output_stream(
            &config,
            move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                let is_playing = state.is_playing.load(Ordering::Relaxed);
                let volume = state.get_volume();

                if !is_playing {
                    for sample in data.iter_mut() {
                        *sample = 0.0;
                    }
                    return;
                }

                let read = buffer.pop_samples(data);

                for sample in data[..read].iter_mut() {
                    *sample *= volume;
                }
                for sample in data[read..].iter_mut() {
                    *sample = 0.0;
                }

                if read > 0 {
                    state
                        .position_samples
                        .fetch_add((read / 2) as u64, Ordering::Relaxed);
                }
            },
            |err| eprintln!("Audio error: {}", err),
            None,
        )
        .expect("Failed to build output stream");

    stream.play().expect("Failed to start stream");

    // Keep thread alive
    loop {
        thread::sleep(Duration::from_secs(1));
    }
}

fn decoder_thread(
    command_rx: std::sync::mpsc::Receiver<DecoderCommand>,
    buffer: Arc<AudioBuffer>,
    state: PlaybackState,
    next_track: Arc<RwLock<Option<String>>>,
) {
    let mut current_decoder: Option<DecoderState> = None;
    let mut sample_buf: Option<SampleBuffer<f32>> = None;

    loop {
        let command = if current_decoder.is_some() && state.is_playing.load(Ordering::Relaxed) {
            command_rx.try_recv().ok()
        } else {
            command_rx.recv().ok()
        };

        if let Some(cmd) = command {
            match cmd {
                DecoderCommand::Load(path) => match load_track(&path) {
                    Ok((reader, decoder, track_id, duration_samples, sample_rate)) => {
                        buffer.clear();
                        state.position_samples.store(0, Ordering::Relaxed);
                        state
                            .duration_samples
                            .store(duration_samples, Ordering::Relaxed);
                        state
                            .sample_rate
                            .store(sample_rate as u64, Ordering::Relaxed);
                        state.is_playing.store(true, Ordering::Relaxed);
                        current_decoder = Some((reader, decoder, track_id));
                        sample_buf = None;
                        println!("Backend: Loaded {}", path);
                    }
                    Err(e) => eprintln!("Backend: Load failed: {}", e),
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
                            buffer.clear();
                            state
                                .position_samples
                                .store((seconds * sample_rate as f64) as u64, Ordering::Relaxed);
                            println!("Backend: Seeked to {:.2}s", seconds);
                        }
                    }
                }
                DecoderCommand::Stop => {
                    state.is_playing.store(false, Ordering::Relaxed);
                    state.position_samples.store(0, Ordering::Relaxed);
                    buffer.clear();
                    current_decoder = None;
                }
                DecoderCommand::QueueNext(path) => {
                    *next_track.write() = Some(path);
                }
            }
        }

        if let Some((ref mut reader, ref mut decoder, track_id)) = current_decoder {
            if !state.is_playing.load(Ordering::Relaxed) {
                thread::sleep(Duration::from_millis(10));
                continue;
            }

            if buffer.available_space() < 1024 {
                thread::sleep(Duration::from_micros(500));
                continue;
            }

            match reader.next_packet() {
                Ok(packet) => {
                    if packet.track_id() != track_id {
                        continue;
                    }

                    if let Ok(decoded) = decoder.decode(&packet) {
                        let spec = *decoded.spec();
                        let duration = decoded.capacity() as u64;

                        if sample_buf.is_none()
                            || sample_buf.as_ref().unwrap().capacity() < duration as usize
                        {
                            sample_buf = Some(SampleBuffer::new(duration, spec));
                        }

                        if let Some(ref mut buf) = sample_buf {
                            buf.copy_interleaved_ref(decoded);
                            let samples = buf.samples();

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
                }
                Err(symphonia::core::errors::Error::IoError(ref e))
                    if e.kind() == std::io::ErrorKind::UnexpectedEof =>
                {
                    let next = next_track.write().take();
                    if let Some(next_path) = next {
                        *state.current_path.write() = Some(next_path.clone());
                        if let Ok((r, d, tid, dur, sr)) = load_track(&next_path) {
                            state.position_samples.store(0, Ordering::Relaxed);
                            state.duration_samples.store(dur, Ordering::Relaxed);
                            state.sample_rate.store(sr as u64, Ordering::Relaxed);
                            current_decoder = Some((r, d, tid));
                            sample_buf = None;
                        } else {
                            state.is_playing.store(false, Ordering::Relaxed);
                            current_decoder = None;
                        }
                    } else {
                        state.is_playing.store(false, Ordering::Relaxed);
                        current_decoder = None;
                    }
                }
                Err(_) => {}
            }
        } else {
            thread::sleep(Duration::from_millis(10));
        }
    }
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
