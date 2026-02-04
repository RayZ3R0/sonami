import { useCallback } from "react";
import { useLongPress } from "./useLongPress";
import { useContextMenu } from "../context/ContextMenuContext";
import { ContextMenuItem } from "../components/ContextMenu";
import { useIsMobile } from "./useIsMobile";

interface UseTrackActionsOptions {
  /** Build context menu items for the track */
  getMenuItems: () => ContextMenuItem[];
  /** Track metadata for action sheet header */
  meta?: {
    title?: string;
    subtitle?: string;
    coverImage?: string;
  };
  /** Regular click/tap handler */
  onClick?: () => void;
  /** Whether actions are disabled */
  disabled?: boolean;
}

/**
 * Hook to add context menu / action sheet support to track items.
 * Handles both desktop (right-click) and mobile (long-press) interactions.
 * 
 * @example
 * ```tsx
 * const trackActions = useTrackActions({
 *   getMenuItems: () => [
 *     { label: "Play", action: () => playTrack(track) },
 *     { label: "Add to Playlist", submenu: playlists.map(...) },
 *   ],
 *   meta: { title: track.title, subtitle: track.artist, coverImage: track.cover_image },
 *   onClick: () => playTrack(track),
 * });
 * 
 * return <div {...trackActions.handlers}>Track Item</div>;
 * ```
 */
export function useTrackActions({
  getMenuItems,
  meta,
  onClick,
  disabled = false,
}: UseTrackActionsOptions) {
  const { showMenu, showActionSheet } = useContextMenu();
  const isMobile = useIsMobile();

  const handleShowMenu = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (disabled) return;

      const items = getMenuItems();
      
      if (isMobile || !("clientX" in e)) {
        // Mobile: show action sheet
        showActionSheet(items, meta);
      } else {
        // Desktop: show context menu at cursor position
        showMenu(
          items,
          { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY },
          meta
        );
      }
    },
    [disabled, getMenuItems, isMobile, showActionSheet, showMenu, meta]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const items = getMenuItems();
      showMenu(items, { x: e.clientX, y: e.clientY }, meta);
    },
    [disabled, getMenuItems, showMenu, meta]
  );

  const longPressHandlers = useLongPress({
    threshold: 500,
    onLongPress: handleShowMenu,
    onClick: onClick,
    disabled,
  });

  // For desktop, we still want regular click and right-click
  // For mobile, the long press handlers cover everything
  const handlers = isMobile
    ? {
        ...longPressHandlers,
      }
    : {
        onClick: onClick,
        onContextMenu: handleContextMenu,
      };

  return {
    handlers,
    /** Manually show the action sheet */
    showActionSheet: () => {
      if (disabled) return;
      const items = getMenuItems();
      showActionSheet(items, meta);
    },
    /** Manually show context menu at position */
    showContextMenu: (position: { x: number; y: number }) => {
      if (disabled) return;
      const items = getMenuItems();
      showMenu(items, position, meta);
    },
  };
}
