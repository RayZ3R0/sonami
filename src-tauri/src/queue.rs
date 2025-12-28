use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RepeatMode {
    Off,
    All,
    One,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration: u64,
    pub cover_image: Option<String>,
    pub path: String,
}

pub struct PlayQueue {
    pub tracks: Vec<Track>, // Made public for commands access
    shuffled_indices: Vec<usize>,
    current_index: Option<usize>, // Index into `tracks` (or `shuffled_indices` if shuffled)
    queue: VecDeque<Track>,       // Manual user queue
    pub shuffle: bool,
    pub repeat: RepeatMode,
}

impl PlayQueue {
    pub fn new() -> Self {
        Self {
            tracks: Vec::new(),
            shuffled_indices: Vec::new(),
            current_index: None,
            queue: VecDeque::new(),
            shuffle: false,
            repeat: RepeatMode::Off,
        }
    }

    pub fn set_tracks(&mut self, tracks: Vec<Track>) {
        self.tracks = tracks;
        if self.shuffle {
            self.reshuffle();
        }
        self.current_index = if self.tracks.is_empty() {
            None
        } else {
            Some(0)
        };
    }

    pub fn add_to_queue(&mut self, track: Track) {
        self.queue.push_back(track);
    }

    pub fn clear_queue(&mut self) {
        self.queue.clear();
    }

    pub fn toggle_shuffle(&mut self) {
        let current_track = self.get_current_track();
        self.shuffle = !self.shuffle;

        if self.shuffle {
            self.reshuffle();
        }

        // Restore current index to point to the currently playing track
        if let Some(track) = current_track {
            if let Some(idx) = self.tracks.iter().position(|t| t.path == track.path) {
                if self.shuffle {
                    if let Some(shuffled_pos) = self
                        .shuffled_indices
                        .iter()
                        .position(|&real_idx| real_idx == idx)
                    {
                        self.current_index = Some(shuffled_pos);
                    }
                } else {
                    self.current_index = Some(idx);
                }
            }
        } else {
            self.current_index = if self.tracks.is_empty() {
                None
            } else {
                Some(0)
            };
        }
    }

    fn reshuffle(&mut self) {
        let mut rng = rand::rng();
        self.shuffled_indices = (0..self.tracks.len()).collect();
        self.shuffled_indices.shuffle(&mut rng);
    }

    pub fn get_next_track(&mut self, manual_skip: bool) -> Option<Track> {
        if let Some(track) = self.queue.pop_front() {
            return Some(track);
        }

        if !manual_skip && self.repeat == RepeatMode::One {
            if let Some(idx) = self.current_index {
                if let Some(track) = self.get_track_at(idx) {
                    return Some(track);
                }
            }
        }

        let next_idx = match self.current_index {
            Some(idx) => idx + 1,
            None => 0,
        };

        if next_idx >= self.tracks.len() {
            if self.repeat == RepeatMode::All {
                self.current_index = Some(0);
                return self.get_track_at(0);
            } else {
                return None;
            }
        }

        self.current_index = Some(next_idx);
        self.get_track_at(next_idx)
    }

    pub fn get_prev_track(&mut self) -> Option<Track> {
        if self.tracks.is_empty() {
            return None;
        }

        let prev_idx = match self.current_index {
            Some(idx) => {
                if idx == 0 {
                    if self.repeat == RepeatMode::All {
                        self.tracks.len() - 1
                    } else {
                        0
                    }
                } else {
                    idx - 1
                }
            }
            None => 0,
        };

        self.current_index = Some(prev_idx);
        self.get_track_at(prev_idx)
    }

    fn get_track_at(&self, index: usize) -> Option<Track> {
        if self.shuffle {
            let real_index = self.shuffled_indices.get(index)?;
            self.tracks.get(*real_index).cloned()
        } else {
            self.tracks.get(index).cloned()
        }
    }

    pub fn get_current_track(&self) -> Option<Track> {
        self.current_index.and_then(|idx| self.get_track_at(idx))
    }

    /// Peek at the next track without advancing the queue index
    pub fn peek_next_track(&self) -> Option<Track> {
        // Check manual queue first
        if let Some(track) = self.queue.front() {
            return Some(track.clone());
        }

        // For Repeat One, return the current track
        if self.repeat == RepeatMode::One {
            return self.get_current_track();
        }

        // Calculate next index without modifying state
        let next_idx = match self.current_index {
            Some(idx) => idx + 1,
            None => 0,
        };

        if next_idx >= self.tracks.len() {
            if self.repeat == RepeatMode::All {
                return self.get_track_at(0);
            } else {
                return None;
            }
        }

        self.get_track_at(next_idx)
    }

    pub fn play_track_by_path(&mut self, path: &str) {
        // Find index of track with this path
        if let Some(index) = self.tracks.iter().position(|t| t.path == path) {
            // Check if we are in shuffle mode
            if self.shuffle {
                if let Some(shuffled_pos) = self
                    .shuffled_indices
                    .iter()
                    .position(|&real_idx| real_idx == index)
                {
                    self.current_index = Some(shuffled_pos);
                }
            } else {
                self.current_index = Some(index);
            }
        }
    }
}
