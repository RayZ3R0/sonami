-- Artists
CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tidal_id INTEGER,
    cover_url TEXT
);

-- Albums
CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    cover_url TEXT,
    release_date TEXT,
    tidal_id INTEGER,
    FOREIGN KEY(artist_id) REFERENCES artists(id)
);

-- Tracks
CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    artist_id TEXT NOT NULL,
    album_id TEXT,
    duration INTEGER NOT NULL,
    source_type TEXT NOT NULL, -- 'LOCAL' or 'TIDAL'
    file_path TEXT,
    file_modified INTEGER,
    tidal_id INTEGER,
    FOREIGN KEY(artist_id) REFERENCES artists(id),
    FOREIGN KEY(album_id) REFERENCES albums(id)
);

-- Search Index
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    track_id UNINDEXED, 
    title, 
    artist, 
    album, 
    tokenize='porter'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_tidal_id ON tracks(tidal_id);
CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id);
