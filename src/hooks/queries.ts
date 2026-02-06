import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Playlist } from "../types";
import { RecommendationSection, TopArtistInfo } from "../types/recommendations";

import { getRecentlyPlayed, getMostPlayed } from "../api/history";
import { getPlaylistDetails } from "../api/playlist";

export const QUERY_KEYS = {
  playlists: ["playlists"],
  playlist: (id: string) => ["playlist", id],
  library: ["library"],
  history: ["history"],
  recentTracks: (limit: number) => ["history", "recent", limit],
  mostPlayed: (limit: number) => ["history", "most-played", limit],
  topArtists: (limit: number) => ["discover", "top-artists", limit],
  recommendations: (artists: string[], limit: number) => [
    "discover",
    "recommendations",
    artists,
    limit,
  ],
  artistRecommendations: (name: string) => ["discover", "artist-recs", name],
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

export const usePlaylistDetails = (id: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.playlist(id),
    queryFn: () => getPlaylistDetails(id),
    enabled: !!id,
  });
};

// --- Discover / Recommendations ---

export const useTopArtists = (limit: number = 10) => {
  return useQuery({
    queryKey: QUERY_KEYS.topArtists(limit),
    queryFn: () => invoke<TopArtistInfo[]>("get_top_artists", { limit }),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};

export const useArtistRecommendations = (artistName: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.artistRecommendations(artistName),
    queryFn: () =>
      invoke<RecommendationSection>("get_artist_recommendations", {
        artistName,
      }),
    enabled: !!artistName,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
};
