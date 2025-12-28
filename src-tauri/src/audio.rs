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
use tauri::{AppHandle, Emitter};

const BUFFER_SIZE: usize = 65536;

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

use crate::dsp::DspChain;
use crate::queue::PlayQueue;

pub struct AudioManager {
    pub state: PlaybackState,
    pub queue: Arc<RwLock<PlayQueue>>,
    pub dsp: Arc<RwLock<DspChain>>,
    command_tx: std::sync::mpsc::Sender<DecoderCommand>,
}

unsafe impl Send for AudioManager {}
unsafe impl Sync for AudioManager {}

impl AudioManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let state = PlaybackState::new();
        let (command_tx, command_rx) = std::sync::mpsc::channel();

        let audio_buffer = Arc::new(AudioBuffer::new(BUFFER_SIZE));

        let queue = Arc::new(RwLock::new(PlayQueue::new()));
        let dsp = Arc::new(RwLock::new(DspChain::new()));

        let state_decoder = state.clone();
        let state_output = state.clone();
        let buffer_decoder = audio_buffer.clone();
        let buffer_output = audio_buffer.clone();

        // Clone for threads
        let queue_decoder = queue.clone();
        let dsp_output = dsp.clone();

        thread::spawn(move || {
            decoder_thread(
                command_rx,
                buffer_decoder,
                state_decoder,
                queue_decoder,
                app_handle,
            );
        });

        thread::spawn(move || {
            run_audio_output(buffer_output, state_output, dsp_output);
        });

        Self {
            state,
            command_tx,
            queue,
            dsp,
        }
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
}

fn run_audio_output(buffer: Arc<AudioBuffer>, state: PlaybackState, dsp: Arc<RwLock<DspChain>>) {
    let host = cpal::default_host();
    loop {
        let device = match host.default_output_device() {
            Some(d) => d,
            None => {
                thread::sleep(Duration::from_secs(1));
                continue;
            }
        };

        let config = match device.default_output_config() {
            Ok(c) => c,
            Err(_) => {
                thread::sleep(Duration::from_secs(1));
                continue;
            }
        };

        let sample_rate = config.sample_rate().0;
        state
            .device_sample_rate
            .store(sample_rate, Ordering::Relaxed);

        let err_fn = |err| eprintln!("Audio output error: {}", err);
        let stream_result = match config.sample_format() {
            cpal::SampleFormat::F32 => run_stream::<f32>(
                &device,
                &config.into(),
                buffer.clone(),
                state.clone(),
                dsp.clone(),
                err_fn,
            ),
            cpal::SampleFormat::I16 => run_stream::<i16>(
                &device,
                &config.into(),
                buffer.clone(),
                state.clone(),
                dsp.clone(),
                err_fn,
            ),
            cpal::SampleFormat::U16 => run_stream::<u16>(
                &device,
                &config.into(),
                buffer.clone(),
                state.clone(),
                dsp.clone(),
                err_fn,
            ),
            _ => Err(cpal::BuildStreamError::StreamConfigNotSupported),
        };

        if let Ok(stream) = stream_result {
            if stream.play().is_ok() {
                loop {
                    thread::sleep(Duration::from_secs(1));
                }
            }
        }
        thread::sleep(Duration::from_secs(1));
    }
}

