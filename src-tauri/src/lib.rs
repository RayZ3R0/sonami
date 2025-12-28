pub mod audio;
pub mod commands;
pub mod dsp;
pub mod media_controls;
pub mod queue;

use audio::AudioManager;
use souvlaki::MediaControlEvent;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let audio_manager = AudioManager::new(handle.clone());

            // Set up OS media control event handlers
            let state_for_controls = audio_manager.state.clone();
            let queue_for_controls = audio_manager.queue.clone();
            let cmd_tx = audio_manager.command_tx_clone();

            audio_manager
                .media_controls
                .attach_handler(move |event| match event {
                    MediaControlEvent::Play => {
                        state_for_controls
                            .is_playing
                            .store(true, std::sync::atomic::Ordering::Relaxed);
                    }
                    MediaControlEvent::Pause => {
                        state_for_controls
                            .is_playing
                            .store(false, std::sync::atomic::Ordering::Relaxed);
                    }
                    MediaControlEvent::Toggle => {
                        let current = state_for_controls
                            .is_playing
                            .load(std::sync::atomic::Ordering::Relaxed);
                        state_for_controls
                            .is_playing
                            .store(!current, std::sync::atomic::Ordering::Relaxed);
                    }
                    MediaControlEvent::Next => {
                        if let Some(track) = queue_for_controls.write().get_next_track(true) {
                            let _ = cmd_tx.send(audio::DecoderCommand::Load(track.path));
                        }
                    }
                    MediaControlEvent::Previous => {
                        if let Some(track) = queue_for_controls.write().get_prev_track() {
                            let _ = cmd_tx.send(audio::DecoderCommand::Load(track.path));
                        }
                    }
                    MediaControlEvent::Stop => {
                        let _ = cmd_tx.send(audio::DecoderCommand::Stop);
                    }
                    _ => {}
                });

            app.manage(audio_manager);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::import_music,
            commands::import_folder,
            commands::play_track,
            commands::pause_track,
            commands::resume_track,
            commands::seek_track,
            commands::set_volume,
            commands::get_position,
            commands::get_duration,
            commands::get_is_playing,
            commands::set_queue,
            commands::add_to_queue,
            commands::clear_queue,
            commands::toggle_shuffle,
            commands::set_repeat_mode,
            commands::next_track,
            commands::prev_track,
            commands::get_playback_info,
            commands::get_current_track,
            commands::get_queue,
            commands::get_shuffle_mode,
            commands::get_repeat_mode,
            commands::get_crossfade_duration,
            commands::set_crossfade_duration
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
