/// Proof of Concept: Test Spotify search via spotapi
/// 
/// This example verifies that SpotifySearch works for finding
/// artist radio playlists - the core of the discovery feature.
/// 
/// Usage: cargo run --example spotapi_search

use spotapi::SpotifySearch;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== SpotAPI Search PoC ===\n");

    let mut search = SpotifySearch::new();
    
    // Test 1: Search for playlists
    println!("1. Searching playlists for 'Daft Punk Radio'...");
    match search.playlists("Daft Punk Radio", 5).await {
        Ok(playlists) => {
            println!("   ✓ Found {} playlists:", playlists.len());
            for p in playlists.iter().take(3) {
                println!("     - {} by {} ({})", p.name, p.owner_name, p.uri);
            }
        }
        Err(e) => println!("   ✗ Failed: {}", e),
    }

    println!();

    // Test 2: Search for tracks
    println!("2. Searching tracks for 'Get Lucky Daft Punk'...");
    match search.tracks("Get Lucky Daft Punk", 5).await {
        Ok(tracks) => {
            println!("   ✓ Found {} tracks:", tracks.len());
            for t in tracks.iter().take(3) {
                println!("     - {} by {} ({}ms)", t.name, t.artists.join(", "), t.duration_ms);
            }
        }
        Err(e) => println!("   ✗ Failed: {}", e),
    }

    println!();

    // Test 3: Artist Radio (THE KEY FEATURE)
    println!("3. Finding artist radio for 'Daft Punk'...");
    match search.artist_radio("Daft Punk").await {
        Ok(Some(uri)) => {
            println!("   ✓ Found radio playlist: {}", uri);
            
            // Bonus: Fetch tracks from the radio
            println!("\n   Fetching tracks from radio playlist...");
            let mut playlist = spotapi::PublicPlaylist::new(&uri);
            match playlist.get_tracks().await {
                Ok(tracks) => {
                    println!("   ✓ Radio has {} tracks. First 5:", tracks.len());
                    for track in tracks.iter().take(5) {
                        let name = track
                            .get("itemV2")
                            .and_then(|i| i.get("data"))
                            .and_then(|d| d.get("name"))
                            .and_then(|n| n.as_str())
                            .unwrap_or("Unknown");
                        let artists = track
                            .get("itemV2")
                            .and_then(|i| i.get("data"))
                            .and_then(|d| d.get("artists"))
                            .and_then(|a| a.get("items"))
                            .and_then(|i| i.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|a| a.get("profile")?.get("name")?.as_str())
                                    .collect::<Vec<_>>()
                                    .join(", ")
                            })
                            .unwrap_or_default();
                        println!("     - {} by {}", name, artists);
                    }
                }
                Err(e) => println!("   ✗ Failed to fetch tracks: {}", e),
            }
        }
        Ok(None) => println!("   ✗ No radio playlist found for this artist"),
        Err(e) => println!("   ✗ Failed: {}", e),
    }

    println!("\n=== PoC Complete ===");
    Ok(())
}
