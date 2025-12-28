
## 📋 Project Analysis: Sonami

### Current Architecture Overview

**Frontend (React + TypeScript + Tailwind CSS):**
- App.tsx - Root component with `ThemeProvider` and `PlayerProvider` contexts
- AppLayout.tsx - Main layout with TitleBar, Sidebar, MainStage, and PlayerBar
- PlayerContext.tsx - Manages playback state, track list, and communicates with Rust backend via Tauri `invoke`
- ThemeContext.tsx - Comprehensive theming system with 915+ lines of theme definitions (Catppuccin, Nord, Dracula, etc.)
- MainStage.tsx - Grid display of imported tracks
- PlayerBar.tsx - Floating player with seek, volume, playback controls
- Sidebar.tsx - Navigation with hardcoded playlist placeholders
- TitleBar.tsx - Custom window controls (cross-platform macOS/Windows/Linux)
- Settings.tsx - Theme selection panel

**Backend (Rust + Tauri v2):**
- lib.rs - Tauri plugin registration and command handlers
- commands.rs - Tauri commands for file import, playback control
- audio.rs - **Core audio engine** using:
  - `symphonia` for decoding (FLAC, MP3, WAV, Vorbis, etc.)
  - `cpal` for low-level audio output
  - Custom ring buffer for gapless playback
  - Decoder thread + output thread architecture
  - `lofty` for metadata extraction (ID3, Vorbis comments, etc.)

### What Currently Works
| Feature | Status |
|---------|--------|
| Import single audio file | ✅ Working |
| Metadata extraction (title, artist, album, cover) | ✅ Working |
| Play/Pause/Resume | ✅ Working |
| Seek with visual feedback | ✅ Working |
| Volume control | ✅ Working |
| Next/Previous track | ✅ Working |
| Gapless playback queue | ✅ Working |
| Theme system (20+ themes) | ✅ Working |
| Custom titlebar | ✅ Working |
| Cross-platform window controls | ✅ Working |

### Current Gaps
- No folder/library import (only single file)
- No playlists (hardcoded dummy data)
- No search functionality
- No shuffle/repeat modes
- No persistent library (state lost on reload)
- No equalizer or audio effects
- No keyboard shortcuts
- No media key support
- No system tray
- No streaming integration (future goal)

---

## 🗺️ Development Roadmap

### **Phase 1: Core Player Polish** (Foundation)
*Goal: Complete the local playback experience*

| Task | Description | Priority |
|------|-------------|----------|
| **Folder Import** | Allow importing entire directories recursively | 🔴 High |
| **Persistent Library** | Store library in local JSON/SQLite database | 🔴 High |
| **Shuffle Mode** | Random playback order | 🟠 Medium |
| **Repeat Modes** | Repeat one, repeat all, repeat off | 🟠 Medium |
| **Keyboard Shortcuts** | Space (play/pause), arrows, media keys | 🟠 Medium |
| **Queue Management** | View/edit upcoming tracks | 🟠 Medium |
| **Track Duration in List** | Show duration on track cards | 🟢 Low |

### **Phase 2: Library & Organization**
*Goal: Rich library management*

| Task | Description | Priority |
|------|-------------|----------|
| **Album/Artist Views** | Group tracks by album or artist | 🔴 High |
| **Playlist System** | Create, edit, delete playlists | 🔴 High |
| **Search** | Real-time search across library | 🔴 High |
| **Sorting** | Sort by title, artist, date added, etc. | 🟠 Medium |
| **Favorites/Likes** | Mark tracks as favorites | 🟠 Medium |
| **Recently Played** | Track listening history | 🟠 Medium |
| **Now Playing Queue View** | Full-screen queue management | 🟠 Medium |

### **Phase 3: Enhanced Audio Features**
*Goal: Audiophile-grade features*

| Task | Description | Priority |
|------|-------------|----------|
| **Equalizer** | 10-band EQ with presets | 🟠 Medium |
| **Crossfade** | Smooth transitions between tracks | 🟠 Medium |
| **Normalization** | Replay gain / volume leveling | 🟠 Medium |
| **Audio Output Selection** | Choose output device | 🔴 High |
| **Waveform Visualization** | Visual waveform display | 🟢 Low |
| **Lyrics Display** | Embedded or fetched lyrics | 🟢 Low |

### **Phase 4: System Integration**
*Goal: Native OS integration*

| Task | Description | Priority |
|------|-------------|----------|
| **System Tray** | Minimize to tray, tray controls | 🔴 High |
| **MPRIS (Linux)** | Media key & notification integration | 🔴 High |
| **Windows Media Controls** | System media overlay | 🔴 High |
| **macOS Now Playing** | Control Center integration | 🔴 High |
| **File Associations** | Open audio files directly | 🟠 Medium |
| **Discord Rich Presence** | Show now playing in Discord | 🟢 Low |

### **Phase 5: Streaming Preparation**
*Goal: Architecture for streaming backends*

| Task | Description | Priority |
|------|-------------|----------|
| **Abstract Data Layer** | Unified interface for local/streaming | 🔴 High |
| **Authentication System** | OAuth flows for streaming services | 🔴 High |
| **Streaming Service Trait** | Rust trait for providers | 🔴 High |
| **Mixed Queue Support** | Queue local + streaming tracks | 🟠 Medium |
| **Offline Caching** | Download for offline playback | 🟠 Medium |

### **Phase 6: Streaming Integration**
*Goal: Connect to streaming services*

| Task | Description | Priority |
|------|-------------|----------|
| **Provider Plugin System** | Modular provider architecture | 🔴 High |
| **Spotify Connect** | Spotify playback (if API permits) | 🔴 High |
| **Tidal Integration** | High-res streaming | 🟠 Medium |
| **YouTube Music** | Alternative provider | 🟠 Medium |
| **Deezer Integration** | Additional provider | 🟢 Low |
| **SoundCloud** | Free tier streaming | 🟢 Low |

### **Phase 7: Advanced Features**
*Goal: Power user features*

| Task | Description | Priority |
|------|-------------|----------|
| **Scrobbling** | Last.fm / ListenBrainz | 🟠 Medium |
| **Statistics Dashboard** | Listening analytics | 🟠 Medium |
| **Smart Playlists** | Rule-based auto playlists | 🟠 Medium |
| **Plugin System** | User-extensible plugins | 🟢 Low |
| **Mobile Companion** | Remote control from phone | 🟢 Low |
| **Multi-room Audio** | Cast to multiple devices | 🟢 Low |

---