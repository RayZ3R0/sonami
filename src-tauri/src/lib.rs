pub mod audio;
pub mod commands;

use audio::AudioManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let audio_manager = AudioManager::new(handle);
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
            commands::queue_next_track,
            commands::get_playback_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
