import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Playlist } from "../types";

import { getRecentlyPlayed, getMostPlayed } from "../api/history";

export const QUERY_KEYS = {
    playlists: ["playlists"],
    library: ["library"],
    history: ["history"],
    recentTracks: (limit: number) => ["history", "recent", limit],
    mostPlayed: (limit: number) => ["history", "most-played", limit],
};

// --- Playlists ---

export const usePlaylists = () => {
    return useQuery({
        queryKey: QUERY_KEYS.playlists,
        queryFn: async () => {
            return await invoke<Playlist[]>("get_playlists");
        },
    });
};

// --- History ---

export const useRecentTracks = (limit: number = 20) => {
    return useQuery({
        queryKey: QUERY_KEYS.recentTracks(limit),
        queryFn: () => getRecentlyPlayed(limit),
    });
};

export const useMostPlayed = (limit: number = 20) => {
    return useQuery({
        queryKey: QUERY_KEYS.mostPlayed(limit),
        queryFn: () => getMostPlayed(limit),
    });
};
