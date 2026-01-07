
export interface Track {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    cover_image?: string;
    path: string;
}

export interface PlayerState {
    currentTrack: Track | null;
    isPlaying: boolean;
    queue: Track[];
}

export interface Playlist {
    id: string;
    title: string;
    description?: string;
    cover_url?: string;
    created_at: string;
    updated_at: string;
    // Tracks are not always present in the list view
    tracks?: Track[];
}

export interface PlaylistDetails {
    playlist: Playlist;
    tracks: Track[];
}
