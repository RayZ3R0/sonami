pub mod audio;
pub mod commands;

use audio::AudioManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio_manager = AudioManager::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .manage(audio_manager)
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
