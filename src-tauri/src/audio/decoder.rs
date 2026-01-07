use std::collections::VecDeque;

use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use parking_lot::RwLock;
use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::formats::{FormatOptions, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use symphonia::core::units::Time;
use tauri::{AppHandle, Emitter};

use super::buffer::AudioBuffer;
use super::manager::BUFFER_SIZE;
use super::types::{
    AudioContext, AudioError, CrossfadeState, DecoderCommand, DecoderState, LoadTrackResult,
    PlaybackState,
};
use crate::queue::{PlayQueue, RepeatMode};

const DEBUG_CROSSFADE: bool = false;

macro_rules! debug_cf {
    ($($arg:tt)*) => {
        if DEBUG_CROSSFADE {
            eprintln!("[CROSSFADE] {}", format!($($arg)*));
        }
    };
}

pub fn decoder_thread(
    command_rx: std::sync::mpsc::Receiver<DecoderCommand>,
    context: AudioContext,
) {
    let AudioContext {
        buffer_a,
        buffer_b,
        state,
        queue,
        crossfade_duration_ms: crossfade_ms,
        crossfade_active,
        app_handle,
        shutdown,
        ..
    } = context;
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
        if shutdown.load(Ordering::Relaxed) {
            break;
        }

        let command = if current_decoder.is_some() && state.is_playing.load(Ordering::Relaxed) {
            command_rx.try_recv().ok()
        } else {
            command_rx.recv_timeout(Duration::from_millis(100)).ok()
        };

        if let Some(cmd) = command {
            match cmd {
                DecoderCommand::Load(path) => {
                    let source_res = resolve_source(&path).map_err(|e| e.to_string());
                    match source_res.and_then(load_track) {
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
                    }
                }
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
                DecoderCommand::QueueNext(_) => {}
            }
        }

        if let Some((ref mut reader, ref mut decoder, track_id)) = current_decoder {
            if !state.is_playing.load(Ordering::Relaxed) {
                thread::sleep(Duration::from_millis(10));
                continue;
            }

            let cf_duration_ms = crossfade_ms.load(Ordering::Relaxed) as u64;
            let sample_rate = state.sample_rate.load(Ordering::Relaxed);
            let cf_duration_samples = (cf_duration_ms * sample_rate) / 1000;
            let position = state.position_samples.load(Ordering::Relaxed);
            let duration = state.duration_samples.load(Ordering::Relaxed);

            let should_prebuffer = cf_duration_ms > 0
                && duration > cf_duration_samples
                && position >= duration.saturating_sub(cf_duration_samples)
                && crossfade_state == CrossfadeState::Idle
                && next_decoder.is_none();

            if should_prebuffer {
                let next_track_opt = {
                    let q = queue.read();
                    q.peek_next_track()
                };

                if let Some(track) = next_track_opt {
                    let source_res = resolve_source(&track.path).map_err(|e| e.to_string());
                    if let Ok(source) = source_res {
                        if let Ok((r, d, tid, _dur, sr)) = load_track(source) {
                            next_decoder = Some((r, d, tid));
                            next_track_info = Some(track);
                            next_sample_buf = None;
                            next_input_accumulator.clear();
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
                                    next_resampler = Some(r);
                                    next_resampler_input_buffer = vec![vec![0.0; 1024]; 2];
                                } else {
                                    next_resampler = None;
                                }
                            } else {
                                next_resampler = None;
                            }

                            crossfade_state = CrossfadeState::Prebuffering;
                            debug_cf!(
                                "DECODER: Started prebuffering next track: {:?}",
                                next_track_info.as_ref().map(|t| &t.path)
                            );
                        }
                    }
                }
            }

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

            if matches!(
                crossfade_state,
                CrossfadeState::Prebuffering | CrossfadeState::Crossfading { .. }
            ) {
                if let Some((ref mut next_reader, ref mut next_dec, next_tid)) = next_decoder {
                    if buffer_b.available_space() >= 4096 {
                        if let Ok(packet) = next_reader.next_packet() {
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
                    }
                }
            }

            if buffer_a.available_space() < 4096 {
                thread::sleep(Duration::from_micros(500));
            }
        } else {
            thread::sleep(Duration::from_millis(10));
        }
    }
}

