use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::Emitter;

use super::manager::BUFFER_SIZE;
use super::types::{AudioContext, AudioError, DeviceChanged};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

const DEBUG_CROSSFADE: bool = false;

macro_rules! debug_cf {
    ($($arg:tt)*) => {
        if DEBUG_CROSSFADE {
            eprintln!("[CROSSFADE] {}", format!($($arg)*));
        }
    };
}

pub fn run_audio_output(context: AudioContext) {
    let host = cpal::default_host();
    let mut current_device_name: Option<String> = None;
    let mut no_device_notified = false;

    loop {
        // Check for shutdown signal
        if context.shutdown.load(Ordering::Relaxed) {
            break;
        }

        let device = match host.default_output_device() {
            Some(d) => {
                no_device_notified = false;
                d
            }
            None => {
                if !no_device_notified {
                    let _ = context.app_handle.emit(
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
                let _ = context.app_handle.emit(
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
                let _ = context.app_handle.emit(
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
        context
            .state
            .device_sample_rate
            .store(sample_rate, Ordering::Relaxed);

        let app_handle_err = context.app_handle.clone();
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
            cpal::SampleFormat::F32 => {
                run_stream::<f32>(&device, &config.into(), context.clone(), err_fn)
            }
            cpal::SampleFormat::I16 => {
                run_stream::<i16>(&device, &config.into(), context.clone(), err_fn)
            }
            cpal::SampleFormat::U16 => {
                run_stream::<u16>(&device, &config.into(), context.clone(), err_fn)
            }
            _ => Err(cpal::BuildStreamError::StreamConfigNotSupported),
        };

        if let Ok(stream) = stream_result {
            if stream.play().is_ok() {
                // Monitor for device changes or shutdown
                loop {
                    if context.shutdown.load(Ordering::Relaxed) {
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
            let _ = context.app_handle.emit(
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

pub fn run_stream<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    context: AudioContext,
    err_fn: impl Fn(cpal::StreamError) + Send + 'static,
) -> Result<cpal::Stream, cpal::BuildStreamError>
where
    T: cpal::Sample + cpal::SizedSample + cpal::FromSample<f32>,
{
    let AudioContext {
        buffer_a,
        buffer_b,
        state,
        dsp,
        crossfade_duration_ms: crossfade_ms,
        crossfade_active,
        ..
    } = context;

    let channels = config.channels as usize;
    let sample_rate = config.sample_rate.0;

    let crossfade_progress = Arc::new(AtomicU64::new(0));

    let draining_buffer_b = Arc::new(AtomicBool::new(false));
    let draining_buffer_b_clone = draining_buffer_b.clone();

    let debug_state = Arc::new(AtomicU32::new(0)); // 0=normal, 1=crossfade, 2=crossfade_complete, 3=draining, 4=drain_end
    let debug_callback_count = Arc::new(AtomicU64::new(0));

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

            let is_crossfading = crossfade_active.load(Ordering::Acquire);
            let is_draining = draining_buffer_b_clone.load(Ordering::Acquire);

            let cf_duration_samples = {
                let ms = crossfade_ms.load(Ordering::Relaxed) as u64;
                (ms * sample_rate as u64) / 1000
            };

            let samples_in_b_before_pop = BUFFER_SIZE - buffer_b.available_space();
            let need_micro_fade = is_draining && !is_crossfading &&
                samples_in_b_before_pop > 0 &&
                samples_in_b_before_pop <= MICRO_FADE_SAMPLES + data.len(); // Start micro-fade early enough

            if need_micro_fade && !micro_fade_active_clone.load(Ordering::Relaxed) {
                micro_fade_active_clone.store(true, Ordering::Release);
                micro_fade_progress_clone.store(0, Ordering::Relaxed);
                debug_cf!("cb#{} MICRO_FADE START | samples_in_b={}", callback_num, samples_in_b_before_pop);
            }

            let mut temp_buf_a = vec![0.0; data.len()];
            let mut temp_buf_b = vec![0.0; data.len()];
            let mut read_a = 0;
            let mut read_b = 0;

            let is_micro_fading = micro_fade_active_clone.load(Ordering::Relaxed);

            if is_crossfading {
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
                if prev_state != new_state || callback_num.is_multiple_of(50) {
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

                if prev_state != 3 || callback_num.is_multiple_of(50) {
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
