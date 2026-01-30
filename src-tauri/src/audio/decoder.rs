use std::collections::VecDeque;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

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

use super::buffer::AudioBuffer;
use super::manager::BUFFER_SIZE;
use super::types::{
    AudioContext, CrossfadeState, DecoderCommand, DecoderEvent, DecoderState, LoadTrackResult,
};

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
    event_tx: std::sync::mpsc::Sender<DecoderEvent>,
    context: AudioContext,
) {
    let AudioContext {
        buffer_a,
        buffer_b,
        state,
        crossfade_duration_ms: crossfade_ms,
        crossfade_active,
        shutdown,
        url_resolver,
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
    let mut requested_next_track = false;

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
                    // Reset everything
                    buffer_a.clear();
                    buffer_b.clear();
                    input_accumulator.clear();
                    next_input_accumulator.clear();
                    crossfade_active.store(false, Ordering::Relaxed);
                    next_decoder = None;
                    sample_buf = None;
                    next_sample_buf = None;
                    crossfade_state = CrossfadeState::Idle;
                    requested_next_track = false;

                    let source_res = resolve_source(&path, &url_resolver);
                    match source_res.and_then(load_track) {
                        Ok((reader, decoder, track_id, duration_samples, sample_rate)) => {
                            state.position_samples.store(0, Ordering::Relaxed);
                            state.duration_samples.store(duration_samples, Ordering::Relaxed);
                            state.sample_rate.store(sample_rate as u64, Ordering::Relaxed);
                            current_decoder = Some((reader, decoder, track_id));

                            // Setup Resampler
                            let device_rate = state.device_sample_rate.load(Ordering::Relaxed);
                            resampler = setup_resampler(device_rate, sample_rate as u32);
                            if resampler.is_some() {
                                resampler_input_buffer = vec![vec![0.0; 1024]; 2];
                            }

                            std::sync::atomic::fence(Ordering::SeqCst);
                            state.is_playing.store(true, Ordering::Release);
                        }
                        Err(e) => {
                             let _ = event_tx.send(DecoderEvent::Error(format!("Failed to load {}: {}", path, e)));
                        }
                    }
                }
                DecoderCommand::LoadNext(path) => {
                    // Pre-load next track command
                    if next_decoder.is_none() {
                         let source_res = resolve_source(&path, &url_resolver);
                         match source_res.and_then(load_track) {
                            Ok((reader, decoder, track_id, _dur, sr)) => {
                                next_decoder = Some((reader, decoder, track_id));
                                next_input_accumulator.clear();
                                buffer_b.clear();
                                
                                let device_rate = state.device_sample_rate.load(Ordering::Relaxed);
                                next_resampler = setup_resampler(device_rate, sr as u32);
                                if next_resampler.is_some() {
                                    next_resampler_input_buffer = vec![vec![0.0; 1024]; 2];
                                }
                                
                                crossfade_state = CrossfadeState::Prebuffering;
                                debug_cf!("DECODER: Loaded next track: {}", path);
                            }
                            Err(e) => {
                                log::error!("Failed to preload next track: {}", e);
                                // Don't crash, just ignore. We will try again or fail at EOS.
                            }
                         }
                    }
                }
                DecoderCommand::Chain(path) => {
                     // Chain next track without clearing buffer
                     // Used when Auto-Advancing to prevent cutting off the tail of the previous song
                     let source_res = resolve_source(&path, &url_resolver);
                     match source_res.and_then(load_track) {
                         Ok((reader, decoder, track_id, duration_samples, sample_rate)) => {
                             // Reset accumulator logic for new stream, but KEEP buffer_a
                             input_accumulator.clear();
                             next_input_accumulator.clear();
                             // Clear "Next" state if it existed (shouldn't overlap with Chain usually)
                             next_decoder = None;
                             next_sample_buf = None;
                             crossfade_active.store(false, Ordering::Relaxed);
                             crossfade_state = CrossfadeState::Idle;
                             requested_next_track = false;
                             
                             state.position_samples.store(0, Ordering::Relaxed);
                             state.duration_samples.store(duration_samples, Ordering::Relaxed);
                             state.sample_rate.store(sample_rate as u64, Ordering::Relaxed);
                             current_decoder = Some((reader, decoder, track_id));
                             
                             // Setup Resampler
                             let device_rate = state.device_sample_rate.load(Ordering::Relaxed);
                             resampler = setup_resampler(device_rate, sample_rate as u32);
                             if resampler.is_some() {
                                 resampler_input_buffer = vec![vec![0.0; 1024]; 2];
                             }
                             
                             std::sync::atomic::fence(Ordering::SeqCst);
                             state.is_playing.store(true, Ordering::Release);
                         }
                         Err(e) => {
                             let _ = event_tx.send(DecoderEvent::Error(format!("Failed to chain {}: {}", path, e)));
                         }
                     }
                }
                DecoderCommand::Seek(seconds) => {
                    if let Some((ref mut reader, ref mut decoder, _)) = current_decoder {
                        let sample_rate = state.sample_rate.load(Ordering::Relaxed) as u32;
                        let seek_time = Time::new(seconds as u64, seconds.fract());
                        if reader.seek(SeekMode::Accurate, SeekTo::Time { time: seek_time, track_id: None }).is_ok() {
                             decoder.reset();
                             buffer_a.clear();
                             input_accumulator.clear();
                             crossfade_active.store(false, Ordering::Relaxed);
                             crossfade_state = CrossfadeState::Idle;
                             next_decoder = None; // Cancel crossfade if seeking
                             buffer_b.clear();
                             requested_next_track = false;
                             state.position_samples.store((seconds * sample_rate as f64) as u64, Ordering::Relaxed);
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
                    crossfade_state = CrossfadeState::Idle;
                    requested_next_track = false;
                }
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

            // Need Next Track Check
            let should_prebuffer = cf_duration_ms > 0
                && duration > cf_duration_samples
                && position >= duration.saturating_sub(cf_duration_samples)
                && crossfade_state == CrossfadeState::Idle
                && next_decoder.is_none()
                && !requested_next_track;

            if should_prebuffer {
                requested_next_track = true;
                let _ = event_tx.send(DecoderEvent::RequestNextTrack);
            }

            // Decode Loop
             if buffer_a.available_space() >= 4096 {
                match reader.next_packet() {
                    Ok(packet) => {
                        if packet.track_id() == track_id {
                             if let Ok(decoded) = decoder.decode(&packet) {
                                let spec = *decoded.spec();
                                let dur = decoded.capacity() as u64;
                                if sample_buf.is_none() || sample_buf.as_ref().unwrap().capacity() < dur as usize {
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
                    Err(symphonia::core::errors::Error::IoError(ref e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                        // Handle EOS / Handover
                        if next_decoder.is_some() {
                             // --- CROSSFADE HANDOVER ---
                             // Promote next_decoder to current_decoder
                             current_decoder = next_decoder.take();
                             sample_buf = next_sample_buf.take();
                             resampler = next_resampler.take();
                             std::mem::swap(&mut resampler_input_buffer, &mut next_resampler_input_buffer);
                             
                             // Flush remaining next_accumulator to buffer_b so it plays during fade
                             if !next_input_accumulator.is_empty() {
                                 let remaining: Vec<f32> = next_input_accumulator.drain(..).collect();
                                 let mut written = 0;
                                 while written < remaining.len() {
                                     let w = buffer_b.push_samples(&remaining[written..]);
                                     if w == 0 { break; }
                                     written += w;
                                 }
                             }
                             input_accumulator.clear();
                             next_input_accumulator.clear();
                             requested_next_track = false;
                             crossfade_state = CrossfadeState::Idle;
                             
                             // Clear buffer A (old song) and disable crossfade
                             buffer_a.clear();
                             std::sync::atomic::fence(Ordering::SeqCst);
                             crossfade_active.store(false, Ordering::Release);
                             
                             // Emit event that we swapped? User state/UI info needs update?
                             // Controller presumably already updated UI when it sent Preload?
                             // We should probably tell Controller we successfully swapped.
                             // But EndOfStream is usually fine.
                             
                        } else {
                            // Real EOS
                            let final_samples = state.position_samples.load(Ordering::Relaxed);
                            let final_seconds = final_samples as f64 / state.sample_rate.load(Ordering::Relaxed) as f64;
                            let duration_samples = state.duration_samples.load(Ordering::Relaxed);
                             log::info!("[Decoder] Reached EOS. Decoded up to: {:.2}s / Samples: {} (Expected: {})", final_seconds, final_samples, duration_samples);
                            
                            let _ = event_tx.send(DecoderEvent::EndOfStream);
                            // Set decoder to None so we don't hit EOS again next loop
                            current_decoder = None; 
                            // We don't nullify current_decoder immediately so we can maybe seek/replay?
                            // But usually EOS means stop.
                        }
                    }
                     Err(_) => {}
                }
             }

             // Prebuffering / Crossfading for Second decoder
             if matches!(crossfade_state, CrossfadeState::Prebuffering | CrossfadeState::Crossfading { .. }) {
                  if let Some((ref mut next_reader, ref mut next_dec, next_tid)) = next_decoder {
                       if buffer_b.available_space() >= 4096 {
                            if let Ok(packet) = next_reader.next_packet() {
                                 if packet.track_id() == next_tid {
                                      if let Ok(decoded) = next_dec.decode(&packet) {
                                           let spec = *decoded.spec();
                                            let dur = decoded.capacity() as u64;
                                            if next_sample_buf.is_none() || next_sample_buf.as_ref().unwrap().capacity() < dur as usize {
                                                next_sample_buf = Some(SampleBuffer::new(dur, spec));
                                            }
                                            if let Some(ref mut buf) = next_sample_buf {
                                                buf.copy_interleaved_ref(decoded);
                                                push_samples_to_buffer(
                                                    buf.samples(),
                                                    &buffer_b,
                                                    &mut next_resampler,
                                                    &mut next_resampler_input_buffer,
                                                    &mut next_input_accumulator,
                                                );
                                            }
                                      }
                                 }
                                 
                                 // Check if we should activate mixing
                                 if crossfade_state == CrossfadeState::Prebuffering && BUFFER_SIZE - buffer_b.available_space() >= 8192 {
                                     crossfade_state = CrossfadeState::Crossfading { progress_samples: 0, total_samples: cf_duration_samples };
                                     crossfade_active.store(true, Ordering::Relaxed);
                                     debug_cf!("DECODER: Crossfade Active");
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

fn setup_resampler(device_rate: u32, source_rate: u32) -> Option<SincFixedIn<f32>> {
    if device_rate != 0 && device_rate != source_rate {
        let params = SincInterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            interpolation: SincInterpolationType::Linear,
            window: WindowFunction::BlackmanHarris2,
            oversampling_factor: 128,
        };
        SincFixedIn::<f32>::new(
            device_rate as f64 / source_rate as f64,
            2.0,
            params,
            1024,
            2,
        ).ok()
    } else {
        None
    }
}

// Keep push_samples_to_buffer and resolve_source...
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

use super::resolver::UrlResolver;
use super::source::{file::FileSource, http::HttpSource, prefetch::PrefetchSource, MediaSource};

fn resolve_source(uri: &str, resolver: &UrlResolver) -> Result<Box<dyn MediaSource>, String> {
    let resolved = resolver.resolve(uri)?;

    if resolved.path.starts_with("http://") || resolved.path.starts_with("https://") {
        let http = HttpSource::new(&resolved.path).map_err(|e| e.to_string())?;
        Ok(Box::new(PrefetchSource::new(Box::new(http))))
    } else {
        Ok(Box::new(
            FileSource::new(&resolved.path).map_err(|e| e.to_string())?,
        ))
    }
}

pub fn load_track(source: Box<dyn MediaSource>) -> LoadTrackResult {
    let mss = MediaSourceStream::new(source, Default::default());

    let hint = Hint::new();

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

