use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct AuthenticationResult {
    pub user: JellyfinUser,
    pub access_token: String,
    pub server_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct JellyfinUser {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ItemsResult {
    pub items: Vec<BaseItemDto>,
    pub total_record_count: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct BaseItemDto {
    pub id: String,
    pub name: String,
    #[serde(rename = "Type")]
    pub item_type: String,
    pub album: Option<String>,
    pub album_id: Option<String>,
    pub album_artist: Option<String>,
    pub artists: Option<Vec<String>>,
    pub artist_items: Option<Vec<NameIdPair>>,
    pub run_time_ticks: Option<u64>,
    pub production_year: Option<u32>,
    pub index_number: Option<u32>,
    pub parent_index_number: Option<u32>,
    pub image_tags: Option<ImageTags>,
    pub primary_image_aspect_ratio: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct NameIdPair {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ImageTags {
    pub primary: Option<String>,
}

impl BaseItemDto {
    pub fn ticks_to_seconds(&self) -> u64 {
        self.run_time_ticks.unwrap_or(0) / 10_000_000
    }

    pub fn primary_artist(&self) -> String {
        if let Some(ref artists) = self.artists {
            if let Some(first) = artists.first() {
                return first.clone();
            }
        }
        if let Some(ref album_artist) = self.album_artist {
            return album_artist.clone();
        }
        String::new()
    }

    pub fn primary_artist_id(&self) -> Option<String> {
        self.artist_items.as_ref()
            .and_then(|items| items.first())
            .map(|item| item.id.clone())
    }
}
