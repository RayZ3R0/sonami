use serde::{Deserialize, Serialize};
use std::time::Duration;
use rand::Rng;

#[derive(Debug, Serialize, Deserialize)]
pub struct NetEaseLyricResponse {
    pub lrc: Option<NetEaseLyricContent>,
    pub tlyric: Option<NetEaseLyricContent>, // Translation
    pub code: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetEaseLyricContent {
    pub lyric: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct NetEaseSearchResponse {
    result: Option<NetEaseSearchResult>,
    code: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct NetEaseSearchResult {
    songs: Option<Vec<NetEaseSong>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct NetEaseSong {
    id: u64,
    name: String,
    artists: Vec<NetEaseArtist>,
    album: NetEaseAlbum,
}

#[derive(Debug, Serialize, Deserialize)]
struct NetEaseArtist {
    name: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct NetEaseAlbum {
    name: String,
}

pub struct NetEaseClient;

impl NetEaseClient {
    fn get_random_china_ip() -> String {
        let mut rng = rand::rng();
        format!("220.181.{}.{}", rng.random_range(0..255), rng.random_range(0..255))
    }

    fn get_client(fake_ip: &str) -> Result<reqwest::Client, String> {
        let headers = {
            let mut h = reqwest::header::HeaderMap::new();
            h.insert("User-Agent", reqwest::header::HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"));
            h.insert("X-Real-IP", reqwest::header::HeaderValue::from_str(fake_ip).map_err(|e| e.to_string())?);
            h.insert("Referer", reqwest::header::HeaderValue::from_static("http://music.163.com/"));
            h
        };

        reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .default_headers(headers)
            .build()
            .map_err(|e| e.to_string())
    }

    pub async fn get_lyrics(title: &str, artist: &str) -> Result<Option<String>, String> {
        let fake_ip = Self::get_random_china_ip();
        let client = Self::get_client(&fake_ip)?;

        log::info!("Fetching NetEase lyrics for: {} - {} (IP: {})", title, artist, fake_ip);

        let search_url = "http://music.163.com/api/search/get";
        let query = format!("{} {}", artist, title);
        
        let params = [
            ("s", query.as_str()),
            ("type", "1"),
            ("offset", "0"),
            ("limit", "5"),
        ];

        let search_resp = client.get(search_url)
            .query(&params)
            .send()
            .await
            .map_err(|e| format!("Search request failed: {}", e))?;

        if !search_resp.status().is_success() {
            log::warn!("NetEase search failed with status: {}", search_resp.status());
            return Ok(None);
        }

        let search_data: NetEaseSearchResponse = search_resp.json().await
            .map_err(|e| format!("Failed to parse search response: {}", e))?;

        let song_id = match search_data.result.and_then(|r| r.songs).and_then(|s| s.into_iter().next().map(|s| s.id)) {
             Some(id) => id,
             None => {
                 log::info!("No NetEase song found for query: {}", query);
                 return Ok(None);
             }
        };

        log::info!("Found NetEase song ID: {}", song_id);

        let lyric_url = "http://music.163.com/api/song/lyric";
        let params = [
            ("id", song_id.to_string()),
            ("lv", "-1".to_string()),
            ("kv", "-1".to_string()),
            ("tv", "-1".to_string()),
        ];

        let lyric_resp = client.get(lyric_url)
            .query(&params)
            .send()
            .await
            .map_err(|e| format!("Lyric request failed: {}", e))?;

        if !lyric_resp.status().is_success() {
            return Ok(None);
        }

        let lyric_data: NetEaseLyricResponse = lyric_resp.json().await
            .map_err(|e| format!("Failed to parse lyric response: {}", e))?;

        if let Some(lrc) = lyric_data.lrc {
            if let Some(text) = lrc.lyric {
                return Ok(Some(text));
            }
        }

        Ok(None)
    }
}
