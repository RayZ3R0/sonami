import { invoke } from "@tauri-apps/api/core";
import { Playlist, PlaylistDetails, Track } from "../types";
import { UnifiedTrack } from "./library";

export const getPlaylists = async (): Promise<Playlist[]> => {
    return await invoke("get_playlists");
};

export const getPlaylistDetails = async (id: string): Promise<PlaylistDetails> => {
    const details = await invoke<{ playlist: Playlist; tracks: UnifiedTrack[] }>("get_playlist_details", { id });

    // Map UnifiedTracks to frontend Tracks (preserving all potential fields)
    // We cast to unknown first to allow the compatible structure
    const mappedTracks = details.tracks.map(t => t as unknown as Track);

    return {
        playlist: details.playlist,
        tracks: mappedTracks
    };
};

export const createPlaylist = async (name: string, description?: string): Promise<Playlist> => {
    return await invoke("create_playlist", { name, description });
};

export const deletePlaylist = async (id: string): Promise<void> => {
    return await invoke("delete_playlist", { id });
};

export const renamePlaylist = async (id: string, newName: string): Promise<void> => {
    return await invoke("rename_playlist", { id, newName });
};

export const addToPlaylist = async (playlistId: string, track: Track): Promise<void> => {
    return await invoke("add_to_playlist", { playlistId, track });
};

export const removeFromPlaylist = async (playlistId: string, trackId: string): Promise<void> => {
    return await invoke("remove_from_playlist", { playlistId, trackId });
};