fn run_stream<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    buffer: Arc<AudioBuffer>,
    state: PlaybackState,
    dsp: Arc<RwLock<DspChain>>,
    err_fn: impl Fn(cpal::StreamError) + Send + 'static,
) -> Result<cpal::Stream, cpal::BuildStreamError>
where
    T: cpal::Sample + cpal::SizedSample + cpal::FromSample<f32>,
{
    let channels = config.channels as usize;
    let sample_rate = config.sample_rate.0;

    device.build_output_stream(
        config,
        move |data: &mut [T], _: &cpal::OutputCallbackInfo| {
            let is_playing = state.is_playing.load(Ordering::Relaxed);
            let volume = state.get_volume();

            if !is_playing {
                data.fill(T::from_sample(0.0));
                return;
            }

            // Create a temporary buffer for f32 samples
            let mut temp_buf = vec![0.0; data.len()];
            let read_samples = buffer.pop_samples(&mut temp_buf);

            // Apply DSP processing
            if read_samples > 0 {
                let mut dsp_lock = dsp.write();
                dsp_lock.process(&mut temp_buf[0..read_samples], channels, sample_rate);
            }

            for (i, sample) in data.iter_mut().enumerate() {
                if i < read_samples {
                    *sample = T::from_sample(temp_buf[i] * volume);
                } else {
                    *sample = T::from_sample(0.0);
                }
            }

            if read_samples > 0 {
                let dev_rate = state.device_sample_rate.load(Ordering::Relaxed) as f64;
                let src_rate = state.sample_rate.load(Ordering::Relaxed) as f64;
                let ratio = if dev_rate > 0.0 {
                    src_rate / dev_rate
                } else {
                    1.0
                };
                let frames_played = read_samples / channels;
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
    buffer: Arc<AudioBuffer>,
    state: PlaybackState,
    queue: Arc<RwLock<PlayQueue>>,
    app_handle: AppHandle,
) {
    let mut current_decoder: Option<DecoderState> = None;
    let mut sample_buf: Option<SampleBuffer<f32>> = None;
    let mut resampler: Option<SincFixedIn<f32>> = None;
    let mut resampler_input_buffer: Vec<Vec<f32>> = Vec::new();
    let mut input_accumulator: VecDeque<f32> = VecDeque::new();

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
                        input_accumulator.clear();
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

                        let device_rate = state.device_sample_rate.load(Ordering::Relaxed);
                        if device_rate != 0 && device_rate != sample_rate {
                            println!("Audio: Resampling {} -> {}", sample_rate, device_rate);
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
                    Err(_) => {}
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
                            input_accumulator.clear();
                            state
                                .position_samples
                                .store((seconds * sample_rate as f64) as u64, Ordering::Relaxed);
                        }
                    }
                }
                DecoderCommand::Stop => {
                    state.is_playing.store(false, Ordering::Relaxed);
                    state.position_samples.store(0, Ordering::Relaxed);
                    buffer.clear();
                    input_accumulator.clear();
                    current_decoder = None;
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
            if buffer.available_space() < 4096 {
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

                            if let Some(ref mut r) = resampler {
                                input_accumulator.extend(samples.iter());
                                let chunk_size = r.input_frames_max();
                                let channels = 2;
                                let chunk_len = chunk_size * channels;

                                while input_accumulator.len() >= chunk_len {
                                    for c in 0..channels {
                                        for i in 0..chunk_size {
                                            resampler_input_buffer[c][i] =
                                                input_accumulator[(i * channels) + c];
                                        }
                                    }
                                    input_accumulator.drain(0..chunk_len);

                                    if let Ok(output_frames) =
                                        r.process(&resampler_input_buffer, None)
                                    {
                                        let out_len = output_frames[0].len();
                                        if out_len > 0 {
                                            let mut interleaved =
                                                Vec::with_capacity(out_len * channels);
                                            for i in 0..out_len {
                                                for c in 0..channels {
                                                    interleaved.push(output_frames[c][i]);
                                                }
                                            }
                                            let mut written = 0;
                                            while written < interleaved.len() {
                                                let w =
                                                    buffer.push_samples(&interleaved[written..]);
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
                    }
                }
                Err(symphonia::core::errors::Error::IoError(ref e))
                    if e.kind() == std::io::ErrorKind::UnexpectedEof =>
                {
                    let _ = app_handle.emit("track-ended", ());

                    let next_track_opt = {
                        let mut q = queue.write();
                        q.get_next_track(false)
                    };

                    if let Some(next_track_info) = next_track_opt {
                        let next_path = next_track_info.path.clone();
                        *state.current_path.write() = Some(next_path.clone());

                        // Emit event to tell frontend track changed
                        let _ = app_handle.emit("track-changed", next_track_info);

                        if let Ok((r, d, tid, dur, sr)) = load_track(&next_path) {
                            state.position_samples.store(0, Ordering::Relaxed);
                            state.duration_samples.store(dur, Ordering::Relaxed);
                            state.sample_rate.store(sr as u64, Ordering::Relaxed);
                            current_decoder = Some((r, d, tid));
                            sample_buf = None;
                            input_accumulator.clear();

                            let device_rate = state.device_sample_rate.load(Ordering::Relaxed);
                            if device_rate != 0 && device_rate != sr as u32 {
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
                                    resampler = Some(r);
                                    resampler_input_buffer = vec![vec![0.0; 1024]; 2];
                                } else {
                                    resampler = None;
                                }
                            } else {
                                resampler = None;
                            }
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
