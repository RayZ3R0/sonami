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
use super::types::{AudioContext, DecoderCommand, PlaybackState, DEFAULT_CROSSFADE_MS};

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
            url_resolver,
            discord_rpc,
        };

        let context_decoder = context.clone();
        let context_output = context.clone();

        thread::spawn(move || {
            decoder_thread(command_rx, context_decoder);
        });

        thread::spawn(move || {
            run_audio_output(context_output);
        });

        Self {
            state,
            command_tx,
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
