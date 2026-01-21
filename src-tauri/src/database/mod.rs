use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::fs;
use tauri::{AppHandle, Manager};

pub struct DatabaseManager {
    pub pool: Pool<Sqlite>,
}

impl DatabaseManager {
    pub async fn new(app_handle: &AppHandle) -> Result<Self, String> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?;

        if !app_dir.exists() {
            fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        }

        let db_path = app_dir.join("library.db");

        log::info!("Connecting to database at: {:?}", db_path);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(
                sqlx::sqlite::SqliteConnectOptions::new()
                    .filename(&db_path)
                    .create_if_missing(true),
            )
            .await
            .map_err(|e| format!("Failed to connect to database: {}", e))?;

        Self::run_migrations(&pool).await?;

        Ok(Self { pool })
    }

    async fn run_migrations(pool: &Pool<Sqlite>) -> Result<(), String> {
        // 1. Get current version
        let row: (i32,) = sqlx::query_as("PRAGMA user_version")
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Failed to fetch user_version: {}", e))?;

        let current_version = row.0;
        log::info!("Current database version: {}", current_version);

        // 2. Define Migrations
        // V1: Initial Schema
        // V2: Analytics & Context columns
        let migrations = [
            // Migration 1: Baseline
            include_str!("schema.sql"),
            // Migration 2: Recently Played Enhancements
            r#"
            -- Tracks: Analytics
            ALTER TABLE tracks ADD COLUMN play_count INTEGER DEFAULT 0;
            ALTER TABLE tracks ADD COLUMN skip_count INTEGER DEFAULT 0;
            ALTER TABLE tracks ADD COLUMN last_played_at INTEGER;
            ALTER TABLE tracks ADD COLUMN added_at INTEGER DEFAULT 0;

            -- Playlists: Analytics
            ALTER TABLE playlists ADD COLUMN last_played_at INTEGER;

            -- History: Context
            ALTER TABLE play_history ADD COLUMN context_uri TEXT;
            ALTER TABLE play_history ADD COLUMN context_type TEXT;
            "#,
            // Migration 2.1: Fix added_at for existing rows to be "now" if they are 0
            r#"
            UPDATE tracks 
            SET play_count = (
                SELECT COUNT(*) 
                FROM play_history 
                WHERE play_history.track_id = tracks.id
            );

            UPDATE tracks
            SET last_played_at = (
                SELECT MAX(played_at)
                FROM play_history
                WHERE play_history.track_id = tracks.id
            );
            "#,
            // Migration 4: Offline capability
            r#"
            ALTER TABLE tracks ADD COLUMN audio_quality TEXT;
            "#,
            // Migration 5: Provider configs for self-hosted services
            r#"
            CREATE TABLE IF NOT EXISTS provider_configs (
                provider_id TEXT PRIMARY KEY,
                server_url TEXT NOT NULL,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
            "#,
            // Migration 6: Universal Library - Provider/External IDs
            r#"
            -- Add columns to tracks
            ALTER TABLE tracks ADD COLUMN provider_id TEXT;
            ALTER TABLE tracks ADD COLUMN external_id TEXT;

            -- Add columns to albums
            ALTER TABLE albums ADD COLUMN provider_id TEXT;
            ALTER TABLE albums ADD COLUMN external_id TEXT;

            -- Add columns to artists
            ALTER TABLE artists ADD COLUMN provider_id TEXT;
            ALTER TABLE artists ADD COLUMN external_id TEXT;

            -- Backfill LOCAL tracks
            UPDATE tracks SET provider_id = 'local' WHERE source_type = 'LOCAL';

            -- Backfill TIDAL tracks
            UPDATE tracks SET provider_id = 'tidal', external_id = CAST(tidal_id AS TEXT) WHERE source_type = 'TIDAL' AND tidal_id IS NOT NULL;
            UPDATE albums SET provider_id = 'tidal', external_id = CAST(tidal_id AS TEXT) WHERE tidal_id IS NOT NULL;
            UPDATE artists SET provider_id = 'tidal', external_id = CAST(tidal_id AS TEXT) WHERE tidal_id IS NOT NULL;

            -- Create Indexes
            CREATE INDEX IF NOT EXISTS idx_tracks_provider_external ON tracks(provider_id, external_id);
            CREATE INDEX IF NOT EXISTS idx_albums_provider_external ON albums(provider_id, external_id);
            CREATE INDEX IF NOT EXISTS idx_artists_provider_external ON artists(provider_id, external_id);
            "#,
            // Migration 7: App Settings (for download path persistence)
            r#"
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            "#,
        ];

        // 3. Apply Migrations
        let target_version = migrations.len() as i32;

        if current_version < target_version {
            log::info!(
                "Migrating database from version {} to {}",
                current_version,
                target_version
            );

            for (idx, migration_sql) in migrations.iter().enumerate() {
                let version = (idx + 1) as i32;

                if version > current_version {
                    log::info!("Applying migration {}...", version);

                    let statements: Vec<&str> = migration_sql
                        .split(';')
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .collect();

                    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

                    for sql in statements {
                        if sql.is_empty() {
                            continue;
                        }

                        if let Err(e) = sqlx::query(sql).execute(tx.as_mut()).await {
                            return Err(format!(
                                "Migration {} failed on statement '{}': {}",
                                version, sql, e
                            ));
                        }
                    }

                    let version_update = format!("PRAGMA user_version = {}", version);
                    sqlx::query(&version_update)
                        .execute(tx.as_mut())
                        .await
                        .map_err(|e| e.to_string())?;

                    tx.commit()
                        .await
                        .map_err(|e| format!("Failed to commit migration {}: {}", version, e))?;
                    log::info!("Migration {} applied successfully.", version);
                }
            }
        } else {
            log::info!("Database is up to date.");
        }

        Ok(())
    }
}
