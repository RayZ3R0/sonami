use crate::database::DatabaseManager;
use lofty::prelude::*;
use lofty::probe::Probe;
use serde::Serialize;
use std::fs;
use std::path::Path;
use tauri::State;

pub mod lrclib;
pub mod netease;

#[derive(Serialize, Clone, Debug)]
pub struct LyricLine {
    pub time: f64,
    pub text: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct LyricsResult {
    pub synced: bool,
    pub lines: Vec<LyricLine>,
    pub source: String, // "local", "metadata", "lrclib", "netease", "cache"
}

struct LyricsCacheEntry {
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
    source: Option<String>,
}

pub async fn get_lyrics(
    path_str: Option<String>,
    title: &str,
    artist: &str,
    album: &str,
    duration: f64,
    target_provider: &str,
    db: State<'_, DatabaseManager>,
) -> Option<LyricsResult> {
    if let Some(ref p) = path_str {
        let path = Path::new(p);
        if path.exists() {
            if let Some(mut lyrics) = check_sidecar_files(path) {
                lyrics.source = "local".to_string();
                return Some(lyrics);
            }

            if let Some(mut lyrics) = check_metadata(path) {
                lyrics.source = "metadata".to_string();
                return Some(lyrics);
            }
        }
    }

    let cache_id = format!("{}|{}", artist.trim(), title.trim()).to_lowercase();

    if let Ok(Some(row)) =
        sqlx::query("SELECT synced_lyrics, plain_lyrics, source FROM lyrics_cache WHERE id = ?")
            .bind(&cache_id)
            .map(|row: sqlx::sqlite::SqliteRow| {
                use sqlx::Row;
                LyricsCacheEntry {
                    synced_lyrics: row.get("synced_lyrics"),
                    plain_lyrics: row.get("plain_lyrics"),
                    source: row.get("source"),
                }
            })
            .fetch_optional(&db.pool)
            .await
    {
        let cached_source = row.source.as_deref().unwrap_or("unknown");

        if cached_source == target_provider || cached_source == "cache" {
            log::info!(
                "✓ Found valid lyrics in DB cache (source: {})",
                cached_source
            );

            let synced = row.synced_lyrics.as_deref();
            let plain = row.plain_lyrics.as_deref();

            if let Some(s) = synced {
                if let Some(parsed) = parse_lrc(s) {
                    let mut res = parsed;
                    res.source = "cache".to_string();
                    return Some(res);
                }
            }

            if let Some(p) = plain {
                return Some(LyricsResult {
                    synced: false,
                    lines: string_to_lines(p),
                    source: "cache".to_string(),
                });
            }
        } else {
            log::info!(
                "Cache hit but source mismatch (want: {}, got: {}). Refetching...",
                target_provider,
                cached_source
            );
        }
    }

    if target_provider == "netease" {
        return fetch_netease(title, artist, &cache_id, &db).await;
    } else if target_provider == "lrclib" {
        return fetch_lrclib(title, artist, album, duration, &cache_id, &db).await;
    }

    log::warn!(
        "Unknown provider: {}. Defaulting to NetEase.",
        target_provider
    );
    fetch_netease(title, artist, &cache_id, &db).await
}

async fn fetch_netease(
    title: &str,
    artist: &str,
    cache_id: &str,
    db: &State<'_, DatabaseManager>,
) -> Option<LyricsResult> {
    if let Ok(Some(lrc_content)) = netease::NetEaseClient::get_lyrics(title, artist).await {
        if let Some(parsed) = parse_lrc(&lrc_content) {
            log::info!("✓ Found synced lyrics on NetEase");

            let _ = sqlx::query(
                "INSERT OR REPLACE INTO lyrics_cache (id, track_title, artist_name, synced_lyrics, source) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(cache_id)
            .bind(title)
            .bind(artist)
            .bind(&lrc_content)
            .bind("netease")
            .execute(&db.pool).await;

            let mut res = parsed;
            res.source = "netease".to_string();
            return Some(res);
        }
    }
    None
}

async fn fetch_lrclib(
    title: &str,
    artist: &str,
    album: &str,
    duration: f64,
    cache_id: &str,
    db: &State<'_, DatabaseManager>,
) -> Option<LyricsResult> {
    if let Ok(Some(response)) =
        lrclib::LrcLibClient::get_lyrics(title, artist, album, duration).await
    {
        if let Some(ref synced) = response.synced_lyrics {
            if !synced.trim().is_empty() {
                if let Some(parsed) = parse_lrc(synced) {
                    log::info!("✓ Found synced lyrics on LRCLib");

                    let _ = sqlx::query(
                        "INSERT OR REPLACE INTO lyrics_cache (id, track_title, artist_name, synced_lyrics, plain_lyrics, source) VALUES (?, ?, ?, ?, ?, ?)",
                    )
                    .bind(cache_id)
                    .bind(title)
                    .bind(artist)
                    .bind(synced)
                    .bind(&response.plain_lyrics)
                    .bind("lrclib")
                    .execute(&db.pool).await;

                    let mut res = parsed;
                    res.source = "lrclib".to_string();
                    return Some(res);
                }
            }
        }

        if let Some(plain) = response.plain_lyrics {
            log::info!("✓ Using plain lyrics fallback from LRCLib");

            let _ = sqlx::query(
                "INSERT OR REPLACE INTO lyrics_cache (id, track_title, artist_name, plain_lyrics, source) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(cache_id)
            .bind(title)
            .bind(artist)
            .bind(&plain)
            .bind("lrclib")
            .execute(&db.pool).await;

            return Some(LyricsResult {
                synced: false,
                lines: string_to_lines(&plain),
                source: "lrclib".to_string(),
            });
        }
    }
    None
}

fn check_sidecar_files(audio_path: &Path) -> Option<LyricsResult> {
    let parent = audio_path.parent()?;
    let stem = audio_path.file_stem()?.to_str()?;

    let lrc_path = parent.join(format!("{}.lrc", stem));
    if lrc_path.exists() {
        if let Ok(content) = fs::read_to_string(lrc_path) {
            if let Some(parsed) = parse_lrc(&content) {
                return Some(parsed);
            }
        }
    }

    let txt_path = parent.join(format!("{}.txt", stem));
    if txt_path.exists() {
        if let Ok(content) = fs::read_to_string(txt_path) {
            return Some(LyricsResult {
                synced: false,
                lines: string_to_lines(&content),
                source: "local".to_string(),
            });
        }
    }

    None
}

use lofty::tag::ItemKey;

fn check_metadata(path: &Path) -> Option<LyricsResult> {
    let tagged_file = Probe::open(path).ok()?.read().ok()?;
    let tag = tagged_file.primary_tag()?;

    for item in tag.items() {
        if item.key() == &ItemKey::Lyrics {
            if let Some(val) = item.value().text() {
                if let Some(parsed) = parse_lrc(val) {
                    return Some(parsed);
                }

                return Some(LyricsResult {
                    synced: false,
                    lines: string_to_lines(val),
                    source: "metadata".to_string(),
                });
            }
        }
    }

    None
}

fn string_to_lines(text: &str) -> Vec<LyricLine> {
    vec![LyricLine {
        time: 0.0,
        text: text.to_string(),
    }]
}

fn parse_lrc(content: &str) -> Option<LyricsResult> {
    let mut lines = Vec::new();
    let mut is_synced = false;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        if let Some((time, text)) = parse_lrc_line(line) {
            lines.push(LyricLine { time, text });
            is_synced = true;
        }
    }

    if is_synced && !lines.is_empty() {
        Some(LyricsResult {
            synced: true,
            lines,
            source: "".to_string(),
        })
    } else {
        None
    }
}

fn parse_lrc_line(line: &str) -> Option<(f64, String)> {
    if !line.starts_with('[') {
        return None;
    }
    let end_bracket = line.find(']')?;

    let timestamp_str = &line[1..end_bracket];
    let text = line[end_bracket + 1..].trim().to_string();

    let parts: Vec<&str> = timestamp_str.split(':').collect();
    if parts.len() != 2 {
        return None;
    }

    let minutes: f64 = parts[0].parse().ok()?;
    let seconds: f64 = parts[1].parse().ok()?;

    let total_seconds = minutes * 60.0 + seconds;
    Some((total_seconds, text))
}
