import { usePlayer } from "../context/PlayerContext";
import { useDownload } from "../context/DownloadContext";
import { useContextMenu } from "../context/ContextMenuContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { usePlaylistMenu } from "../hooks/usePlaylistMenu";
import { useState, useMemo, useEffect, useCallback } from "react";
import { UnifiedTrack } from "../api/library";
import { Track } from "../types";
import { ContextMenuItem } from "./ContextMenu";
import { usePlaylistDetails } from "../hooks/queries";
import { DeletePlaylistModal } from "./DeletePlaylistModal";
import { CreatePlaylistModal } from "./CreatePlaylistModal";
import { DownloadIndicator } from "./DownloadIndicator";

interface PlaylistViewProps {
  playlistId: string;
  onNavigate?: (tab: string) => void;
}

const mapToTrack = (track: Track): Track => {
  const uTrack = track as unknown as UnifiedTrack;

  let trackPath = track.path;

  // Ensure path is set for local lookup or streaming
  if ((!trackPath || trackPath.trim() === "") && uTrack.local_path) {
    trackPath = uTrack.local_path || "";
  } else if (!trackPath && uTrack.provider_id && uTrack.external_id) {
    if (uTrack.provider_id === "tidal") {
      trackPath = `tidal:${uTrack.external_id}`;
    } else {
      trackPath = `${uTrack.provider_id}:${uTrack.external_id}`;
    }
  }

  return {
    ...track,
    path: trackPath,
  };
};

const PlaylistCover = ({
  tracks,
  coverUrl,
}: {
  tracks: Track[];
  coverUrl?: string | null;
}) => {
  let covers: string[] = [];

  if (coverUrl) {
    covers = coverUrl.split("|");
  }

  if (covers.length === 0 && tracks.length > 0) {
    covers = tracks
      .filter((t) => t.cover_image)
      .slice(0, 4)
      .map((t) => t.cover_image!);
  }

  if (covers.length === 0) {
    return (
      <div className="w-52 h-52 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-2xl flex items-center justify-center text-white/20">
        <svg className="w-20 h-20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 18V5l12-2v13" />
        </svg>
      </div>
    );
  }

  let displayCovers = [...covers];
  if (covers.length === 2) {
    displayCovers = [covers[0], covers[1], covers[0], covers[1]];
  } else if (covers.length === 3) {
    displayCovers = [covers[0], covers[1], covers[2], covers[0]];
  }

  if (displayCovers.length >= 4) {
    return (
      <div className="w-52 h-52 grid grid-cols-2 bg-theme-surface rounded-xl overflow-hidden shadow-2xl">
        {displayCovers.slice(0, 4).map((src, i) => (
          <img key={i} src={src} className="w-full h-full object-cover" />
        ))}
      </div>
    );
  }

  return (
    <img
      src={covers[0]}
      alt="Playlist Cover"
      className="w-52 h-52 object-cover rounded-xl shadow-2xl"
    />
  );
};

