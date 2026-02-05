use parking_lot::RwLock;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::thread;
use tauri::AppHandle;

use crate::dsp::DspChain;
use crate::media_controls::MediaControlsManager;
use crate::queue::PlayQueue;

use super::buffer::AudioBuffer;
use super::decoder::decoder_thread;
use super::output::run_audio_output;
use super::resolver::UrlResolver;
use super::types::{
    AudioContext, DecoderCommand, DecoderEvent, PlaybackState, DEFAULT_CROSSFADE_MS,
};

pub const BUFFER_SIZE: usize = 65536;

pub struct AudioManager {
    pub state: PlaybackState,
    pub queue: Arc<RwLock<PlayQueue>>,
    pub dsp: Arc<RwLock<DspChain>>,
    pub media_controls: Arc<MediaControlsManager>,
    pub crossfade_duration_ms: Arc<AtomicU32>,
    pub crossfade_active: Arc<AtomicBool>,
    buffer_a: Arc<AudioBuffer>,
    buffer_b: Arc<AudioBuffer>,
    command_tx: std::sync::mpsc::Sender<DecoderCommand>,
    _event_rx: Option<std::sync::mpsc::Receiver<DecoderEvent>>, // Receiver for controller loop
    shutdown: Arc<AtomicBool>,
}

unsafe impl Send for AudioManager {}
unsafe impl Sync for AudioManager {}

impl AudioManager {
    pub fn new(
        app_handle: AppHandle,
        discord_rpc: Option<Arc<crate::discord::DiscordRpcManager>>,
    ) -> Self {
        let state = PlaybackState::new();
        let (command_tx, command_rx) = std::sync::mpsc::channel();
        let (event_tx, event_rx) = std::sync::mpsc::channel();
        let shutdown = Arc::new(AtomicBool::new(false));

        let buffer_a = Arc::new(AudioBuffer::new(BUFFER_SIZE));
        let buffer_b = Arc::new(AudioBuffer::new(BUFFER_SIZE));

        let queue = Arc::new(RwLock::new(PlayQueue::new()));
        let dsp = Arc::new(RwLock::new(DspChain::new()));
        let media_controls = Arc::new(MediaControlsManager::new());
        let crossfade_duration_ms = Arc::new(AtomicU32::new(DEFAULT_CROSSFADE_MS));
        let crossfade_active = Arc::new(AtomicBool::new(false));
        let url_resolver = UrlResolver::new(app_handle.clone());

        let context = AudioContext {
            buffer_a: buffer_a.clone(),
            buffer_b: buffer_b.clone(),
            state: state.clone(),
            queue: queue.clone(),
            dsp: dsp.clone(),
            media_controls: media_controls.clone(),
            crossfade_duration_ms: crossfade_duration_ms.clone(),
            crossfade_active: crossfade_active.clone(),
            app_handle: app_handle.clone(),
            shutdown: shutdown.clone(),
            url_resolver: url_resolver.clone(),
            discord_rpc: discord_rpc.clone(),
            playback_notifier: None, // Will be set later via app state
        };

        // Context for Decoder
        let context_decoder = context.clone();
        // Context for Output
        let context_output = context.clone();

        // Spawn Controller Loop (The "Brain")
        let controller_state = state.clone();
        let controller_queue = queue.clone();
        let controller_app = app_handle.clone();
        let controller_cmd_tx = command_tx.clone();
        let controller_shutdown = shutdown.clone();
        let controller_discord = discord_rpc.clone();
        let controller_resolver = url_resolver.clone();
        let controller_media = media_controls.clone();
        let controller_buffer = buffer_a.clone();

        thread::spawn(move || {
            crate::audio::manager::audio_controller_loop(
                event_rx,
                controller_state,
                controller_queue,
                controller_app,
                controller_cmd_tx,
                controller_shutdown,
                controller_discord,
                controller_resolver,
                controller_media,
                controller_buffer,
            );
        });

        // Spawn Decoder Thread (The "Worker")
        // Note: we pass event_tx to the decoder now
        let decoder_event_tx = event_tx;
        thread::spawn(move || {
            decoder_thread(command_rx, decoder_event_tx, context_decoder);
        });

        thread::spawn(move || {
            run_audio_output(context_output);
        });

        Self {
            state,
            command_tx,
            _event_rx: None, // Taken by controller thread
            queue,
            dsp,
            media_controls,
            crossfade_duration_ms,
            crossfade_active,
            buffer_a,
            buffer_b,
            shutdown,
        }
    }

