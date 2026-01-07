import { invoke } from "@tauri-apps/api/core";
import { Track } from "../types";

export interface UnifiedTrack extends Track {
    source: 'LOCAL' | 'TIDAL';
    tidal_id?: number;
    local_path?: string;
}

export interface LibraryAlbum {
    id: string;
    title: string;
    artist: string;
    cover_image?: string;
    tidal_id?: number;
}

export interface LibraryArtist {
    id: string;
    name: string;
    cover_image?: string;
    tidal_id?: number;
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

export async function rebuildSearchIndex(): Promise<void> {
    return await invoke("rebuild_search_index");
}

export const addTidalTrack = async (track: any, coverUrl?: string): Promise<void> => {
    await invoke('add_tidal_track', { track, coverUrl });
};
