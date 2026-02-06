import { invoke } from "@tauri-apps/api/core";
import { Playlist, PlaylistDetails, Track } from "../types";
import { UnifiedTrack } from "./library";

export const getPlaylists = async (): Promise<Playlist[]> => {
  return await invoke("get_playlists");
};

export const getPlaylistDetails = async (
  id: string,
): Promise<PlaylistDetails> => {
  const details = await invoke<{ playlist: Playlist; tracks: UnifiedTrack[] }>(
    "get_playlist_details",
    { id },
  );

  // Map UnifiedTracks to frontend Tracks (preserving all potential fields)
  // We cast to unknown first to allow the compatible structure
  const mappedTracks = details.tracks.map((t) => t as unknown as Track);

  return {
    playlist: details.playlist,
    tracks: mappedTracks,
  };
};

export const getPlaylistsContainingTrack = async (
  trackId: string,
): Promise<string[]> => {
  return await invoke<string[]>("get_playlists_containing_track", { trackId });
};

export const createPlaylist = async (
  name: string,
  description?: string,
): Promise<Playlist> => {
  return await invoke("create_playlist", { name, description });
};

export const deletePlaylist = async (id: string): Promise<void> => {
  return await invoke("delete_playlist", { id });
};

export const renamePlaylist = async (
  id: string,
  newName: string,
): Promise<void> => {
  return await invoke("rename_playlist", { id, newName });
};

export const addToPlaylist = async (
  playlistId: string,
  track: Track,
): Promise<void> => {
  console.log("[api/playlist] addToPlaylist called");
  console.log("[api/playlist] playlistId:", playlistId);
  console.log("[api/playlist] track:", JSON.parse(JSON.stringify(track)));
  console.log("[api/playlist] track.source:", (track as any).source);
  console.log("[api/playlist] track.provider_id:", (track as any).provider_id);
  console.log("[api/playlist] track.external_id:", (track as any).external_id);
  try {
    await invoke("add_to_playlist", { playlistId, track });
    console.log("[api/playlist] addToPlaylist SUCCESS");
  } catch (e) {
    console.error("[api/playlist] addToPlaylist FAILED:", e);
    throw e;
  }
};

export const removeFromPlaylist = async (
  playlistId: string,
  trackId: string,
): Promise<void> => {
  return await invoke("remove_from_playlist", { playlistId, trackId });
};
