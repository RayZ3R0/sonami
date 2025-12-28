
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
    name: string;
    tracks: Track[];
    created_at: string;
}
