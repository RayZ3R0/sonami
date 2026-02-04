import { invoke } from "@tauri-apps/api/core";
import { UnifiedTrack } from "./library";

export type { UnifiedTrack } from "./library";

// Favorite includes the liked_at timestamp
export interface FavoriteTrack extends UnifiedTrack {
  liked_at?: number; // Unix timestamp
}

export async function addFavorite(track: UnifiedTrack): Promise<void> {
  await invoke("add_favorite", { track });
}

export async function removeFavorite(track: UnifiedTrack): Promise<void> {
  await invoke("remove_favorite", { track });
}

export async function isFavorited(trackId: string): Promise<boolean> {
  return await invoke("is_favorited", { trackId });
}

export async function getFavorites(): Promise<FavoriteTrack[]> {
  return await invoke("get_favorites");
}
