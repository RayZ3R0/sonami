<div align="center">

# Sonami

<!-- LINE 1: Version, Build Status, License, Platform -->
[![Version](https://img.shields.io/github/v/tag/RayZ3R0/sonami?style=flat-square&label=version&color=blue)](https://github.com/RayZ3R0/sonami/tags)
[![Build Status](https://img.shields.io/github/actions/workflow/status/RayZ3R0/sonami/ci.yml?branch=main&style=flat-square&logo=github)](https://github.com/RayZ3R0/sonami/actions)
[![License](https://img.shields.io/github/license/RayZ3R0/sonami?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-informational?style=flat-square)](https://github.com/RayZ3R0/sonami/releases)

<!-- LINE 2: Activity & Stats -->
[![Last Commit](https://img.shields.io/github/last-commit/RayZ3R0/sonami?style=flat-square)](https://github.com/RayZ3R0/sonami/commits/main)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/RayZ3R0/sonami?style=flat-square)](https://github.com/RayZ3R0/sonami/commits/main)
[![Repo Size](https://img.shields.io/github/repo-size/RayZ3R0/sonami?style=flat-square)](https://github.com/RayZ3R0/sonami)
[![Open Issues](https://img.shields.io/github/issues/RayZ3R0/sonami?style=flat-square)](https://github.com/RayZ3R0/sonami/issues)

<!-- LINE 3: Tech Stack Visuals -->
[![Tauri](https://img.shields.io/badge/Tauri-24C8DB?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-black?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

<!-- Social -->
<br />
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
| **Linux** | `.deb`, `.rpm`, `.AppImage` |

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

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
