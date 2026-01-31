use crate::utils;
use anyhow::{anyhow, Result};
use reqwest::Client;

#[derive(Clone)]
pub struct HashFinder {
    raw_hashes: String,
}

impl HashFinder {
    pub fn new() -> Self {
        Self {
            raw_hashes: String::new(),
        }
    }
}

impl Default for HashFinder {
    fn default() -> Self {
        Self::new()
    }
}

impl HashFinder {
    pub async fn get_sha256_hash(&mut self, client: &Client) -> Result<()> {
        let resp = client.get("https://open.spotify.com").send().await?;
        let html = resp.text().await?;

        let js_links = utils::extract_js_links(&html);

        let js_pack = js_links
            .iter()
            .find(|link| link.contains("web-player/web-player") && link.ends_with(".js"))
            .ok_or_else(|| anyhow!("Could not find web-player valid JS link"))?;

        let pack_url = js_pack.clone();

        let resp = client.get(&pack_url).send().await?;
        let js_content = resp.text().await?;

        self.raw_hashes = js_content.clone();

        let (name_map, hash_map) = utils::extract_mappings(&js_content)?;

        let chunks = utils::combine_chunks(&name_map, &hash_map);

        for chunk in chunks {
            let url = format!("https://open.spotifycdn.com/cdn/build/web-player/{}", chunk);
            if let Ok(resp) = client.get(&url).send().await {
                if let Ok(text) = resp.text().await {
                    self.raw_hashes.push_str(&text);
                }
            }
        }

        Ok(())
    }

    pub fn part_hash(&self, name: &str) -> Result<String> {
        let _query_pattern = format!(r#""{}","query","([^"]+)""#, name);
        let _mutation_pattern = format!(r#""{}","mutation","([^"]+)""#, name);

        let search_query = format!("\"{}\",\"query\",\"", name);
        if let Some(idx) = self.raw_hashes.find(&search_query) {
            let start = idx + search_query.len();
            if let Some(end) = self.raw_hashes[start..].find('"') {
                return Ok(self.raw_hashes[start..start + end].to_string());
            }
        }

        let search_mut = format!("\"{}\",\"mutation\",\"", name);
        if let Some(idx) = self.raw_hashes.find(&search_mut) {
            let start = idx + search_mut.len();
            if let Some(end) = self.raw_hashes[start..].find('"') {
                return Ok(self.raw_hashes[start..start + end].to_string());
            }
        }

        Err(anyhow!("Could not find hash for {}", name))
    }
}
