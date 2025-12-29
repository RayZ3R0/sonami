use lofty::prelude::*;
use lofty::probe::Probe;
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize, Clone, Debug)]
pub struct LyricLine {
    pub time: f64, // seconds
    pub text: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct LyricsResult {
    pub synced: bool,
    pub lines: Vec<LyricLine>,
}

pub fn get_lyrics_for_track(path_str: &str) -> Option<LyricsResult> {
    let path = Path::new(path_str);

    // 1. Try Sidecar Files First (User manual override usually preferred)
    // Priority: .lrc (synced) > .txt (unsynced)
    if let Some(lyrics) = check_sidecar_files(path) {
        return Some(lyrics);
    }

    // 2. Try Metadata
    if let Some(lyrics) = check_metadata(path) {
        return Some(lyrics);
    }

    None
}

fn check_sidecar_files(audio_path: &Path) -> Option<LyricsResult> {
    let parent = audio_path.parent()?;
    let stem = audio_path.file_stem()?.to_str()?;

    // Check .lrc
    let lrc_path = parent.join(format!("{}.lrc", stem));
    if lrc_path.exists() {
        if let Ok(content) = fs::read_to_string(lrc_path) {
            if let Some(parsed) = parse_lrc(&content) {
                return Some(parsed);
            }
        }
    }

    // Check .txt
    let txt_path = parent.join(format!("{}.txt", stem));
    if txt_path.exists() {
        if let Ok(content) = fs::read_to_string(txt_path) {
             return Some(LyricsResult {
                synced: false,
                lines: vec![LyricLine {
                    time: 0.0,
                    text: content,
                }],
            });
        }
    }

    None
}

use lofty::tag::ItemKey;

fn check_metadata(path: &Path) -> Option<LyricsResult> {
    let tagged_file = Probe::open(path).ok()?.read().ok()?;
    let tag = tagged_file.primary_tag()?;

    // Generic check using lofty's abstraction
    for item in tag.items() {
        if item.key() == &ItemKey::Lyrics {
             if let Some(val) = item.value().text() {
                  return Some(LyricsResult {
                    synced: false,
                    lines: vec![LyricLine {
                        time: 0.0,
                        text: val.to_string(),
                    }],
                });
             }
        }
    }

    None
}

fn parse_lrc(content: &str) -> Option<LyricsResult> {
    let mut lines = Vec::new();
    let mut is_synced = false;

    // Simple LRC parser: [mm:ss.xx]Text
    // Regex would be nice but simple string parsing works for standard format
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }

        if let Some((time, text)) = parse_lrc_line(line) {
            lines.push(LyricLine { time, text });
            is_synced = true;
        } else if !is_synced && lines.is_empty() {
            // First line failed to parse as LRC, but maybe it's just header metadata we ignore 
            // or maybe it's a plain text file pretending to be LRC?
            // If we find ANY synced line, we treat as synced.
        }
    }

    if is_synced && !lines.is_empty() {
        Some(LyricsResult {
            synced: true,
            lines,
        })
    } else {
        None
    }
}

fn parse_lrc_line(line: &str) -> Option<(f64, String)> {
    // Expected format: [mm:ss.xx]Text
    if !line.starts_with('[') { return None; }
    let end_bracket = line.find(']')?;
    
    let timestamp_str = &line[1..end_bracket];
    let text = line[end_bracket+1..].trim().to_string();

    // Parse timestamp
    let parts: Vec<&str> = timestamp_str.split(':').collect();
    if parts.len() != 2 { return None; }

    let minutes: f64 = parts[0].parse().ok()?;
    let seconds: f64 = parts[1].parse().ok()?;

    let total_seconds = minutes * 60.0 + seconds;
    Some((total_seconds, text))
}
