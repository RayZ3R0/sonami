pub mod audio;
pub mod commands;
pub mod database;
pub mod discord;
pub mod download;
pub mod dsp;
pub mod errors;
pub mod favorites;
pub mod history;
pub mod jellyfin;
pub mod library;
pub mod lyrics;
pub mod media_controls;
pub mod models;
pub mod playback_notifier;
pub mod playlist;
pub mod providers;
pub mod queue;
pub mod spotify;
pub mod subsonic;
pub mod tidal;

use audio::AudioManager;
use discord::DiscordRpcManager;
use download::DownloadManager;
use playback_notifier::PlaybackNotifier;
use souvlaki::MediaControlEvent;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(not(target_os = "android"))]
    {
        builder = builder.plugin(tauri_plugin_screenshots::init());
    }

    builder
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize Discord RPC Manager
            let discord_rpc = std::sync::Arc::new(DiscordRpcManager::new());

            // Initialize Audio Manager and manage it immediately so it's accessible via State
            let audio_manager = AudioManager::new(handle.clone(), Some(discord_rpc.clone()));

            // Create the centralized PlaybackNotifier
            let playback_notifier = PlaybackNotifier::new(
                Some(discord_rpc.clone()),
                audio_manager.media_controls.clone(),
            );

            app.manage(audio_manager);
            app.manage((*discord_rpc).clone());
            app.manage(playback_notifier);


            let download_manager = DownloadManager::new(&handle);
            app.manage(download_manager);


            let tidal_config = std::sync::Arc::new(parking_lot::Mutex::new(tidal::TidalConfig::default()));
            app.manage(tidal_config);


            let provider_manager = std::sync::Arc::new(providers::ProviderManager::new());
            app.manage(provider_manager.clone());


            let provider_manager_clone = provider_manager.clone();
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

                        // Initialize Persistence for Download Manager
                        let db_ref = handle_clone_db.state::<database::DatabaseManager>();
                        let dm = handle_clone_db.state::<DownloadManager>();
                        dm.initialize(&db_ref).await;

                        // Initialize Persistence for Audio Manager
                        let am = handle_clone_db.state::<AudioManager>();

                        if let Ok(Some(vol_str)) = db_ref.get_setting("player_volume").await {
                             if let Ok(vol) = vol_str.parse::<f32>() {
                                 am.set_volume(vol);
                                 log::info!("Restored volume: {}", vol);
                             }
                        }

                        if let Ok(Some(shuffle_str)) = db_ref.get_setting("player_shuffle").await {
                             if let Ok(shuffle) = shuffle_str.parse::<bool>() {
                                 am.queue.write().shuffle = shuffle;
                                 log::info!("Restored shuffle: {}", shuffle);
                             }
                        }

                        if let Ok(Some(repeat_str)) = db_ref.get_setting("player_repeat").await {
                             let mode = match repeat_str.as_str() {
                                 "all" => queue::RepeatMode::All,
                                 "one" => queue::RepeatMode::One,
                                 _ => queue::RepeatMode::Off,
                             };
                             am.queue.write().repeat = mode;
                             log::info!("Restored repeat mode: {:?}", mode);
                        }


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
                                    // Use authenticate() (getUser.view) for better hifi compatibility
                                    // Register provider even if initial check fails to ensure it's available for later retries
                                    match provider.authenticate().await {
                                        Ok(_) => {
                                            log::info!("Loaded and connected to Subsonic provider: {}", server_url);
                                        }
                                        Err(e) => {
                                            log::warn!(
                                                "Failed to connect to saved Subsonic server at startup (provider registered anyway): {} - Error: {}",
                                                server_url, e
                                            );
                                        }
                                    }
                                    // Always register the provider so it's available in the UI
                                    provider_manager_for_db.register_provider(std::sync::Arc::new(provider)).await;
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

            // Retrieve audio_manager and playback_notifier from state
            let audio_manager_state = app.state::<AudioManager>();
            let notifier = app.state::<std::sync::Arc<PlaybackNotifier>>();

            let state_for_controls = audio_manager_state.state.clone();
            let queue_for_controls = audio_manager_state.queue.clone();
            let cmd_tx = audio_manager_state.command_tx_clone();
            let notifier_for_handler = (*notifier).clone();

            audio_manager_state
                .media_controls
                .attach_handler(move |event| match event {
                    MediaControlEvent::Play => {
                        state_for_controls
                            .is_playing
                            .store(true, std::sync::atomic::Ordering::SeqCst);

                        let position = state_for_controls.get_position_seconds();
                        // Use notifier for both MPRIS and Discord updates
                        notifier_for_handler.notify_resumed(position);
                    }
                    MediaControlEvent::Pause => {
                        state_for_controls
                            .is_playing
                            .store(false, std::sync::atomic::Ordering::SeqCst);

                        let position = state_for_controls.get_position_seconds();
                        // Use notifier for both MPRIS and Discord updates
                        notifier_for_handler.notify_paused(position);
                    }
                    MediaControlEvent::Toggle => {
                        let current = state_for_controls
                            .is_playing
                            .load(std::sync::atomic::Ordering::SeqCst);
                        let new_state = !current;
                        state_for_controls
                            .is_playing
                            .store(new_state, std::sync::atomic::Ordering::SeqCst);

                        let position = state_for_controls.get_position_seconds();
                        // Use notifier for both MPRIS and Discord updates
                        if new_state {
                            notifier_for_handler.notify_resumed(position);
                        } else {
                            notifier_for_handler.notify_paused(position);
                        }
                    }
                    MediaControlEvent::Next => {
                        let track = queue_for_controls.write().get_next_track(true);
                        if let Some(ref track) = track {
                            let _ = cmd_tx.send(audio::DecoderCommand::Load(track.path.clone()));

                            // Use notifier for both MPRIS and Discord updates
                            notifier_for_handler.notify_playing(
                                playback_notifier::TrackMetadata::new(
                                    &track.title,
                                    &track.artist,
                                    &track.album,
                                    track.duration as f64,
                                    track.cover_image.clone(),
                                ),
                                0.0,
                            );
                        }
                    }
                    MediaControlEvent::Previous => {
                        let track = queue_for_controls.write().get_prev_track();
                        if let Some(ref track) = track {
                            let _ = cmd_tx.send(audio::DecoderCommand::Load(track.path.clone()));

                            // Use notifier for both MPRIS and Discord updates
                            notifier_for_handler.notify_playing(
                                playback_notifier::TrackMetadata::new(
                                    &track.title,
                                    &track.artist,
                                    &track.album,
                                    track.duration as f64,
                                    track.cover_image.clone(),
                                ),
                                0.0,
                            );
                        }
                    }
                    MediaControlEvent::Stop => {
                        let _ = cmd_tx.send(audio::DecoderCommand::Stop);
                        state_for_controls
                            .is_playing
                            .store(false, std::sync::atomic::Ordering::SeqCst);
                        // Use notifier for both MPRIS and Discord updates
                        notifier_for_handler.notify_stopped();
                    }
                    MediaControlEvent::SetPosition(position) => {
                        let seconds = position.0.as_secs_f64();
                        let _ = cmd_tx.send(audio::DecoderCommand::Seek(seconds));
                        // Notify seek for position update
                        notifier_for_handler.notify_seek(seconds);
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
                        // Notify seek for position update
                        notifier_for_handler.notify_seek(new_pos);
                    }
                    MediaControlEvent::SetVolume(volume) => {
                        state_for_controls.set_volume(volume as f32);
                    }
                    _ => {}
                });

            // Position sync is now handled by PlaybackNotifier's background thread
            // We just need to feed it position updates from the audio state
            let notifier_for_position = (*notifier).clone();
            let state_for_position = audio_manager_state.state.clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(500));

                    let is_playing = state_for_position
                        .is_playing
                        .load(std::sync::atomic::Ordering::Relaxed);
                    let position = state_for_position.get_position_seconds();

                    // Feed position to notifier (it handles MPRIS updates internally)
                    if is_playing && position > 0.0 {
                        notifier_for_position.update_position(position);
                    }
                }
            });

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

            commands::spotify::fetch_spotify_playlist,
            commands::spotify::verify_spotify_track,
            commands::spotify::verify_spotify_tracks,
            commands::spotify::add_spotify_tracks_to_playlist,
            commands::spotify::create_playlist_from_spotify,

            commands::set_loudness_normalization,
            commands::get_loudness_normalization,

            commands::set_discord_rpc_enabled,
            commands::get_discord_rpc_enabled,

            commands::download::start_download,
            commands::download::get_download_path,
            commands::download::set_download_path,
            commands::download::open_download_folder,
            commands::download::delete_track_download,
            commands::download::download_provider_track,

            commands::is_tiling_wm,

            commands::search_music,
            commands::get_music_stream_url,
            commands::get_providers_list,
            commands::set_active_provider,
            commands::play_provider_track,
            commands::get_album,
            commands::get_album_tracks,
            commands::get_artist,
            commands::get_artist_top_tracks,
            commands::get_artist_albums,

            commands::providers::configure_subsonic,
            commands::providers::configure_jellyfin,
            commands::providers::get_provider_configs,
            commands::providers::remove_provider_config,
            commands::providers::get_hifi_config,
            commands::providers::set_hifi_config,
            commands::providers::reset_hifi_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
