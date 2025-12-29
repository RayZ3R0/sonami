# Changelog

All notable changes to Sonami will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Features in development for the next release

### Changed
- Changes in development for the next release

### Fixed
- Bug fixes in development for the next release

---

## [0.1.0-alpha.13] - 2024-12-29

### Added
- Feature: **Player Bar Style Toggle** in Settings > Appearance.
  - **Floating Mode**: Centered, rounded, modern glass-morphism style (Original).
  - **Classic Mode**: Full-width, square, fixed-bottom style for a more traditional layout.
- Implemented persistent storage for Player Bar preference across sessions.

- Fullscreen: Implemented a draggable floating mini-player with an enhanced glass-morphism style (intense backdrop blur and improved visuals).
  - Mini-player supports click-and-drag positioning inside the fullscreen view and includes a subtle drag handle.
  - Position is persisted across sessions using localStorage (key: `spotist-fullscreen-mini-player-position`) with validation and safe fallbacks.
  - Double-clicking the mini-player resets it to a sensible default position.
  - Dragging is constrained to viewport bounds and window-resize handling keeps the mini-player visible.
  - Improved error handling around persistence so corrupted or out-of-range values fall back to defaults.
  - **Bottom-snap feature**: Drag the mini-player to the bottom of the screen to transform it into a full-width Spotify-style player bar.
    - Smart snap zone detection with visual feedback (glowing indicator) prevents accidental triggering.
    - Seamless transition between mini and full-width modes with proper horizontal layout.
    - Full-width mode features three-section design: track info (left), progress bar (center), controls (right).
    - Drag upward from full-width mode to return to mini-player format.
    - Vinyl disc indicator is hidden in full-width mode for cleaner appearance.

### Fixed
- Fixed a persistent white top border on the Player Bar in Classic mode.
- Corrected layout logic to ensure the Player Bar never overlaps the Sidebar or Queue Sidebar in Classic mode.

- Toned down excessive shadow intensity for the mini-player (hover and dragging states) to avoid overpowering the UI.

---

## [0.1.0-alpha.12] - 2024-12-29

### Added
- Implemented real lyrics support with automatic fetching from metadata and local files.
- Added support for synchronized (`.lrc`) and unsynchronized (`.txt`, metadata) lyrics.
- Implemented auto-scrolling and active line highlighting for synchronized lyrics.
- Added robust fallback logic for playing tracks with no lyrics.

### Fixed
- Fixed visual glitch where seeking while paused would momentarily revert to the old timestamp.
- Implemented robust latching logic for seek updates to ensure stability even with backend delays.

## [0.1.0-alpha.11] - 2024-12-29

### Fixed
- Removed broken lyrics karaoke effect that randomly dimmed letters in words
- Improved active lyric glow effect with smoother, multi-layered text shadow
- Fixed lyrics scroll lag by throttling scroll updates and using React's `startTransition`
- Added wrapper container to prevent glow clipping on lyrics

### Changed
- Enhanced lyric line transitions with subtle scale transform for smoother pop-out effect
- Optimized lyric index calculation to prevent unnecessary re-renders

---

## [0.1.0-alpha.1] - 2024-12-28

### Added
- Initial alpha release
- Music file import with metadata extraction (title, artist, album, cover art)
- Audio playback engine using Symphonia and CPAL
- Play, pause, resume, and seek functionality
- Volume control
- Gapless playback support with track queuing
- Modern UI with custom title bar
- Cross-platform support (Windows, macOS, Linux)

### Known Issues
- This is an early alpha release - expect bugs and incomplete features
- Performance optimizations are ongoing

---

## Versioning Guide

This project uses [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API/breaking changes
- **MINOR** version for new features (backwards compatible)
- **PATCH** version for bug fixes (backwards compatible)

### Pre-release Labels

- `alpha` - Early development, expect breaking changes
- `beta` - Feature complete, bug fixing phase
- `rc` - Release candidate, final testing

### Examples

- `0.1.0-alpha.1` → First alpha of 0.1.0
- `0.1.0-alpha.2` → Second alpha (fixes/updates)
- `0.1.0-beta.1` → First beta of 0.1.0
- `0.1.0-rc.1` → Release candidate
- `0.1.0` → Stable release

[Unreleased]: https://github.com/z3r0/sonami/compare/v0.1.0-alpha.13...HEAD
[0.1.0-alpha.13]: https://github.com/z3r0/sonami/compare/v0.1.0-alpha.12...v0.1.0-alpha.13
[0.1.0-alpha.12]: https://github.com/z3r0/sonami/compare/v0.1.0-alpha.11...v0.1.0-alpha.12
[0.1.0-alpha.11]: https://github.com/z3r0/sonami/compare/v0.1.0-alpha.1...v0.1.0-alpha.11
[0.1.0-alpha.1]: https://github.com/z3r0/sonami/releases/tag/v0.1.0-alpha.1
