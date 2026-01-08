use lofty::prelude::*;
use lofty::probe::Probe;
use serde::Serialize;
use std::fs;
use std::path::Path;

pub mod lrclib;

#[derive(Serialize, Clone, Debug)]
pub struct LyricLine {
    pub time: f64,
    pub text: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct LyricsResult {
    pub synced: bool,
    pub lines: Vec<LyricLine>,
    pub source: String, // "local", "metadata", or "lrclib"
}

pub async fn get_lyrics(
    path_str: Option<String>,
    title: &str,
    artist: &str,
    album: &str,
    duration: f64,
) -> Option<LyricsResult> {
    // 1. Try Local Files (if path is provided and exists)
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

    // 2. Fallback to LRCLib
    if let Ok(Some(response)) =
        lrclib::LrcLibClient::get_lyrics(title, artist, album, duration).await
    {
        log::info!("Processing LRCLib response...");

        // Try synced lyrics first
        if let Some(ref synced) = response.synced_lyrics {
            log::info!("Synced lyrics present, length: {}", synced.len());
            if !synced.trim().is_empty() {
                if let Some(parsed) = parse_lrc(synced) {
                    log::info!("✓ Successfully parsed synced lyrics");
                    let mut res = parsed;
                    res.source = "lrclib".to_string();
                    return Some(res);
                } else {
                    log::warn!("Failed to parse synced lyrics");
                }
            } else {
                log::warn!("Synced lyrics was empty after trim");
            }
        } else {
            log::info!("No synced lyrics in response");
        }

        // Fallback to plain lyrics
        if let Some(plain) = response.plain_lyrics {
            log::info!("✓ Using plain lyrics fallback");
            return Some(LyricsResult {
                synced: false,
                lines: string_to_lines(&plain),
                source: "lrclib".to_string(),
            });
        } else {
            log::warn!("No plain lyrics in response either");
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
                // Check if it looks like LRC
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
