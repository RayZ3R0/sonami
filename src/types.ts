
export interface Track {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    cover_image?: string;
    path: string;
    /** Unix timestamp when added to playlist (optional) */
    added_at?: number;
    /** Track source: LOCAL, TIDAL, SUBSONIC, or JELLYFIN */
    source?: "LOCAL" | "TIDAL" | "SUBSONIC" | "JELLYFIN";
    /** Provider ID for external tracks */
    provider_id?: string;
    /** External ID from the provider */
    external_id?: string;

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

export interface Artist {
    id: string;
    name: string;
    cover_url?: string;
    banner?: string;
}

export interface Album {
    id: string;
    title: string;
    artist: string;
    artist_id?: string;
    cover_url?: string;
    year?: string;
    track_count?: number;
    duration?: number;
}