    pub fn shutdown(&self) {
        self.shutdown.store(true, Ordering::Relaxed);
    }

    pub fn play(&self, path: String) {
        self.state.is_playing.store(false, Ordering::SeqCst);

        std::sync::atomic::fence(Ordering::SeqCst);

        self.buffer_a.clear();
        self.buffer_b.clear();

        self.state.position_samples.store(0, Ordering::Relaxed);

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

// Controller Loop implementation
#[allow(clippy::too_many_arguments)]
pub fn audio_controller_loop(
    event_rx: std::sync::mpsc::Receiver<super::types::DecoderEvent>,
    state: PlaybackState,
    queue: Arc<RwLock<PlayQueue>>,
    app: AppHandle,
    command_tx: std::sync::mpsc::Sender<DecoderCommand>,
    shutdown: Arc<AtomicBool>,
    discord_rpc: Option<Arc<crate::discord::DiscordRpcManager>>,
    url_resolver: UrlResolver,
    media_controls: Arc<MediaControlsManager>,
    buffer_monitor: Arc<AudioBuffer>, // Added buffer for monitoring drain
) {
    use super::types::DecoderEvent;
    use tauri::Emitter;

    log::info!("[AudioController] Started");

    let mut is_draining = false;

    loop {
        if shutdown.load(Ordering::Relaxed) {
            break;
        }

        // Check if we are draining the buffer (Queue Finished)
        if is_draining {
            // Check if buffer is empty (or close to it)
            // Available space in buffer_a. If close to BUFFER_SIZE, it's empty.
            let available = buffer_monitor.available_space();
            let occupied = super::manager::BUFFER_SIZE.saturating_sub(available);

            // Threshold: if less than ~0.1s of audio left (4410 frames approx)
            if occupied < 4096 {
                log::info!("[AudioController] Buffer drained. Top-level Stop.");
                state.is_playing.store(false, Ordering::Relaxed);
                state.position_samples.store(0, Ordering::Relaxed);
                media_controls.set_playback(false, Some(0.0));
                is_draining = false;
            }
        }

        match event_rx.recv_timeout(std::time::Duration::from_millis(200)) {
            Ok(event) => match event {
                DecoderEvent::Error(e) => {
                    log::error!("[AudioController] Decoder Error: {}", e);
                    let _ = app.emit(
                        "audio-error",
                        super::types::AudioError {
                            code: "DECODE_ERROR".to_string(),
                            title: "Playback Error".to_string(),
                            message: e,
                        },
                    );
                    state.is_playing.store(false, Ordering::Relaxed);
                }
                DecoderEvent::RequestNextTrack => {
                    // Peek next track without advancing queue yet
                    let next_track_opt = {
                        let q = queue.read();
                        q.peek_next_track()
                    };

                    if let Some(track) = next_track_opt {
                        log::info!("[AudioController] Pre-loading next track: {}", track.title);
                        // Spawn background thread to load
                        let tx = command_tx.clone();
                        let resolver = url_resolver.clone();
                        let path = track.path.clone();

                        std::thread::spawn(move || {
                            let source_res = super::loader::resolve_source(&path, &resolver);
                            match source_res.and_then(super::loader::load_track) {
                                Ok((reader, decoder, loaded_track_id, dur, sr)) => {
                                    // Send ready decoder
                                    let _ = tx.send(DecoderCommand::PreloadedDecoder(
                                        reader,
                                        decoder,
                                        loaded_track_id,
                                        dur,
                                        sr,
                                    ));
                                    log::info!("[AudioController] Pre-load ready for: {}", path);
                                }
                                Err(e) => {
                                    log::error!("[AudioController] Failed to preload next track resolution: {}", e);
                                }
                            }
                        });
                    }
                }
                DecoderEvent::CrossfadeHandover => {
                    log::info!("[AudioController] Crossfade Handover Complete");
                    let _ = app.emit("track-ended", ());

                    // Advance queue silently (we are already playing the next track)
                    let next_track_opt = {
                        let mut q = queue.write();
                        q.get_next_track(false)
                    };

                    if let Some(track) = next_track_opt {
                        log::info!(
                            "[AudioController] Crossfade Handover -> Now Playing: {} (ID: {})",
                            track.title,
                            track.id
                        );

                        // Update State (Path)
                        if let Ok(resolved) =
                            tokio::runtime::Runtime::new().unwrap().block_on(async {
                                crate::audio::resolver::resolve_uri(&app, &track.path).await
                            })
                        {
                            *state.current_path.write() = Some(resolved.path.clone());
                            let _ = app.emit("playback-quality-changed", resolved);
                        }

                        let _ = app.emit("track-changed", track.clone());

                        if let Some(ref rpc) = discord_rpc {
                            rpc.set_playing(
                                crate::discord::TrackInfo {
                                    title: track.title.clone(),
                                    artist: track.artist.clone(),
                                    album: track.album.clone(),
                                    duration_secs: track.duration,
                                    cover_url: track.cover_image.clone(),
                                },
                                0,
                            );
                        }

                        media_controls.set_metadata(
                            &track.title,
                            &track.artist,
                            &track.album,
                            track.cover_image.as_deref(),
                            track.duration as f64,
                        );
                    }
                }
                DecoderEvent::EndOfStream => {
                    log::info!("[AudioController] End of Stream received");
                    let _ = app.emit("track-ended", ());

                    // Logic to handle next track - Now we actually advance the queue
                    let next_track_opt = {
                        let mut q = queue.write();
                        q.get_next_track(false)
                    };

                    if let Some(track) = next_track_opt {
                        log::info!(
                            "[AudioController] Auto-advancing to: {} (ID: {}, Path: {})",
                            track.title,
                            track.id,
                            track.path
                        );
                        // Resolve URI and Play
                        let app_handle_clone = app.clone();
                        let rt = tokio::runtime::Runtime::new().unwrap();
                        let path = track.path.clone();
                        let track_clone = track.clone();

                        let resolved_res = rt.block_on(async {
                            crate::audio::resolver::resolve_uri(&app_handle_clone, &path).await
                        });

                        match resolved_res {
                            Ok(resolved) => {
                                // Update State
                                *state.current_path.write() = Some(resolved.path.clone());
                                let _ = app.emit("track-changed", track_clone.clone());
                                let _ = app.emit("playback-quality-changed", resolved.clone());

                                if let Some(ref rpc) = discord_rpc {
                                    rpc.set_playing(
                                        crate::discord::TrackInfo {
                                            title: track_clone.title.clone(),
                                            artist: track_clone.artist.clone(),
                                            album: track_clone.album.clone(),
                                            duration_secs: track_clone.duration,
                                            cover_url: track_clone.cover_image.clone(),
                                        },
                                        0,
                                    );
                                }

                                media_controls.set_metadata(
                                    &track_clone.title,
                                    &track_clone.artist,
                                    &track_clone.album,
                                    track_clone.cover_image.as_deref(),
                                    track_clone.duration as f64,
                                );

                                // Send Load Command if not already preloaded?
                                // Actually, if we hit EOS, it means simple switch or crossfade finished?
                                // If Crossfade finished, decoder takes care of swapping internally mostly?
                                // Wait, the decoder logic I wrote for EOS handles the swap if `next_decoder` exists.
                                // If `next_decoder` exists (was preloaded), `decoder.rs` swaps and continues.
                                // It does NOT emit EndOfStream in that case.
                                // So this EndOfStream event ONLY fires if we ran out of music without preloading.
                                // In that case, we should normally Load().

                                let _ = command_tx.send(DecoderCommand::Chain(resolved.path));
                                state.is_playing.store(true, Ordering::Relaxed);
                                is_draining = false;
                            }
                            Err(e) => {
                                log::error!(
                                    "[AudioController] Failed to resolve next track: {}",
                                    e
                                );
                            }
                        }
                    } else {
                        log::info!("[AudioController] Queue ended. Waiting for buffer drain...");
                        is_draining = true;
                        // Do NOT stop playing yet. Wait for drain loop.
                    }
                }
            },
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                // Heartbeat / Checkups
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                log::info!("[AudioController] Event channel disconnected");
                break;
            }
        }
    }
}
