use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::thread;
use parking_lot::RwLock;
use tauri::AppHandle;

use crate::dsp::DspChain;
use crate::media_controls::MediaControlsManager;
use crate::queue::PlayQueue;

use super::buffer::AudioBuffer;
use super::types::{DecoderCommand, PlaybackState, DEFAULT_CROSSFADE_MS};
use super::decoder::decoder_thread;
use super::output::run_audio_output;

pub const BUFFER_SIZE: usize = 65536;

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

    pub fn shutdown(&self) {
        self.shutdown.store(true, Ordering::Relaxed);
    }

    pub fn play(&self, path: String) {
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
