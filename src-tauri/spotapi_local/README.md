# SpotAPI - Rust

A professional Rust crate that mimics the functionality of the Python SpotAPI package, specifically focused on fetching Spotify playlist metadata and tracks seamlessly handled via guest authentication.

## Features

- **Guest Authentication**: Automatically handles guest token generation and session management.
- **Playlist Fetching**: Retrieval of detailed playlist metadata.
- **Pagination Support**: Automatically handles pagination to fetch all tracks in a playlist, regardless of size.
- **Dynamic Analysis**: robustly analyzes Spotify's web player to ensure compatibility with API changes.

## Installation

Add this to your `Cargo.toml`:

```toml
[dependencies]
spotapi = "0.1.0"
```

## Usage

Here is a simple example of how to fetch all tracks from a playlist:

```rust
use spotapi::PublicPlaylist;
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let playlist_url = "https://open.spotify.com/playlist/37i9dQZF1DX6ujZpAN0v9r";
    let mut playlist = PublicPlaylist::new(playlist_url);

    // Fetch all tracks (handles pagination automatically)
    let tracks = playlist.get_tracks().await?;

    println!("Fetched {} tracks.", tracks.len());

    if let Some(first) = tracks.first() {
        println!("First track data: {:?}", first);
    }

    Ok(())
}
```

## Disclaimer

This library is intended for educational purposes. It interacts with Spotify's private API. Use responsibly and in accordance with Spotify's terms of service.
