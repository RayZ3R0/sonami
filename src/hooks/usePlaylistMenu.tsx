import { useCallback } from "react";
import { Track, Playlist } from "../types";
import { ContextMenuItem } from "../components/ContextMenu";
import {
  getPlaylistsContainingTrack,
  addToPlaylist,
  removeFromPlaylist,
} from "../api/playlist";

interface UsePlaylistMenuOptions {
  playlists: Playlist[];
  refreshPlaylists?: () => void;
  onCreatePlaylistClick?: () => void;
}

/**
 * Hook to build playlist submenu items with toggle functionality.
 * Shows checkmarks for playlists containing the track, allows adding/removing.
 */
export function usePlaylistMenu({
  playlists,
  refreshPlaylists,
  onCreatePlaylistClick,
}: UsePlaylistMenuOptions) {
  /**
   * Build the playlist submenu items for a given track.
   * Returns items with checkmarks indicating which playlists contain the track.
   */
  const buildPlaylistSubmenu = useCallback(
    async (track: Track): Promise<ContextMenuItem[]> => {
      // Fetch which playlists contain this track
      let containingPlaylistIds = new Set<string>();
      try {
        const containing = await getPlaylistsContainingTrack(track.id);
        containingPlaylistIds = new Set(containing);
      } catch {
        // Silently fail - we'll just show all playlists as unchecked
      }

      const items: ContextMenuItem[] = [];

      // Add playlists with toggle functionality
      if (playlists.length > 0) {
        for (const playlist of playlists) {
          const isInPlaylist = containingPlaylistIds.has(playlist.id);
          items.push({
            label: playlist.title,
            icon: isInPlaylist ? (
              <svg className="w-4 h-4 text-theme-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            ) : (
              // Empty circle icon for visual consistency
              <svg className="w-4 h-4 opacity-30" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
              </svg>
            ),
            action: async () => {
              try {
                if (isInPlaylist) {
                  await removeFromPlaylist(playlist.id, track.id);
                } else {
                  await addToPlaylist(playlist.id, track);
                }
                refreshPlaylists?.();
              } catch (error) {
                console.error("Failed to update playlist:", error);
              }
            },
          });
        }

        // Add separator before create option
        items.push({
          label: "divider",
          disabled: true,
        });
      }

      // Always show create playlist option
      items.push({
        label: "Create New Playlist",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        ),
        action: () => {
          onCreatePlaylistClick?.();
        },
      });

      return items;
    },
    [playlists, refreshPlaylists, onCreatePlaylistClick]
  );

  /**
   * Build a single menu item with the playlist submenu.
   */
  const buildPlaylistMenuItem = useCallback(
    async (track: Track): Promise<ContextMenuItem> => {
      const submenu = await buildPlaylistSubmenu(track);
      return {
        label: "Add to Playlist",
        submenu,
      };
    },
    [buildPlaylistSubmenu]
  );

  return {
    buildPlaylistSubmenu,
    buildPlaylistMenuItem,
  };
}
