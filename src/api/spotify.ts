import { invoke } from "@tauri-apps/api/core";

export interface SpotifyTrack {
    title: string;
    artist: string;
    album?: string;
    duration_ms?: number;
    spotify_id?: string;
}

export interface SpotifyPlaylistInfo {
    name: string;
    description?: string;
    image_url?: string;
    track_count: number;
}

export interface SpotifyPlaylistResult {
    info: SpotifyPlaylistInfo;
    tracks: SpotifyTrack[];
}

export interface VerifiedSpotifyTrack {
    spotify: SpotifyTrack;
    found: boolean;

    // Provider-agnostic fields (new)
    provider_id?: string;    // "tidal", "subsonic", "jellyfin"
    external_id?: string;    // Provider-specific track ID
    artist_id?: string;      // Provider-specific artist ID
    album_id?: string;       // Provider-specific album ID
    album_name?: string;     // Album title from matched provider
    cover_url?: string;
    used_romanization: boolean;
    status_message?: string;

    // Legacy fields for backward compatibility (will be removed)
    tidal_id?: number;
    tidal_artist_id?: number;
    tidal_album_id?: number;
    tidal_album?: string;
}

export interface VerificationProgress {
    current: number;
    total: number;
    current_track: string;
    found_count: number;
}

export interface AddTracksResult {
    added: number;
    skipped: number;
    errors?: string[];
}

export interface CreatePlaylistResult {
    playlist_id: string;
    playlist_title: string;
    tracks_added: number;
    tracks_skipped: number;
    errors?: string[];
}

/**
 * Extract playlist ID from various Spotify URL formats
 */
export function extractPlaylistId(urlOrId: string): string | null {
    const trimmed = urlOrId.trim();


    if (trimmed.startsWith("spotify:playlist:")) {
        return trimmed.replace("spotify:playlist:", "");
    }


    if (trimmed.includes("open.spotify.com/playlist/")) {
        const match = trimmed.match(/playlist\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    }


    if (trimmed.length === 22 && /^[a-zA-Z0-9]+$/.test(trimmed)) {
        return trimmed;
    }

    return null;
}

/**
 * Validate a Spotify playlist URL
 */
export function isValidSpotifyUrl(url: string): boolean {
    return extractPlaylistId(url) !== null;
}

/**
 * Fetch a Spotify playlist by URL or ID
 */
export async function fetchSpotifyPlaylist(urlOrId: string): Promise<SpotifyPlaylistResult> {
    return await invoke<SpotifyPlaylistResult>("fetch_spotify_playlist", { urlOrId });
}

/**
 * Verify a single Spotify track against Tidal
 */
export async function verifySpotifyTrack(
    title: string,
    artist: string
): Promise<VerifiedSpotifyTrack> {
    return await invoke<VerifiedSpotifyTrack>("verify_spotify_track", { title, artist });
}

/**
 * Verify multiple Spotify tracks against Tidal
 */
export async function verifySpotifyTracks(
    tracks: SpotifyTrack[]
): Promise<VerifiedSpotifyTrack[]> {
    return await invoke<VerifiedSpotifyTrack[]>("verify_spotify_tracks", { tracks });
}

/**
 * Add verified Spotify tracks to an existing playlist
 */
export async function addSpotifyTracksToPlaylist(
    playlistId: string,
    tracks: VerifiedSpotifyTrack[]
): Promise<AddTracksResult> {
    return await invoke<AddTracksResult>("add_spotify_tracks_to_playlist", {
        playlistId,
        tracks,
    });
}

/**
 * Create a new playlist from verified Spotify tracks
 */
export async function createPlaylistFromSpotify(
    name: string,
    description: string | undefined,
    tracks: VerifiedSpotifyTrack[]
): Promise<CreatePlaylistResult> {
    return await invoke<CreatePlaylistResult>("create_playlist_from_spotify", {
        name,
        description,
        tracks,
    });
}

/**
 * Format duration from milliseconds to MM:SS
 */
export function formatDuration(ms?: number): string {
    if (!ms) return "--:--";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
