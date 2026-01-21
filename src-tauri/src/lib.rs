pub mod audio;
pub mod commands;
pub mod database;
pub mod discord;
pub mod download;
pub mod dsp;
pub mod favorites;
pub mod history;
pub mod jellyfin;
pub mod library;
pub mod lyrics;
pub mod media_controls;
pub mod models;
pub mod playlist;
pub mod providers;
pub mod queue;
pub mod spotify;
pub mod subsonic;
pub mod tidal;

use audio::AudioManager;
use discord::DiscordRpcManager;
use download::DownloadManager;
use souvlaki::MediaControlEvent;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_screenshots::init())
        .setup(|app| {
            let handle = app.handle().clone();

            let discord_rpc = std::sync::Arc::new(DiscordRpcManager::new());
            let audio_manager = AudioManager::new(handle.clone(), Some(discord_rpc.clone()));

            let _playlist_manager_placeholder = ();
            app.manage((*discord_rpc).clone());

            // Initialize DownloadManager
            let download_manager = DownloadManager::new(&handle);
            app.manage(download_manager);

            // Initialize TidalConfig
            let tidal_config = std::sync::Arc::new(parking_lot::Mutex::new(tidal::TidalConfig::default()));
            app.manage(tidal_config);

            // Initialize ProviderManager
            let provider_manager = std::sync::Arc::new(providers::ProviderManager::new());
            app.manage(provider_manager.clone());


            let provider_manager_clone = provider_manager.clone();
            let handle_clone = handle.clone();
            tauri::async_runtime::spawn(async move {
                // Initialize Tidal Client
                match tidal::TidalClient::new().await {
                    Ok(client) => {
                        handle_clone.manage(client);
                        log::info!("Tidal client initialized successfully");
                    }
                    Err(e) => {
                        log::error!("Failed to initialize Tidal client: {}", e);
                    }
                }

                // Initialize Tidal Provider
                match tidal::provider::TidalProvider::new().await {
                    Ok(provider) => {
                        provider_manager_clone.register_provider(std::sync::Arc::new(provider)).await;
                        log::info!("Tidal Provider registered successfully");
                    }
                    Err(e) => {
                        log::error!("Failed to initialize Tidal Provider: {}", e);
                    }
                }
            });


            let provider_manager_for_db = provider_manager.clone();
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

                        let hist_manager = history::PlayHistoryManager::new(pool.clone());
                        handle_clone_db.manage(hist_manager);

                        log::info!("Database, Library, Playlist, Favorites & History Managers initialized successfully");

                        // Load configured providers from database
                        let configs: Vec<(String, String, String, String)> = sqlx::query_as(
                            "SELECT provider_id, server_url, username, password FROM provider_configs WHERE enabled = 1"
                        )
                        .fetch_all(&pool)
                        .await
                        .unwrap_or_default();

                        for (provider_id, server_url, username, password) in configs {
                            match provider_id.as_str() {
                                "subsonic" => {
                                    let provider = subsonic::SubsonicProvider::with_config(
                                        server_url.clone(), username, password
                                    );
                                    if provider.ping().await.is_ok() {
                                        provider_manager_for_db.register_provider(std::sync::Arc::new(provider)).await;
                                        log::info!("Loaded Subsonic provider from database for {}", server_url);
                                    } else {
                                        log::warn!("Failed to connect to saved Subsonic server: {}", server_url);
                                    }
                                }
                                "jellyfin" => {
                                    let mut provider = jellyfin::JellyfinProvider::new();
                                    provider.server_url = server_url.clone();
                                    if provider.authenticate(&username, &password).await.is_ok() {
                                        provider_manager_for_db.register_provider(std::sync::Arc::new(provider)).await;
                                        log::info!("Loaded Jellyfin provider from database for {}", server_url);
                                    } else {
                                        log::warn!("Failed to authenticate to saved Jellyfin server: {}", server_url);
                                    }
                                }
                                _ => {}
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Failed to initialize database: {}", e);
                    }
                }
            });
            let state_for_controls = audio_manager.state.clone();
            let queue_for_controls = audio_manager.queue.clone();
            let cmd_tx = audio_manager.command_tx_clone();
            let media_controls_for_handler = audio_manager.media_controls.clone();

            audio_manager
                .media_controls
                .attach_handler(move |event| match event {
                    MediaControlEvent::Play => {
                        state_for_controls
                            .is_playing
                            .store(true, std::sync::atomic::Ordering::SeqCst);
                        // Update MPRIS state with current position
                        let position = state_for_controls.get_position_seconds();
                        media_controls_for_handler.set_playback(true, Some(position));
                    }
                    MediaControlEvent::Pause => {
                        state_for_controls
                            .is_playing
                            .store(false, std::sync::atomic::Ordering::SeqCst);
                        // Update MPRIS state with current position
                        let position = state_for_controls.get_position_seconds();
                        media_controls_for_handler.set_playback(false, Some(position));
                    }
                    MediaControlEvent::Toggle => {
                        let current = state_for_controls
                            .is_playing
                            .load(std::sync::atomic::Ordering::SeqCst);
                        let new_state = !current;
                        state_for_controls
                            .is_playing
                            .store(new_state, std::sync::atomic::Ordering::SeqCst);
                        // Update MPRIS state with current position
                        let position = state_for_controls.get_position_seconds();
                        media_controls_for_handler.set_playback(new_state, Some(position));
                    }
                    MediaControlEvent::Next => {
                        let track = queue_for_controls.write().get_next_track(true);
                        if let Some(ref track) = track {
                            let _ = cmd_tx.send(audio::DecoderCommand::Load(track.path.clone()));
                            // Update MPRIS metadata for the new track
                            media_controls_for_handler.set_metadata(
                                &track.title,
                                &track.artist,
                                &track.album,
                                track.cover_image.as_deref(),
                                track.duration as f64,
                            );
                            media_controls_for_handler.set_playback(true, Some(0.0));
                        }
                    }
                    MediaControlEvent::Previous => {
                        let track = queue_for_controls.write().get_prev_track();
                        if let Some(ref track) = track {
                            let _ = cmd_tx.send(audio::DecoderCommand::Load(track.path.clone()));
                            // Update MPRIS metadata for the new track
                            media_controls_for_handler.set_metadata(
                                &track.title,
                                &track.artist,
                                &track.album,
                                track.cover_image.as_deref(),
                                track.duration as f64,
                            );
                            media_controls_for_handler.set_playback(true, Some(0.0));
                        }
                    }
                    MediaControlEvent::Stop => {
                        let _ = cmd_tx.send(audio::DecoderCommand::Stop);
                        state_for_controls
                            .is_playing
                            .store(false, std::sync::atomic::Ordering::SeqCst);
                        media_controls_for_handler.set_stopped();
                    }
                    MediaControlEvent::SetPosition(position) => {
                        let seconds = position.0.as_secs_f64();
                        let _ = cmd_tx.send(audio::DecoderCommand::Seek(seconds));
                    }
                    MediaControlEvent::Seek(direction) => {
                        use souvlaki::SeekDirection;
                        let current_pos = state_for_controls.get_position_seconds();
                        let duration = state_for_controls.get_duration_seconds();
                        let new_pos = match direction {
                            SeekDirection::Forward => (current_pos + 5.0).min(duration),
                            SeekDirection::Backward => (current_pos - 5.0).max(0.0),
                        };
                        let _ = cmd_tx.send(audio::DecoderCommand::Seek(new_pos));
                    }
                    MediaControlEvent::SetVolume(volume) => {
                        state_for_controls.set_volume(volume as f32);
                    }
                    _ => {}
                });

            let media_controls_for_position = audio_manager.media_controls.clone();
            let state_for_position = audio_manager.state.clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(1000));

                    let is_playing = state_for_position
                        .is_playing
                        .load(std::sync::atomic::Ordering::Relaxed);
                    let position = state_for_position.get_position_seconds();

                    if position > 0.0 || is_playing {
                        media_controls_for_position.set_playback(is_playing, Some(position));
                    }
                }
            });



            app.manage(audio_manager);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::playlist::get_playlists,
            commands::playlist::create_playlist,
            commands::playlist::delete_playlist,
            commands::playlist::rename_playlist,

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
            commands::history::get_recently_played,
            commands::history::get_most_played,
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
            commands::tidal_get_album,
            commands::tidal_get_album_tracks,
            commands::tidal_get_artist,
            commands::tidal_get_artist_top_tracks,
            commands::tidal_get_artist_albums,
            commands::tidal_debug_endpoint,
            commands::play_tidal_track,
            commands::get_tidal_stream_url,
            commands::refresh_tidal_cache,
            commands::fetch_image_as_data_url,
            commands::set_tidal_config,
            commands::library::get_library_tracks,
            commands::library::get_library_albums,
            commands::library::get_library_artists,
            commands::library::search_library,
            commands::library::search_library_full,
            commands::library::add_tidal_track,
            commands::library::rebuild_search_index,
            commands::library::factory_reset,
            commands::library::library_has_data,
            // Spotify Import
            commands::spotify::fetch_spotify_playlist,
            commands::spotify::verify_spotify_track,
            commands::spotify::verify_spotify_tracks,
            commands::spotify::add_spotify_tracks_to_playlist,
            commands::spotify::create_playlist_from_spotify,
            // DSP / Audio Processing
            commands::set_loudness_normalization,
            commands::get_loudness_normalization,
            // Discord Rich Presence
            commands::set_discord_rpc_enabled,
            commands::get_discord_rpc_enabled,
            // Downloads
            commands::download::start_download,
            commands::download::get_download_path,
            commands::download::set_download_path,
            commands::download::open_download_folder,
            commands::download::delete_track_download,
            commands::download::download_provider_track,
            // Window Management
            commands::is_tiling_wm,
            // Generic Provider Commands
            commands::search_music,
            commands::get_music_stream_url,
            commands::get_providers_list,
            commands::set_active_provider,
            commands::play_provider_track,
            // Provider Configuration
            commands::providers::configure_subsonic,
            commands::providers::configure_jellyfin,
            commands::providers::get_provider_configs,
            commands::providers::remove_provider_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
