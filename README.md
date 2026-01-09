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
  <b>A lightweight, cross-platform music player built with Tauri, React, and Rust.</b>
</p>

</div>

---

> [!WARNING]
> **Alpha Status**: This project is in early alpha (v0.1.x). Core functionality is still under development and breaking changes may occur.

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

## Tech Stack

*   **Frontend**: React, TypeScript, Tailwind CSS
*   **Backend**: Rust, Tauri v2
*   **Audio Engine**: Symphonia, CPAL

## License

Distributed under the AGPL-3.0 License. See [LICENSE](LICENSE) for more information.
