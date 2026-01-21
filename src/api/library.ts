import { invoke } from "@tauri-apps/api/core";
import { Track } from "../types";

export interface UnifiedTrack extends Track {
    source: 'LOCAL' | 'TIDAL' | 'SUBSONIC' | 'JELLYFIN';
    tidal_id?: number;
    local_path?: string;
    liked_at?: number;
    audio_quality?: string;
    provider_id?: string;
    external_id?: string;
}

export interface LibraryAlbum {
    id: string;
    title: string;
    artist: string;
    cover_image?: string;
    tidal_id?: number;
    provider_id?: string;
    external_id?: string;
}

export interface LibraryArtist {
    id: string;
    name: string;
    cover_image?: string;
    tidal_id?: number;
    provider_id?: string;
    external_id?: string;
}

export interface LocalSearchResults {
    tracks: UnifiedTrack[];
    albums: LibraryAlbum[];
    artists: LibraryArtist[];
}

export const getLibraryTracks = async (): Promise<UnifiedTrack[]> => {
    return await invoke('get_library_tracks');
};

export const getLibraryAlbums = async (): Promise<LibraryAlbum[]> => {
    return await invoke('get_library_albums');
};

export const getLibraryArtists = async (): Promise<LibraryArtist[]> => {
    return await invoke('get_library_artists');
};

export async function searchLibrary(query: string): Promise<UnifiedTrack[]> {
    return await invoke("search_library", { query });
}

export async function searchLibraryFull(query: string): Promise<LocalSearchResults> {
    return await invoke("search_library_full", { query });
}

export async function rebuildSearchIndex(): Promise<void> {
    return await invoke("rebuild_search_index");
}

export const addTidalTrack = async (track: any, coverUrl?: string): Promise<void> => {
    await invoke('add_tidal_track', { track, coverUrl });
};

export async function factoryReset(): Promise<void> {
    await invoke("factory_reset");
}

export async function libraryHasData(): Promise<boolean> {
    return await invoke("library_has_data");
}
