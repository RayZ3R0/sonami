# Sonami Development Roadmap

> A comprehensive plan for building the perfect music streaming & local playback client

## Current Status: Phase 1 Complete ✅

### Completed Features (Phase 1: Core Player Polish)

| Feature | Description | Status |
|---------|-------------|--------|
| **Folder Import** | Import entire directories recursively with deduplication | ✅ Done |
| **Persistent Library** | Library persists in localStorage across sessions | ✅ Done |
| **Shuffle Mode** | Random playback order with proper shuffle indices | ✅ Done |
| **Repeat Modes** | Off / Repeat All / Repeat One | ✅ Done |
| **Keyboard Shortcuts** | Full keyboard control | ✅ Done |
| **Queue Management** | Add to queue, view queue, clear queue | ✅ Done |
| **Context Menu** | Right-click on tracks for options | ✅ Done |
| **Track Duration** | Shows duration on track cards | ✅ Done |
| **Now Playing Indicator** | Visual indicator for current track | ✅ Done |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` | Seek backward 5s |
| `→` | Seek forward 5s |
| `Shift + ←` | Previous track |
| `Shift + →` | Next track |
| `↑` | Volume up |
| `↓` | Volume down |
| `M` | Mute/Unmute |
| `S` | Toggle shuffle |
| `R` | Toggle repeat mode |
| `0-9` | Seek to percentage (1=10%, 5=50%, etc.) |

---

## Future Phases

### Phase 2: Library & Organization
*Goal: Rich library management*

| Task | Priority |
|------|----------|
| Album/Artist Views with grouping | 🔴 High |
| Playlist System (Create, Edit, Delete) | 🔴 High |
| Real-time Search | 🔴 High |
| Sorting (title, artist, date added) | 🟠 Medium |
| Favorites/Likes | 🟠 Medium |
| Recently Played history | 🟠 Medium |
| Full-screen Now Playing view | 🟠 Medium |

### Phase 3: Enhanced Audio Features
*Goal: Audiophile-grade features*

| Task | Priority |
|------|----------|
| Audio Output Device Selection | 🔴 High |
| 10-band Equalizer with presets | 🟠 Medium |
| Crossfade between tracks | 🟠 Medium |
| Volume normalization (Replay Gain) | 🟠 Medium |
| Waveform visualization | 🟢 Low |
| Lyrics display (embedded + fetch) | 🟢 Low |

### Phase 4: System Integration
*Goal: Native OS integration*

| Task | Priority |
|------|----------|
| System Tray with controls | 🔴 High |
| MPRIS integration (Linux) | 🔴 High |
| Windows Media Controls | 🔴 High |
| macOS Control Center | 🔴 High |
| File associations (.mp3, .flac, etc.) | 🟠 Medium |
| Discord Rich Presence | 🟢 Low |

### Phase 5: Streaming Preparation
*Goal: Architecture for streaming backends*

| Task | Priority |
|------|----------|
| Abstract Data Layer (local/streaming) | 🔴 High |
| Authentication System (OAuth) | 🔴 High |
| Streaming Service Trait (Rust) | 🔴 High |
| Mixed Queue Support | 🟠 Medium |
| Offline Caching/Downloads | 🟠 Medium |

### Phase 6: Streaming Integration
*Goal: Connect to streaming services*

| Task | Priority |
|------|----------|
| Provider Plugin System | 🔴 High |
| Spotify Integration | 🔴 High |
| Tidal Integration (Hi-Res) | 🟠 Medium |
| YouTube Music | 🟠 Medium |
| Deezer | 🟢 Low |
| SoundCloud | 🟢 Low |

### Phase 7: Advanced Features
*Goal: Power user features*

| Task | Priority |
|------|----------|
| Scrobbling (Last.fm / ListenBrainz) | 🟠 Medium |
| Statistics Dashboard | 🟠 Medium |
| Smart Playlists (rule-based) | 🟠 Medium |
| Plugin System | 🟢 Low |
| Mobile Companion App | 🟢 Low |
| Multi-room Audio | 🟢 Low |

---

## Technical Architecture

### Frontend Stack
- **Framework:** React 19 + TypeScript
- **Styling:** Tailwind CSS 3.4
- **State:** React Context (PlayerContext, ThemeContext)
- **Build:** Vite 7

### Backend Stack
- **Framework:** Tauri v2 (Rust)
- **Audio Decoding:** Symphonia (FLAC, MP3, WAV, OGG, etc.)
- **Audio Output:** CPAL (cross-platform audio)
- **Metadata:** Lofty (ID3, Vorbis Comments)
- **Threading:** Decoder thread + Output thread architecture
- **Buffer:** Lock-free ring buffer for gapless playback

### Key Files
```
src/
├── context/
│   ├── PlayerContext.tsx  # Playback state, queue, shuffle/repeat
│   └── ThemeContext.tsx   # Theme management
├── hooks/
│   └── useKeyboardShortcuts.ts  # Global keyboard handling
├── components/
│   ├── PlayerBar.tsx      # Floating player controls
│   ├── QueuePanel.tsx     # Queue management overlay
│   ├── MainStage.tsx      # Track grid with context menu
│   ├── Sidebar.tsx        # Navigation + import
│   └── Settings.tsx       # Theme picker

src-tauri/src/
├── lib.rs         # Tauri plugin registration
├── commands.rs    # Tauri commands (import, playback)
├── audio.rs       # Audio engine (decoder, buffer, output)
```

---

## Getting Started

```bash
# Install dependencies
bun install

# Development
bun tauri dev

# Build for production
bun tauri build
```

---

## Contributing

1. Pick a task from the roadmap
2. Create a feature branch
3. Implement with tests
4. Submit a PR

---

*Last updated: December 2024*
