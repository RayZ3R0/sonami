import { invoke } from '@tauri-apps/api/core';
import { UnifiedTrack } from './library';

export type { UnifiedTrack } from './library';

export async function addFavorite(trackId: string): Promise<void> {
    await invoke('add_favorite', { trackId });
}

export async function removeFavorite(trackId: string): Promise<void> {
    await invoke('remove_favorite', { trackId });
}

export async function isFavorited(trackId: string): Promise<boolean> {
    return await invoke('is_favorited', { trackId });
}

export async function getFavorites(): Promise<UnifiedTrack[]> {
    return await invoke('get_favorites');
}
