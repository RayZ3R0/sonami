# Backend Feature Roadmap

> Priority scale: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low  
> Difficulty scale: ⭐ Easy | ⭐⭐ Moderate | ⭐⭐⭐ Hard | ⭐⭐⭐⭐ Expert

---

## Phase 1: Stability & Polish

### 1. Audio Device Hot-Swap Detection
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🔴 Critical | ⭐⭐ Moderate | 2-3 hours |

**Current State**: Stream runs in infinite loop, never checks for device changes.

**Problem**: Unplugging headphones = silence until app restart.

**Solution**:
```rust
// In run_audio_output(), replace infinite loop with:
loop {
    // Check if device still valid every 500ms
    if host.default_output_device().map(|d| d.name()) != Some(current_device_name) {
        break; // Exit loop, outer loop will reconnect
    }
    thread::sleep(Duration::from_millis(500));
}
```

**Files**: `audio.rs` (run_audio_output function)

---

### 2. Error Handling & User Feedback
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🔴 Critical | ⭐ Easy | 1-2 hours |

**Current State**: Many `Err(_) => {}` silent failures.

**Problem**: Corrupt files silently fail, users don't know why nothing plays.

**Solution**:
- Create error event channel
- Emit `playback-error` events to frontend
- Auto-skip to next track on unrecoverable errors

**Files**: `audio.rs`, `lib.rs`, new `errors.rs`

---

### 3. Proper Decoder Thread Shutdown
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🟠 High | ⭐ Easy | 30 min |

**Current State**: Threads run forever, no graceful shutdown.

**Problem**: App quit may leave zombie threads, potential resource leaks.

**Solution**:
- Add `DecoderCommand::Shutdown` variant
- Send on app close via Tauri lifecycle hook
- Break thread loops on shutdown command

**Files**: `audio.rs`, `lib.rs`

---

## Phase 2: Audio Quality

### 4. Pre-Computed ReplayGain / R128 Scanning
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🟠 High | ⭐⭐⭐ Hard | 6-8 hours |

**Current State**: Real-time loudness normalization (reactive).

**Problem**: First few seconds of each track may be too loud/quiet before normalization kicks in.

**Solution**:
- Add background scanning service
- Use `ebur128` crate for R128 loudness measurement
- Store `track_gain` and `track_peak` in SQLite or JSON sidecar
- Apply gain immediately on track load

**Dependencies**: `ebur128`, `rusqlite` or sidecar files

**Files**: New `scanner.rs`, modify `commands.rs`, `dsp.rs`

---

### 5. Read Existing ReplayGain Tags
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🟠 High | ⭐ Easy | 1 hour |

**Current State**: Ignores ReplayGain tags in files.

**Problem**: Many music files already have RG tags from tools like foobar2000.

**Solution**:
- Parse `REPLAYGAIN_TRACK_GAIN` from lofty tags
- Apply gain in decoder thread or DSP chain
- Fallback to real-time normalization if no tag

**Files**: `commands.rs` (parse_audio_file), `dsp.rs`

---

### 6. Sample-Accurate Seeking
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🟡 Medium | ⭐⭐ Moderate | 2-3 hours |

**Current State**: Time-based seek, may land between samples.

**Problem**: For MP3/AAC, frames don't align to exact timestamps. Can cause clicks.

**Solution**:
- Use `SeekMode::Accurate` (already done ✓)
- Flush resampler state after seek
- Optionally: fade in 5-10ms after seek to mask artifacts

**Files**: `audio.rs` (DecoderCommand::Seek handler)

---

### 7. Bit-Perfect / Exclusive Mode
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🟢 Low | ⭐⭐⭐⭐ Expert | 8-12 hours |

**Current State**: Uses shared audio mode via cpal.

**Problem**: Audiophiles want bit-perfect output (no OS mixer resampling).

**Solution**:
- Windows: WASAPI exclusive mode via `cpal` features or direct `wasapi` crate
- Linux: Direct ALSA with `alsa` crate, bypassing PulseAudio
- Add toggle in settings

**Files**: New `audio_exclusive.rs`, platform-specific code

---

## Phase 3: Features

### 8. Scrobbling / Play Statistics
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🟡 Medium | ⭐⭐ Moderate | 3-4 hours |

**Current State**: No play tracking.

**Solution**:
- Track when >50% or 4 min played (scrobble rules)
- Store play counts locally
- Optional: Last.fm / ListenBrainz API integration

**Dependencies**: `reqwest` for API calls

**Files**: New `scrobble.rs`, modify `audio.rs` for play tracking

---