export const PlaylistView = ({ playlistId, onNavigate }: PlaylistViewProps) => {
  const {
    playTrack,
    currentTrack,
    removeFromPlaylist,
    deletePlaylist,
    renamePlaylist,
    shuffle,
    toggleShuffle,
    isPlaying,
    favorites,
    playlists,
    refreshPlaylists,
    toggleFavorite,
  } = usePlayer();

  const { downloadTrack, deleteDownloadedTrack, downloads, isTrackCompleted } =
    useDownload();

  const { showMenu } = useContextMenu();
  const isMobile = useIsMobile();

  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);

  // Playlist menu hook for toggle functionality
  const { buildPlaylistSubmenu } = usePlaylistMenu({
    playlists,
    refreshPlaylists,
    onCreatePlaylistClick: () => setShowCreatePlaylist(true),
  });

  const {
    data: details = null,
    isLoading,
    error: queryError,
    refetch,
  } = usePlaylistDetails(playlistId);
  const error = queryError ? "Failed to load playlist." : null;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const sortStorageKey = `sonami-playlist-sort-${playlistId}`;
  const [sortBy, setSortBy] = useState<
    "title" | "artist" | "album" | "duration" | "date_added"
  >(() => {
    const saved = localStorage.getItem(sortStorageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.sortBy || "date_added";
    }
    return "date_added";
  });
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(() => {
    const saved = localStorage.getItem(sortStorageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.sortDirection || "desc";
    }
    return "desc";
  });

  useEffect(() => {
    localStorage.setItem(
      sortStorageKey,
      JSON.stringify({ sortBy, sortDirection }),
    );
  }, [sortBy, sortDirection, sortStorageKey]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const totalDuration = useMemo(() => {
    if (!details) return 0;
    return details.tracks.reduce((acc, t) => acc + t.duration, 0);
  }, [details]);

  const sortedTracks = useMemo(() => {
    if (!details) return [];
    return [...details.tracks].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "date_added":
          comparison = (a.added_at || 0) - (b.added_at || 0);
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "artist":
          comparison = a.artist.localeCompare(b.artist);
          break;
        case "album":
          comparison = a.album.localeCompare(b.album);
          break;
        case "duration":
          comparison = a.duration - b.duration;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [details, sortBy, sortDirection]);

  // Build context menu items for a track
  const getMenuItemsForTrack = useCallback(
    async (track: Track): Promise<ContextMenuItem[]> => {
      const isLiked = favorites.has(track.id);

      // Check if track is a streaming track (Tidal, Subsonic, or Jellyfin)
      const source = (track as any).source;
      const providerIdVal = (track as any).provider_id;
      const isStreamingTrack =
        source === "TIDAL" ||
        source === "SUBSONIC" ||
        source === "JELLYFIN" ||
        (track.path && track.path.startsWith("tidal:")) ||
        (track.path && track.path.startsWith("subsonic:")) ||
        (track.path && track.path.startsWith("jellyfin:")) ||
        providerIdVal === "subsonic" ||
        providerIdVal === "jellyfin" ||
        (providerIdVal && (track as any).external_id) ||
        /^\d+$/.test(track.id);

      // Build playlist submenu with toggle functionality
      const playlistSubmenu = await buildPlaylistSubmenu(track);

      const items: ContextMenuItem[] = [
        {
          label: "Play",
          action: () => playTrack(track, sortedTracks),
        },
        {
          label: isLiked ? "Remove from Liked Songs" : "Add to Liked Songs",
          action: () => toggleFavorite(track),
        },
        {
          label: "Add to Playlist",
          submenu: playlistSubmenu,
        },
      ];

      // Add download option for streaming tracks
      if (isStreamingTrack) {
        items.push({
          label: "Download",
          action: () => downloadTrack(track),
        });
      }

      items.push({
        label: "Remove from this Playlist",
        danger: true,
        action: () => removeFromPlaylist(playlistId, track.id),
      });

      return items;
    },
    [playlistId, favorites, sortedTracks, playTrack, toggleFavorite, downloadTrack, removeFromPlaylist, buildPlaylistSubmenu]
  );

  // Handle context menu / action sheet display
  const handleTrackMenu = useCallback(
    async (track: Track, position: { x: number; y: number }) => {
      const items = await getMenuItemsForTrack(track);
      showMenu(items, position, {
        title: track.title,
        subtitle: track.artist,
        coverImage: track.cover_image,
      });
    },
    [getMenuItemsForTrack, showMenu]
  );

  const handleContextMenu = useCallback(
    async (e: React.MouseEvent, track: Track) => {
      e.preventDefault();
      e.stopPropagation();
      await handleTrackMenu(track, { x: e.clientX, y: e.clientY });
    },
    [handleTrackMenu]
  );

  const handleSort = (
    column: "title" | "artist" | "album" | "duration" | "date_added",
  ) => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);

      setSortDirection(column === "date_added" ? "desc" : "asc");
    }
  };

  const SortIndicator = ({
    column,
  }: {
    column: "title" | "artist" | "album" | "duration" | "date_added";
  }) => {
    if (sortBy !== column) return null;
    return (
      <span className="ml-1 text-theme-accent inline-block">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  const formatTotalDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} hr ${mins} min`;
    }
    return `${mins} min`;
  };

  const formatRelativeDate = (timestamp?: number): string => {
    if (!timestamp) return "";
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;

    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-theme-muted">
        Loading playlist...
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="flex-1 flex items-center justify-center text-theme-muted">
        {error || "Playlist not found."}
      </div>
    );
  }

  const { playlist, tracks } = details;

  const handleRename = async () => {
    if (editName.trim() && editName !== playlist.title) {
      try {
        await renamePlaylist(playlist.id, editName.trim());
        // Invalidation in PlayerContext handles the update
      } catch (e) {
        console.error("Rename failed", e);
      }
    }
    setIsEditing(false);
  };

  const startEdit = () => {
    if (details) {
      setEditName(details.playlist.title);
    }
    setIsEditing(true);
  };

  const handleDelete = () => {
    setIsDeleteModalOpen(true);
  };

  const handlePlayAll = async () => {
    if (tracks.length === 0) return;

    const queue = tracks.map(mapToTrack);
    await playTrack(queue[0], queue);
  };

  const handleShufflePlay = async () => {
    if (tracks.length === 0) return;
    if (!shuffle) await toggleShuffle();

    const queue = tracks.map(mapToTrack);
    const randomIndex = Math.floor(Math.random() * queue.length);
    await playTrack(queue[randomIndex], queue);
  };

  const handlePlayTrack = async (track: Track) => {
    const queue = sortedTracks.map(mapToTrack);
    const trackToPlay = mapToTrack(track);
    await playTrack(trackToPlay, queue);
  };

  const handleDownloadAll = async () => {
    // Filter for all streaming tracks (Tidal, Subsonic, Jellyfin)
    const streamingTracks = tracks.filter(
      (t) =>
        t.id.match(/^\d+$/) ||
        (t.path && t.path.startsWith("tidal:")) ||
        (t.path && t.path.startsWith("subsonic:")) ||
        (t.path && t.path.startsWith("jellyfin:")) ||
        ("source" in t &&
          ((t as any).source === "TIDAL" ||
            (t as any).source === "SUBSONIC" ||
            (t as any).source === "JELLYFIN")) ||
        ((t as any).provider_id && (t as any).external_id),
    );
    for (const track of streamingTracks) {
      await downloadTrack(mapToTrack(track));
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 bg-gradient-to-b from-indigo-900/30 to-transparent">
        <div className="flex items-end gap-6">
          {/* Dynamic Cover */}

          <PlaylistCover
            tracks={tracks}
            coverUrl={details.playlist.cover_url}
          />

          {/* Info */}
          <div className="flex-1 pb-2 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-muted mb-2 block">
              Playlist
            </span>

            {isEditing ? (
              <input
                className="block w-full text-5xl font-black text-theme-primary bg-transparent border-b border-theme-border focus:border-theme-border-focus focus:outline-none mb-4"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                autoFocus
              />
            ) : (
              <h1
                className="text-5xl font-black text-theme-primary mb-4 truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-theme-primary/20"
                onClick={startEdit}
                title="Click to rename"
              >
                {playlist.title}
              </h1>
            )}

            <div className="flex items-center gap-2 text-sm text-theme-muted">
              <span className="font-semibold text-theme-primary">
                {tracks.length} tracks
              </span>
              <span>•</span>
              <span>{formatTotalDuration(totalDuration)}</span>
              <span>•</span>
              <button
                onClick={handleDelete}
                className="hover:text-theme-error transition-colors"
              >
                Delete Playlist
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={handlePlayAll}
            disabled={tracks.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="pt-[2px]">Play</span>
          </button>
          <button
            onClick={handleShufflePlay}
            disabled={tracks.length === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
              shuffle
                ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                : "bg-theme-surface hover:bg-theme-surface-hover text-theme-primary"
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"
              />
            </svg>
            <span className="pt-[2px]">Shuffle</span>
          </button>
          <button
            onClick={handleDownloadAll}
            disabled={tracks.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-theme-surface hover:bg-theme-surface-hover text-theme-primary font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span className="pt-[2px]">Download</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-auto px-8">
        {/* Header Row */}
        <div className="sticky top-0 bg-theme-secondary z-10 grid grid-cols-[16px_1fr_1fr_1fr_120px_24px_48px_32px] gap-4 px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
          <span>#</span>
          <span
            className="cursor-pointer hover:text-theme-primary transition-colors"
            onClick={() => handleSort("title")}
          >
            Title <SortIndicator column="title" />
          </span>
          <span
            className="cursor-pointer hover:text-theme-primary transition-colors"
            onClick={() => handleSort("album")}
          >
            Album <SortIndicator column="album" />
          </span>
          <span
            className="cursor-pointer hover:text-theme-primary transition-colors"
            onClick={() => handleSort("artist")}
          >
            Artist <SortIndicator column="artist" />
          </span>
          <span
            className="cursor-pointer hover:text-theme-primary transition-colors"
            onClick={() => handleSort("date_added")}
          >
            Date Added <SortIndicator column="date_added" />
          </span>
          <span></span>
          <span
            className="text-right cursor-pointer hover:text-theme-primary transition-colors"
            onClick={() => handleSort("duration")}
          >
            Time <SortIndicator column="duration" />
          </span>
          <span></span>
        </div>

        {sortedTracks.length === 0 ? (
          <div className="py-10 text-center text-theme-muted text-sm">
            This playlist is empty. Right-click songs in your library to add
            them here.
          </div>
        ) : (
          sortedTracks.map((track, index) => {
            const isCurrentTrack = currentTrack?.id === track.id;

            return (
              <div
                key={`${track.id}-${index}`}
                onContextMenu={(e) => handleContextMenu(e, track)}
                onClick={() => handlePlayTrack(track)}
                className={`grid grid-cols-[16px_1fr_1fr_1fr_120px_24px_48px_32px] gap-4 px-4 py-2.5 rounded-lg group transition-colors cursor-pointer ${
                  isCurrentTrack
                    ? "bg-theme-surface-active text-theme-accent"
                    : "hover:bg-theme-surface-hover text-theme-secondary hover:text-theme-primary"
                }`}
              >
                <div className="flex items-center text-xs font-medium justify-center">
                  {isCurrentTrack && isPlaying ? (
                    <div className="flex gap-0.5 items-end h-4">
                      <div
                        className="w-1 bg-theme-accent animate-equalizer rounded-t-sm"
                        style={{ height: "60%", animationDelay: "0s" }}
                      />
                      <div
                        className="w-1 bg-theme-accent animate-equalizer rounded-t-sm"
                        style={{ height: "100%", animationDelay: "0.2s" }}
                      />
                      <div
                        className="w-1 bg-theme-accent animate-equalizer rounded-t-sm"
                        style={{ height: "40%", animationDelay: "0.4s" }}
                      />
                    </div>
                  ) : (
                    <>
                      <span
                        className={`group-hover:hidden ${isCurrentTrack ? "text-theme-accent" : "opacity-60"}`}
                      >
                        {index + 1}
                      </span>
                      <svg
                        className="w-4 h-4 hidden group-hover:block text-theme-primary"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  {track.cover_image ? (
                    <img
                      src={track.cover_image}
                      alt={track.album}
                      className="w-10 h-10 rounded object-cover shadow-sm"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 opacity-20"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                  <span
                    className={`truncate font-medium ${isCurrentTrack ? "text-theme-accent" : "text-theme-primary"}`}
                  >
                    {track.title}
                  </span>
                </div>

                <div className="flex items-center min-w-0">
                  <span className="truncate text-theme-muted text-sm group-hover:text-theme-primary transition-colors">
                    {track.album}
                  </span>
                </div>

                <div className="flex items-center min-w-0">
                  <span className="truncate text-theme-muted text-sm group-hover:text-theme-primary transition-colors">
                    {track.artist}
                  </span>
                </div>

                <div className="flex items-center text-sm text-theme-muted">
                  {formatRelativeDate(track.added_at)}
                </div>

                {/* Download Indicator */}
                <div className="flex items-center justify-center">
                  {(() => {
                    const unifiedTrack = track as any;
                    const source = unifiedTrack.source;
                    const providerId =
                      unifiedTrack.provider_id ||
                      (source === "TIDAL"
                        ? "tidal"
                        : source === "SUBSONIC"
                          ? "subsonic"
                          : source === "JELLYFIN"
                            ? "jellyfin"
                            : undefined);
                    const externalId =
                      unifiedTrack.external_id ||
                      (providerId === "tidal" &&
                      /^\d+$/.test(track.id.replace("tidal:", ""))
                        ? track.id.replace("tidal:", "")
                        : undefined);

                    // Determine track key for download tracking
                    let trackKey: string | null = null;
                    let isStreamingTrack = false;

                    if (providerId && externalId) {
                      isStreamingTrack = true;
                      // Uniform format: provider:externalId for all providers
                      trackKey = `${providerId}:${externalId}`;
                    }

                    // Fallback for paths
                    if (!trackKey && track.path) {
                      const pathMatch = track.path.match(
                        /^(tidal|subsonic|jellyfin):(.+)$/,
                      );
                      if (pathMatch) {
                        trackKey = track.path; // Already in correct format
                        isStreamingTrack = true;
                      }
                    }

                    const dlState = trackKey
                      ? downloads.get(trackKey)
                      : undefined;

                    const isDl =
                      (unifiedTrack.local_path &&
                        unifiedTrack.local_path !== "") ||
                      (unifiedTrack.audio_quality &&
                        unifiedTrack.audio_quality !== "") ||
                      (trackKey && isTrackCompleted(trackKey));

                    return isStreamingTrack ? (
                      <DownloadIndicator
                        status={dlState}
                        isDownloaded={isDl}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isDl) {
                            if (providerId && externalId) {
                              deleteDownloadedTrack(
                                providerId,
                                externalId,
                              ).then(() => {
                                refetch();
                              });
                            }
                          } else if (!dlState) {
                            downloadTrack(mapToTrack(track));
                          }
                        }}
                      />
                    ) : (
                      <span />
                    );
                  })()}
                </div>

                <div className="flex items-center justify-end text-sm text-theme-muted font-variant-numeric tabular-nums">
                  {formatDuration(track.duration)}
                </div>

                {/* Mobile more button */}
                {isMobile && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const items = await getMenuItemsForTrack(track);
                      showMenu(items, { x: e.clientX, y: e.clientY }, {
                        title: track.title,
                        subtitle: track.artist,
                        coverImage: track.cover_image,
                      });
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
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {details && (
        <DeletePlaylistModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={async () => {
            const currentIndex = playlists.findIndex(
              (p) => p.id === playlistId,
            );
            let nextPath = "/";

            if (playlists.length > 1) {
              const nextPlaylist =
                playlists[currentIndex + 1] || playlists[currentIndex - 1];
              if (nextPlaylist) {
                nextPath = `/playlist/${nextPlaylist.id}`;
              }
            }

            if (onNavigate) {
              onNavigate(nextPath);
            }
            await deletePlaylist(playlistId);
          }}
          playlistName={details.playlist.title}
        />
      )}

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={showCreatePlaylist}
        onClose={() => setShowCreatePlaylist(false)}
      />
    </div>
  );
};
