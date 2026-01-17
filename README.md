<div align="center">

# Sonami


[![Version](https://img.shields.io/github/v/tag/RayZ3R0/sonami?style=flat-square&label=version&color=blue)](https://github.com/RayZ3R0/sonami/tags)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-informational?style=flat-square)](https://github.com/RayZ3R0/sonami/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/RayZ3R0/sonami/ci.yml?branch=main&style=flat-square&logo=github)](https://github.com/RayZ3R0/sonami/actions)
[![License](https://img.shields.io/github/license/RayZ3R0/sonami?style=flat-square)](LICENSE)
[![AUR Version](https://img.shields.io/aur/version/sonami-bin?style=flat-square&logo=arch-linux&color=1793D1)](https://aur.archlinux.org/packages/sonami-bin)

[![Roadmap](https://img.shields.io/badge/Roadmap-View_Progress-8A2BE2?style=flat-square&logo=github)](https://github.com/users/RayZ3R0/projects/1)
[![Open Issues](https://img.shields.io/github/issues/RayZ3R0/sonami?style=flat-square)](https://github.com/RayZ3R0/sonami/issues)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/RayZ3R0/sonami?style=flat-square)](https://github.com/RayZ3R0/sonami/commits/main)

<a href="https://github.com/RayZ3R0/sonami/stargazers">
  <img src="https://img.shields.io/github/stars/RayZ3R0/sonami?style=social" alt="GitHub stars">
</a>

<p align="center">
  <b>A lightweight, cross-platform music player built with Tauri. Stream lossless FLAC audio from Tidal, and import playlists from Spotify with no track limit.</b>
</p>

<!-- VISUAL SHOWCASE START -->
<br />
<img src="https://i.imgur.com/v6ok5h4.png" alt="Sonami Immersive Mode" width="100%">
<br />

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://i.imgur.com/VQBFpVY.png" alt="Home Page" width="100%">
      <br><sub><b>Home Dashboard</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="https://i.imgur.com/N2oeIAC.png" alt="Queue Management" width="100%">
      <br><sub><b>Contextual Queue Panel</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="https://i.imgur.com/1lZT7RP.png" alt="Playlist View" width="100%">
      <br><sub><b>Playlist Management</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="https://i.imgur.com/h0mYSWx.png" alt="Liked Songs" width="100%">
      <br><sub><b>Liked Songs Library</b></sub>
    </td>
  </tr>
</table>

<p><b>Seamless Spotify Integration</b></p>

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://i.imgur.com/87i2T70.png" alt="Import Step 1" width="100%">
      <br><sub><b>1. Click the plus icon on Playlists</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="https://i.imgur.com/hbDBIe5.png" alt="Import Step 2" width="100%">
      <br><sub><b>2. Paste the playlist URL</b></sub>
    </td>
    </tr>
    <tr>
    <td align="center" width="50%">
      <img src="https://i.imgur.com/F3EogQF.png" alt="Import Step 2" width="100%">
      <br><sub><b>3. Wait for import</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="https://i.imgur.com/21paI5x.png" alt="Import Step 2" width="100%">
      <br><sub><b>4. Select tracks to import</b></sub>
    </td>
  </tr>
</table>
<!-- VISUAL SHOWCASE END -->

</div>

---

> [!WARNING]
> **Alpha Status**: This project is in early alpha (v0.1.x). Core functionality is still under development and breaking changes may occur.


## Core Capabilities

### Library and Integration
*   **Spotify Integration**: Deep integration for importing playlists and managing external libraries as a guest.
*   **Tidal Integration**: Extremely fast high-fidelity streaming support.
*   **Rich Lyrics Engine**: Multi-provider support (LRC Lib, Netease) with precise synchronization.
*   **Discord Presence**: Real-time Spotify-style status updates shared via Discord Rich Presence.

### Premium Audio Experience
*   **Direct Audio Control**: Built upon Symphonia and CPAL for low-level audio decoding and playback precision.
*   **Resilient Streaming**: Implements advanced prefetching and smart seek algorithms for uninterrupted playback over unstable network conditions.
*   **High-Quality Resampling**: Utilizes the Rubato library for professional-grade sample rate conversion.
*   **Gapless Transition**: Engineered for seamless track transitions to maintain listeners' immersion.

### Immersive Visual Design
*   **Fluid Interface**: Modern glassmorphism aesthetics combined with dynamic layout transitions.
*   **Dynamic Theming**: Real-time color extraction from album artwork to create a harmonized visual environment.
*   **Immersive Fullscreen**: A dedicated playback view featuring high-fidelity synchronized lyrics and fluid background animations.
*   **Responsive Mini-Player**: A draggable, snappable mini-interface for compact desktop control.


## Installation

Download the latest release for your platform from the [**Releases Page**](https://github.com/RayZ3R0/sonami/releases).

| Platform | Supported Formats |
|:---------|:------------------|
| **Windows** | `.msi`, `.exe` |
| **macOS** | `.dmg` |
| **Linux** | `.deb`, `.rpm`, `.AppImage`, `AUR` |

### Arch Linux (AUR)

You can install Sonami from the AUR using your favorite AUR helper:

```bash
# Using yay
yay -S sonami-bin

# Using paru
paru -S sonami-bin
```

## Development

### Prerequisites

*   [Rust](https://rustup.rs/) (Latest Stable)
*   [Bun](https://bun.sh/) (or Node.js/pnpm)
*   **Linux Dependencies:**
    ```bash
    sudo apt-get install libwebkit2gtk-4.1-dev librsvg2-dev libayatana-appindicator3-dev libasound2-dev
    ```

### Build Commands

```bash
# Install dependencies
bun install

# Run in Development Mode (Hot Reload)
bun tauri dev

# Build for Production
bun tauri build
```

## Technology Stack

### Backend Infrastructure (Rust)
*   **Runtime**: Tauri v2 for secure, lightweight host-frontend communication.
*   **Audio Pipeline**: Symphonia (Decoding), CPAL (Output), Rubato (SRC).
*   **Persistence**: SQLite managed via SQLx with a custom automated migration system.
*   **Interoperability**: Souvlaki for cross-platform system media controls (MPRIS/SMTC).
*   **Metadata**: Custom Romanization engine for accurate Japanese metadata representation.

### Frontend Environment (React)
*   **Core**: React 19 and TypeScript for a type-safe, declarative user interface.
*   **State Management**: TanStack React Query for sophisticated data synchronization and caching.
*   **Styling**: Tailwind CSS for responsive and consistent design utility.
*   **Efficiency**: Asset preloading and deferred execution strategies for optimal performance.

### Disclaimer

This project is intended **solely for private and educational purposes**. The developer neither supports nor promotes copyright infringement.

**Sonami** is an independent third-party application and has no affiliation with, endorsement from, or association with Spotify, Tidal, or any other streaming platform.

By using this software, you acknowledge that you are fully responsible for:

1. Complying with all applicable local laws and regulations.
2. Reviewing and following the Terms of Service of any platforms involved.
3. Any legal or other consequences resulting from improper or unlawful use.

The software is provided **“as is”**, without any warranties or guarantees. The author accepts no responsibility for account bans, damages, or legal issues that may arise from its use.

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.