### 9. Embedded Lyrics Extraction
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🟡 Medium | ⭐ Easy | 1-2 hours |

**Current State**: Only reads title/artist/album/cover.

**Solution**:
- Parse `LYRICS` and `USLT` (unsynchronized lyrics) frames
- Parse `SYLT` (synchronized lyrics) for karaoke mode
- Expose via new command

**Files**: `commands.rs`

---

### 10. Cue Sheet / Chapter Support
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🟢 Low | ⭐⭐ Moderate | 3-4 hours |

**Current State**: No cue sheet parsing.

**Problem**: DJ mixes and audiobooks often use single file + cue.

**Solution**:
- Parse `.cue` files alongside audio
- Create virtual track entries with start/end times
- Seek to chapter on "track" change

**Files**: New `cue.rs`, modify `queue.rs`

---

### 11. Audio Session / Focus Handling
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🟢 Low | ⭐⭐⭐ Hard | 4-6 hours |

**Current State**: No response to system audio events.

**Problem**: Doesn't pause for calls, notifications, other apps.

**Solution**:
- Windows: Audio Session API
- Linux: PulseAudio/PipeWire cork events
- macOS: AVAudioSession

**Files**: New `audio_session.rs`, platform-specific

---

### 12. Network Streaming Support
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🟢 Low | ⭐⭐⭐⭐ Expert | 12-20 hours |

**Current State**: Local files only.

**Solution**:
- HTTP/HTTPS streaming with range requests
- Buffering strategy (progressive download)
- Handle network interruptions gracefully

**Dependencies**: `reqwest`, possibly `async` runtime integration

**Files**: New `stream.rs`, modify `audio.rs` heavily

---

## Phase 4: Performance

### 13. Parallel Decoder Threads for Crossfade
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🟢 Low | ⭐⭐⭐ Hard | 4-6 hours |

**Current State**: Single thread decodes both tracks during crossfade.

**Problem**: High-bitrate FLAC + resampling during crossfade could cause stuttering.

**Solution**:
- Spawn temporary decoder thread for next track
- Use separate channels for each buffer
- Join thread after crossfade completes

**Files**: `audio.rs` (major refactor of decoder_thread)

---

### 14. Memory-Mapped File Reading
| Priority | Difficulty | Est. Time |
|----------|------------|-----------|
| 🟢 Low | ⭐⭐ Moderate | 2-3 hours |

**Current State**: Standard file I/O.

**Solution**:
- Use `memmap2` for faster file access
- Especially beneficial for large FLAC files
- Reduces syscall overhead

**Files**: `audio.rs` (load_track function)

---

## Implementation Order (Recommended)

```
Week 1: Stability
├── 1. Device Hot-Swap ──────────── 🔴 ⭐⭐
├── 2. Error Handling ───────────── 🔴 ⭐
└── 3. Graceful Shutdown ────────── 🟠 ⭐

Week 2: Audio Quality
├── 5. Read ReplayGain Tags ─────── 🟠 ⭐
├── 6. Sample-Accurate Seeking ──── 🟡 ⭐⭐
└── 4. R128 Background Scanning ─── 🟠 ⭐⭐⭐

Week 3: Features
├── 9. Lyrics Extraction ────────── 🟡 ⭐
├── 8. Scrobbling ───────────────── 🟡 ⭐⭐
└── 10. Cue Sheet Support ───────── 🟢 ⭐⭐

Future:
├── 7. Bit-Perfect Mode ─────────── 🟢 ⭐⭐⭐⭐
├── 11. Audio Session Handling ──── 🟢 ⭐⭐⭐
├── 12. Network Streaming ───────── 🟢 ⭐⭐⭐⭐
├── 13. Parallel Decoders ───────── 🟢 ⭐⭐⭐
└── 14. Memory-Mapped Files ─────── 🟢 ⭐⭐
```

---

## Quick Wins (< 2 hours each)

1. ✨ Error handling with user feedback
2. ✨ Graceful thread shutdown
3. ✨ Read existing ReplayGain tags
4. ✨ Lyrics extraction
5. ✨ Post-seek fade-in (5ms) to prevent clicks

---

## Dependencies to Add

```toml
# For R128 loudness scanning
ebur128 = "0.1"

# For local database (play counts, scanned gains)
rusqlite = { version = "0.31", features = ["bundled"] }

# For scrobbling APIs
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }

# For memory-mapped files (optional)
memmap2 = "0.9"
```

---

## Notes

- **Crossfade is already industry-standard** ✅
- **Resampling quality is broadcast-grade** ✅
- **Focus on stability before features**
- **Test on Windows too** - media_controls needs HWND initialization
