pub mod audio;
pub mod commands;
pub mod database;
pub mod download;
pub mod dsp;
pub mod favorites;
pub mod history;
pub mod library;
pub mod lyrics;
pub mod media_controls;
pub mod playlist;
pub mod queue;
pub mod tidal;

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
            let _playlist_manager_placeholder = ();


            let handle_clone = handle.clone();
            tauri::async_runtime::spawn(async move {
                match tidal::TidalClient::new().await {
                    Ok(client) => {
                        handle_clone.manage(client);
                        log::info!("Tidal client initialized successfully");
                    }
                    Err(e) => {
                        log::error!("Failed to initialize Tidal client: {}", e);
                    }
                }
            });


            let handle_clone_db = handle.clone();
            tauri::async_runtime::spawn(async move {
                match database::DatabaseManager::new(&handle_clone_db).await {
                    Ok(db) => {
                        let pool = db.pool.clone();
                        handle_clone_db.manage(db);

                        let lib = library::LibraryManager::new(pool.clone());
                        handle_clone_db.manage(lib);

                        let pl_manager = playlist::PlaylistManager::new(pool.clone());
                        handle_clone_db.manage(pl_manager);

                        let fav_manager = favorites::FavoritesManager::new(pool.clone());
                        handle_clone_db.manage(fav_manager);

                        let hist_manager = history::PlayHistoryManager::new(pool);
                        handle_clone_db.manage(hist_manager);

                        log::info!("Database, Library, Playlist, Favorites & History Managers initialized successfully");
                    }
                    Err(e) => {
                        log::error!("Failed to initialize database: {}", e);
                    }
                }
            });
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
            commands::playlist::get_playlists,
            commands::playlist::create_playlist,
            commands::playlist::delete_playlist,

            commands::playlist::get_playlist_details,
            commands::playlist::add_tidal_track_to_playlist,
            commands::playlist::add_to_playlist,
            commands::playlist::remove_from_playlist,
            commands::playlist::get_playlists_containing_track,

            commands::favorites::add_favorite,
            commands::favorites::remove_favorite,
            commands::favorites::is_favorited,
            commands::favorites::get_favorites,

            commands::history::record_play,
            commands::history::update_play_completion,
            commands::history::get_recent_plays,
            commands::history::get_play_count,

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
            commands::set_crossfade_duration,
            commands::get_lyrics,
            commands::play_stream,
            commands::tidal_search_tracks,
            commands::tidal_search_albums,
            commands::tidal_search_artists,
            commands::play_tidal_track,
            commands::get_tidal_stream_url,
            commands::refresh_tidal_cache,
            commands::fetch_image_as_data_url,
            commands::library::get_library_tracks,
            commands::library::get_library_albums,
            commands::library::get_library_artists,
            commands::library::search_library,
            commands::library::add_tidal_track,
            commands::library::rebuild_search_index
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
