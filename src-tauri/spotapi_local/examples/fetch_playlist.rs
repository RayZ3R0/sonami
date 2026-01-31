use spotapi::PublicPlaylist;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let playlist_url = "https://open.spotify.com/playlist/37i9dQZF1DX6ujZpAN0v9r";
    println!("Fetching playlist: {}", playlist_url);

    let mut playlist = PublicPlaylist::new(playlist_url);
    let tracks = playlist.get_tracks().await?;

    println!("Total tracks fetched: {}", tracks.len());

    if !tracks.is_empty() {
        if let Some(first_track) = tracks.first() {
            let name = first_track
                .get("itemV2")
                .and_then(|i| i.get("data"))
                .and_then(|d| d.get("name"))
                .and_then(|n| n.as_str())
                .unwrap_or("Unknown");
            println!("First track: {}", name);
        }
        if let Some(last_track) = tracks.last() {
            let name = last_track
                .get("itemV2")
                .and_then(|i| i.get("data"))
                .and_then(|d| d.get("name"))
                .and_then(|n| n.as_str())
                .unwrap_or("Unknown");
            println!("Last track: {}", name);
        }
    }

    if tracks.len() > 100 {
        println!("SUCCESS: Fetched more than 100 tracks!");
    } else {
        println!("WARNING: Fetched fewer than 100 tracks. Pagination might be broken.");
    }

    Ok(())
}
