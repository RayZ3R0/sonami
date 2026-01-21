use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderId {
    Local,
    Tidal,
    Subsonic,
    Jellyfin,
    Spotify,
}

impl fmt::Display for ProviderId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProviderId::Local => write!(f, "local"),
            ProviderId::Tidal => write!(f, "tidal"),
            ProviderId::Subsonic => write!(f, "subsonic"),
            ProviderId::Jellyfin => write!(f, "jellyfin"),
            ProviderId::Spotify => write!(f, "spotify"),
        }
    }
}

impl FromStr for ProviderId {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "local" => Ok(ProviderId::Local),
            "tidal" => Ok(ProviderId::Tidal),
            "subsonic" => Ok(ProviderId::Subsonic),
            "jellyfin" => Ok(ProviderId::Jellyfin),
            "spotify" => Ok(ProviderId::Spotify),
            _ => Err(format!(
                "Invalid provider: '{}'. Valid: local, tidal, subsonic, jellyfin, spotify",
                s
            )),
        }
    }
}

impl ProviderId {
    pub fn is_streaming(&self) -> bool {
        matches!(
            self,
            ProviderId::Tidal | ProviderId::Subsonic | ProviderId::Jellyfin | ProviderId::Spotify
        )
    }
}
