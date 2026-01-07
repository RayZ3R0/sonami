# Sonami

[![Version](https://img.shields.io/github/v/release/RayZ3R0/sonami?include_prereleases&label=version)](https://github.com/RayZ3R0/sonami/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/RayZ3R0/sonami/ci.yml?branch=main)](https://github.com/RayZ3R0/sonami/actions)
[![License](https://img.shields.io/github/license/RayZ3R0/sonami)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20|%20macOS%20|%20Linux-informational)]()

A lightweight, cross-platform music player built with Tauri, React, and Rust.

> **Warning**: This project is in early alpha. Core functionality is still under development.

## Installation

Download the latest release for your platform from the [Releases](https://github.com/RayZ3R0/sonami/releases) page.

| Platform | Formats |
|----------|---------|
| Windows | `.msi`, `.exe` |
| macOS | `.dmg` |
| Linux | `.deb`, `.rpm`, `.AppImage`, `.tar.gz` |

## Development

### Prerequisites

- [Rust](https://rustup.rs/)
- [Bun](https://bun.sh/)
- Linux: `libwebkit2gtk-4.1-dev librsvg2-dev libayatana-appindicator3-dev libasound2-dev`

### Build

```bash
bun install
bun tauri dev      # Development
bun tauri build    # Production
```

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Rust, Tauri v2
- **Audio**: Symphonia, CPAL

## License

[MIT](LICENSE)
