import { invoke } from "@tauri-apps/api/core";
import { UnifiedTrack } from "./library";

export const getRecentlyPlayed = async (
  limit: number = 50,
): Promise<UnifiedTrack[]> => {
  return await invoke("get_recently_played", { limit });
};

export const getMostPlayed = async (
  limit: number = 50,
): Promise<UnifiedTrack[]> => {
  return await invoke("get_most_played", { limit });
};

export const getPlayCount = async (trackId: string): Promise<number> => {
  return await invoke("get_play_count", { trackId });
};

export const recordPlay = async (
  trackId: string,
  contextUri?: string,
  contextType?: string,
): Promise<string> => {
  return await invoke("record_play", { trackId, contextUri, contextType });
};

export const updatePlayCompletion = async (
  entryId: string,
  durationPlayed: number,
  completed: boolean,
): Promise<void> => {
  return await invoke("update_play_completion", {
    entryId,
    durationPlayed,
    completed,
  });
};