#[allow(clippy::needless_range_loop)]
fn push_samples_to_buffer(
    samples: &[f32],
    buffer: &Arc<AudioBuffer>,
    resampler: &mut Option<SincFixedIn<f32>>,
    resampler_input_buffer: &mut [Vec<f32>],
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

    let repeat_mode = queue.read().repeat;
    if repeat_mode == RepeatMode::One && current_decoder.is_some() {
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
    }

    if next_decoder.is_some() {
        debug_cf!("HANDLE_TRACK_END: Crossfade complete, promoting next decoder");
        debug_cf!(
            "  buffer_a space={} buffer_b space={}",
            buffer_a.available_space(),
            buffer_b.available_space()
        );
        debug_cf!(
            "  next_input_accumulator has {} samples",
            next_input_accumulator.len()
        );

        if !next_input_accumulator.is_empty() {
            let remaining: Vec<f32> = next_input_accumulator.drain(..).collect();
            debug_cf!(
                "  Flushing {} samples from accumulator to buffer_b",
                remaining.len()
            );
            let mut written = 0;
            while written < remaining.len() {
                let w = buffer_b.push_samples(&remaining[written..]);
                if w == 0 {
                    break;
                }
                written += w;
            }
        }

        *current_decoder = next_decoder.take();
        *sample_buf = next_sample_buf.take();
        *resampler = next_resampler.take();
        std::mem::swap(resampler_input_buffer, next_resampler_input_buffer);

        input_accumulator.clear();
        next_input_accumulator.clear();

        if let Some(track) = next_track_info.take() {
            debug_cf!("  New track: {:?}", track.path);
            *state.current_path.write() = Some(track.path.clone());
            let _ = app_handle.emit("track-changed", track.clone());

            {
                let mut q = queue.write();
                q.get_next_track(false);
            }

            if let Some((ref reader, _, _)) = current_decoder {
                if let Some(audio_track) = reader
                    .tracks()
                    .iter()
                    .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
                {
                    let sample_rate = audio_track.codec_params.sample_rate.unwrap_or(44100) as u64;
                    let cf_ms = crossfade_ms.load(Ordering::Relaxed);
                    let cf_samples = (cf_ms as u64 * sample_rate) / 1000;

                    debug_cf!(
                        "  Setting position to {} samples ({}ms into song)",
                        cf_samples,
                        cf_ms
                    );
                    state.position_samples.store(cf_samples, Ordering::Relaxed);
                    state.duration_samples.store(
                        audio_track.codec_params.n_frames.unwrap_or(0),
                        Ordering::Relaxed,
                    );
                    state.sample_rate.store(sample_rate, Ordering::Relaxed);
                }
            }
        }

        *crossfade_state = CrossfadeState::Idle;

        debug_cf!("  Clearing buffer_a and setting crossfade_active=false");
        buffer_a.clear();
        std::sync::atomic::fence(Ordering::SeqCst);
        crossfade_active.store(false, Ordering::Release);
        debug_cf!(
            "  After clear: buffer_a space={} buffer_b space={}",
            buffer_a.available_space(),
            buffer_b.available_space()
        );
        return;
    }

    let next_track_opt = {
        let mut q = queue.write();
        q.get_next_track(false)
    };

    if let Some(track) = next_track_opt {
        let next_path = track.path.clone();
        *state.current_path.write() = Some(next_path.clone());
        let _ = app_handle.emit("track-changed", track);

        let source_res = resolve_source(&next_path).map_err(|e| e.to_string());
        if let Ok(source) = source_res {
            if let Ok((r, d, tid, dur, sr)) = load_track(source) {
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
    } else {
        state.is_playing.store(false, Ordering::Relaxed);
        *current_decoder = None;
    }

    *crossfade_state = CrossfadeState::Idle;
    crossfade_active.store(false, Ordering::Relaxed);
}

use super::source::{file::FileSource, http::HttpSource, prefetch::PrefetchSource, MediaSource};

fn resolve_source(uri: &str) -> std::io::Result<Box<dyn MediaSource>> {
    if uri.starts_with("http://") || uri.starts_with("https://") {
        let http = HttpSource::new(uri)?;
        Ok(Box::new(PrefetchSource::new(Box::new(http))))
    } else {
        Ok(Box::new(FileSource::new(uri)?))
    }
}

pub fn load_track(source: Box<dyn MediaSource>) -> LoadTrackResult {
    let mss = MediaSourceStream::new(source, Default::default());

    let hint = Hint::new();
    // Hint based on content type or extension from metadata could go here
    // For now we rely on Symphonia probing

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
