import { invoke } from "@tauri-apps/api/core";
import { Track } from "../types";

export interface UnifiedTrack extends Track {
    source: 'LOCAL' | 'TIDAL';
    tidal_id?: number;
    local_path?: string;
}

export const getLibraryTracks = async (): Promise<UnifiedTrack[]> => {
    return await invoke('get_library_tracks');
};

export const addTidalTrack = async (track: any, coverUrl?: string): Promise<void> => {
    await invoke('add_tidal_track', { track, coverUrl });
};
