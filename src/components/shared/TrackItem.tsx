import { useCallback, useMemo, memo } from "react";
import { Track } from "../../types";
import { ContextMenuItem } from "../ContextMenu";
import { useLongPress } from "../../hooks/useLongPress";
import { useContextMenu } from "../../context/ContextMenuContext";
import { useIsMobile } from "../../hooks/useIsMobile";

interface TrackItemProps {
  track: Track;
  index?: number;
  isPlaying?: boolean;
  isCurrentTrack?: boolean;
  onClick: () => void;
  getContextMenuItems: (track: Track) => ContextMenuItem[];
  /** Format: 'row' for list view, 'card' for grid view */
  variant?: "row" | "card";
  /** Show track number */
  showIndex?: boolean;
  /** Show album art */
  showCover?: boolean;
  /** Additional class names */
  className?: string;
  /** Disable all interactions */
  disabled?: boolean;
}

/**
 * A unified track item component that handles both desktop (right-click) 
 * and mobile (long-press) context menu interactions.
 */
export const TrackItem = memo(function TrackItem({
  track,
  index,
  isPlaying = false,
  isCurrentTrack = false,
  onClick,
  getContextMenuItems,
  variant = "row",
  showIndex = true,
  showCover = true,
  className = "",
  disabled = false,
}: TrackItemProps) {
  const { showMenu, showActionSheet } = useContextMenu();
  const isMobile = useIsMobile();

  const menuMeta = useMemo(() => ({
    title: track.title,
    subtitle: track.artist,
    coverImage: track.cover_image,
  }), [track.title, track.artist, track.cover_image]);

  const handleShowMenu = useCallback(
    () => {
      if (disabled) return;
      const items = getContextMenuItems(track);
      showActionSheet(items, menuMeta);
    },
    [disabled, getContextMenuItems, track, showActionSheet, menuMeta]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      const items = getContextMenuItems(track);
      showMenu(items, { x: e.clientX, y: e.clientY }, menuMeta);
    },
    [disabled, getContextMenuItems, track, showMenu, menuMeta]
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      onClick();
    }
  }, [disabled, onClick]);

  const longPressHandlers = useLongPress({
    threshold: 500,
    onLongPress: handleShowMenu,
    onClick: handleClick,
    disabled,
  });

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Mobile handlers (long press) vs Desktop handlers (click + right-click)
  const interactionHandlers = isMobile
    ? longPressHandlers
    : {
        onClick: handleClick,
        onContextMenu: handleContextMenu,
      };

  if (variant === "card") {
    return (
      <div
        {...interactionHandlers}
        className={`
          group relative flex flex-col gap-2 p-3 rounded-xl
          transition-colors cursor-pointer select-none
          ${isCurrentTrack ? "bg-theme-surface-active" : "hover:bg-theme-surface-hover"}
          ${disabled ? "opacity-50 pointer-events-none" : ""}
          ${className}
        `}
      >
        {/* Cover */}
        <div className="relative aspect-square rounded-lg overflow-hidden bg-theme-surface">
          {track.cover_image ? (
            <img
              src={track.cover_image}
              alt={track.album}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/10">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
            </div>
          )}
          
          {/* Playing indicator */}
          {isCurrentTrack && isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="flex gap-0.5 items-end h-6">
                <div className="w-1 bg-theme-accent animate-equalizer rounded-t-sm" style={{ animationDelay: "0s" }} />
                <div className="w-1 bg-theme-accent animate-equalizer rounded-t-sm" style={{ animationDelay: "0.2s" }} />
                <div className="w-1 bg-theme-accent animate-equalizer rounded-t-sm" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0">
          <p className={`text-sm font-medium truncate ${isCurrentTrack ? "text-theme-accent" : "text-theme-primary"}`}>
            {track.title}
          </p>
          <p className="text-xs text-theme-muted truncate">{track.artist}</p>
        </div>

        {/* Mobile menu button */}
        {isMobile && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleShowMenu();
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Row variant (default)
  return (
    <div
      {...interactionHandlers}
      className={`
        group flex items-center gap-3 px-3 py-2.5 rounded-lg
        transition-colors cursor-pointer select-none
        ${isCurrentTrack 
          ? "bg-theme-surface-active text-theme-accent" 
          : "hover:bg-theme-surface-hover text-theme-secondary hover:text-theme-primary"
        }
        ${disabled ? "opacity-50 pointer-events-none" : ""}
        ${className}
      `}
    >
      {/* Track number */}
      {showIndex && index !== undefined && (
        <div className="w-6 flex items-center justify-center text-xs font-medium">
          {isCurrentTrack && isPlaying ? (
            <div className="flex gap-0.5 items-end h-4">
              <div className="w-1 bg-theme-accent animate-equalizer rounded-t-sm" style={{ animationDelay: "0s" }} />
              <div className="w-1 bg-theme-accent animate-equalizer rounded-t-sm" style={{ animationDelay: "0.2s" }} />
              <div className="w-1 bg-theme-accent animate-equalizer rounded-t-sm" style={{ animationDelay: "0.4s" }} />
            </div>
          ) : (
            <>
              <span className={`group-hover:hidden ${isCurrentTrack ? "text-theme-accent" : "opacity-60"}`}>
                {index + 1}
              </span>
              <svg className="w-4 h-4 hidden group-hover:block text-theme-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </>
          )}
        </div>
      )}

      {/* Cover */}
      {showCover && (
        <div className="w-10 h-10 rounded overflow-hidden bg-theme-surface flex-shrink-0">
          {track.cover_image ? (
            <img
              src={track.cover_image}
              alt={track.album}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/10">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 19V6l12-3v13" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Title & Artist */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isCurrentTrack ? "text-theme-accent" : ""}`}>
          {track.title}
        </p>
        <p className="text-xs text-theme-muted truncate">{track.artist}</p>
      </div>

      {/* Duration */}
      <span className="text-xs text-theme-muted font-mono tabular-nums">
        {formatDuration(track.duration)}
      </span>

      {/* Mobile menu button */}
      {isMobile && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleShowMenu();
          }}
          className="p-1.5 -mr-1 rounded-full hover:bg-white/10 transition-colors"
          aria-label="More options"
        >
          <svg className="w-5 h-5 text-theme-muted" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      )}
    </div>
  );
});
