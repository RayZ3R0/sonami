import { useState, useEffect, useMemo } from "react";
import { getFavorites, removeFavorite, UnifiedTrack } from "../api/favorites";
import { usePlayer } from "../context/PlayerContext";
import { useDownload } from "../context/DownloadContext";
import { Track } from "../types";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { getPlaylistsContainingTrack } from "../api/playlist";
import { DownloadIndicator } from "./DownloadIndicator";

type SortColumn = "title" | "artist" | "album" | "duration" | "date_added";
type SortDirection = "asc" | "desc";

const mapToTrack = (unified: UnifiedTrack): Track => {
  let trackPath = unified.path;

  // For Tidal tracks, ALWAYS use tidal:ID format so the backend resolver
  // can decide whether to use local file or stream based on quality preferences
  if (unified.tidal_id) {
    trackPath = `tidal:${unified.tidal_id}`;
  } else if ((!trackPath || trackPath.trim() === "") && unified.local_path) {
    trackPath = unified.local_path;
  }

  return {
    ...unified,
    path: trackPath,
  };
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
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

export const LikedSongsView = () => {
  const {
    currentTrack,
    playTrack,
    shuffle,
    toggleShuffle,
    isPlaying,
    dataVersion,
    refreshFavorites,
    playlists,
    addToPlaylist,
  } = usePlayer();

  const { downloadTrack, deleteDownloadedTrack, downloads, isTrackCompleted } =
    useDownload();

  const [favorites, setFavorites] = useState<UnifiedTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const sortStorageKey = "sonami-liked-songs-sort";
  const [sortBy, setSortBy] = useState<SortColumn>(() => {
    const saved = localStorage.getItem(sortStorageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.sortBy || "date_added";
    }
    return "date_added";
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
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
  }, [sortBy, sortDirection]);

  useEffect(() => {
    const fetchFavorites = async () => {
      setLoading(true);
      try {
        const data = await getFavorites();
        setFavorites(data);
      } catch (err) {
        console.error("Failed to fetch favorites:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFavorites();
  }, [dataVersion]);

  const sortedFavorites = useMemo(() => {
    return [...favorites].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "date_added":
          comparison = (a.liked_at || 0) - (b.liked_at || 0);
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
  }, [favorites, sortBy, sortDirection]);

  const totalDuration = useMemo(() => {
    return favorites.reduce((acc, t) => acc + t.duration, 0);
  }, [favorites]);

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);

      setSortDirection(column === "date_added" ? "desc" : "asc");
    }
  };

  const handlePlayAll = async () => {
    if (sortedFavorites.length === 0) return;
    const tracksForQueue = sortedFavorites.map(mapToTrack);
    await playTrack(tracksForQueue[0], tracksForQueue);
  };

  const handleShufflePlay = async () => {
    if (sortedFavorites.length === 0) return;

    if (!shuffle) {
      await toggleShuffle();
    }

    const tracksForQueue = sortedFavorites.map(mapToTrack);
    const randomIndex = Math.floor(Math.random() * tracksForQueue.length);
    await playTrack(tracksForQueue[randomIndex], tracksForQueue);
  };

  const handlePlayTrack = async (track: UnifiedTrack) => {
    const tracksForQueue = sortedFavorites.map(mapToTrack);
    const trackToPlay = mapToTrack(track);
    await playTrack(trackToPlay, tracksForQueue);
  };

  const handleUnfavorite = async (track: UnifiedTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeFavorite(track);
      setFavorites((prev) => prev.filter((t) => t.id !== track.id));
      refreshFavorites();
    } catch (err) {
      console.error("Failed to unfavorite:", err);
    }
  };

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    track: Track | null;
    containingPlaylists: Set<string>;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    track: null,
    containingPlaylists: new Set(),
  });

  const closeContextMenu = () =>
    setContextMenu((prev) => ({ ...prev, isOpen: false }));

  const handleContextMenu = async (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("Context Menu Track:", track); // Debug logging

    try {
      const containing = await getPlaylistsContainingTrack(track.id);
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        track,
        containingPlaylists: new Set(containing),
      });
    } catch (error) {
      console.error("Failed to fetch containing playlists:", error);
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY,
        track,
        containingPlaylists: new Set(),
      });
    }
  };

  const menuItems: ContextMenuItem[] = useMemo(() => {
    if (!contextMenu.track) return [];
    const track = contextMenu.track;

    const availablePlaylists = playlists.filter(
      (p) => !contextMenu.containingPlaylists.has(p.id),
    );

    // Check if track is a streaming track (Tidal, Subsonic, or Jellyfin)
    const source = (track as any).source;
    const providerId = (track as any).provider_id;
    const isStreamingTrack =
      source === "TIDAL" ||
      source === "SUBSONIC" ||
      source === "JELLYFIN" ||
      "tidal_id" in track ||
      (track.path && track.path.startsWith("tidal:")) ||
      (track.path && track.path.startsWith("subsonic:")) ||
      (track.path && track.path.startsWith("jellyfin:")) ||
      providerId === "subsonic" ||
      providerId === "jellyfin" ||
      /^\d+$/.test(track.id);

    const items: ContextMenuItem[] = [
      {
        label: "Play",
        action: () => {
          // Need to find the index in sortedFavorites to play appropriately if needed,
          // but playTrack usually handles the queue setup.
          // mapToTrack logic is needed here actually.
          const mappedTrack = mapToTrack(track as UnifiedTrack);
          const tracksForQueue = sortedFavorites.map(mapToTrack);
          playTrack(mappedTrack, tracksForQueue);
        },
      },
      {
        label: "Remove from Liked Songs",
        action: async () => {
          try {
            await removeFavorite(track as UnifiedTrack);
            setFavorites((prev) => prev.filter((t) => t.id !== track.id));
            refreshFavorites();
          } catch (err) {
            console.error("Failed to unfavorite:", err);
          }
        },
      },
      {
        label: "Add to Playlist",
        submenu:
          availablePlaylists.length > 0
            ? availablePlaylists.map((p) => ({
              label: p.title,
              action: () => addToPlaylist(p.id, track),
            }))
            : [{ label: "No available playlists", disabled: true }],
      },
    ];

    if (isStreamingTrack) {
      items.push({
        label: "Download",
        action: () => downloadTrack(track),
      });
    }

    return items;
  }, [
    contextMenu,
    playlists,
    sortedFavorites,
    playTrack,
    addToPlaylist,
    removeFavorite,
    refreshFavorites,
    downloadTrack,
  ]);

  const handleDownloadAll = async () => {
    // Filter for all streaming tracks (Tidal, Subsonic, Jellyfin)
    const streamingTracks = sortedFavorites.filter(
      (t) =>
        t.tidal_id ||
        (t.path && t.path.startsWith("tidal:")) ||
        (t.path && t.path.startsWith("subsonic:")) ||
        (t.path && t.path.startsWith("jellyfin:")) ||
        (t as any).source === "TIDAL" ||
        (t as any).source === "SUBSONIC" ||
        (t as any).source === "JELLYFIN" ||
        /^\d+$/.test(t.id),
    );
    for (const track of streamingTracks) {
      await downloadTrack(mapToTrack(track));
    }
  };

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) return null;
    return (
      <span className="ml-1 text-theme-accent">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-theme-muted">
          Loading liked songs...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 bg-gradient-to-b from-pink-900/30 to-transparent">
        <div className="flex items-end gap-6">
          {/* Icon */}
          <div className="w-52 h-52 rounded-xl bg-gradient-to-br from-pink-600 to-pink-800 flex items-center justify-center shadow-2xl">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-24 h-24 text-white"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>

          {/* Info */}
          <div className="flex-1 pb-2">
            <p className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
              Playlist
            </p>
            <h1 className="text-5xl font-bold text-theme-primary mb-4">
              Liked Songs
            </h1>
            <p className="text-sm text-theme-muted">
              {favorites.length} {favorites.length === 1 ? "song" : "songs"} •{" "}
              {formatTotalDuration(totalDuration)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={handlePlayAll}
            disabled={favorites.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-pink-500 hover:bg-pink-400 text-white font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="pt-[2px]">Play</span>
          </button>
          <button
            onClick={handleShufflePlay}
            disabled={favorites.length === 0}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${shuffle
              ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
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
            disabled={favorites.length === 0}
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

      {/* Track List */}
      {favorites.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-theme-muted">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="w-16 h-16 mb-4 opacity-30"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <p className="text-lg font-medium">No liked songs yet</p>
          <p className="text-sm opacity-60 mt-1">Like songs to see them here</p>
        </div>
      ) : (
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

          {sortedFavorites.map((track, index) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            if (index === 0)
              console.log("First Track Data:", {
                title: track.title,
                local_path: track.local_path,
                audio_quality: track.audio_quality,
              });
            return (
              <div
                key={track.id}
                onClick={() => handlePlayTrack(track)}
                onContextMenu={(e) => handleContextMenu(e, mapToTrack(track))}
                className={`grid grid-cols-[16px_1fr_1fr_1fr_120px_24px_48px_32px] gap-4 px-4 py-2.5 rounded-lg group transition-colors cursor-pointer ${isCurrentTrack
                  ? "bg-pink-500/10 text-pink-500"
                  : "hover:bg-theme-surface-hover text-theme-secondary hover:text-theme-primary"
                  }`}
              >
                {/* Number / Playing indicator */}
                <div className="flex items-center text-xs font-medium justify-center">
                  {isCurrentTrack && isPlaying ? (
                    <div className="flex gap-0.5 items-end h-4">
                      <div
                        className="w-1 bg-pink-500 animate-equalizer rounded-t-sm"
                        style={{ height: "60%", animationDelay: "0s" }}
                      />
                      <div
                        className="w-1 bg-pink-500 animate-equalizer rounded-t-sm"
                        style={{ height: "100%", animationDelay: "0.2s" }}
                      />
                      <div
                        className="w-1 bg-pink-500 animate-equalizer rounded-t-sm"
                        style={{ height: "40%", animationDelay: "0.4s" }}
                      />
                    </div>
                  ) : (
                    <>
                      <span
                        className={`group-hover:hidden ${isCurrentTrack ? "text-pink-500" : "opacity-60"}`}
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

                {/* Title & Cover */}
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
                    className={`truncate font-medium ${isCurrentTrack ? "text-pink-500" : "text-theme-primary"}`}
                  >
                    {track.title}
                  </span>
                  {/* Old download indicator removed */}
                </div>

                {/* Album */}
                <div className="flex items-center min-w-0">
                  <span className="truncate text-theme-muted text-sm group-hover:text-theme-primary transition-colors">
                    {track.album}
                  </span>
                </div>

                {/* Artist */}
                <div className="flex items-center min-w-0">
                  <span className="truncate text-theme-muted text-sm group-hover:text-theme-primary transition-colors">
                    {track.artist}
                  </span>
                </div>

                <div className="flex items-center text-sm text-theme-muted">
                  {formatRelativeDate(track.liked_at)}
                </div>

                {/* Download Indicator */}
                <div className="flex items-center justify-center">
                  {(() => {
                    const unifiedTrack = track as any;
                    const source = unifiedTrack.source;
                    const providerId = unifiedTrack.provider_id;
                    const externalId = unifiedTrack.external_id;

                    // Determine track key for download tracking
                    let trackKey: string | null = null;
                    let isStreamingTrack = false;

                    if (unifiedTrack.tidal_id) {
                      trackKey = unifiedTrack.tidal_id.toString();
                      isStreamingTrack = true;
                    } else if (track.path?.startsWith("tidal:")) {
                      const pathId = track.path.split(":")[1];
                      if (pathId && pathId !== "0") {
                        trackKey = pathId;
                        isStreamingTrack = true;
                      }
                    } else if (track.id.match(/^\d+$/)) {
                      trackKey = track.id;
                      isStreamingTrack = true;
                    }

                    // Handle Tidal tracks that use provider_id + external_id instead of tidal_id
                    if (!trackKey && (source === "TIDAL" || providerId === "tidal") && externalId) {
                      trackKey = externalId;
                      isStreamingTrack = true;
                    }

                    // Handle Subsonic/Jellyfin tracks
                    if (!trackKey) {
                      if (source === "SUBSONIC" || providerId === "subsonic") {
                        trackKey = `subsonic:${externalId || track.id}`;
                        isStreamingTrack = true;
                      } else if (source === "JELLYFIN" || providerId === "jellyfin") {
                        trackKey = `jellyfin:${externalId || track.id}`;
                        isStreamingTrack = true;
                      } else if (track.path?.startsWith("subsonic:")) {
                        trackKey = track.path;
                        isStreamingTrack = true;
                      } else if (track.path?.startsWith("jellyfin:")) {
                        trackKey = track.path;
                        isStreamingTrack = true;
                      }
                    }

                    const downloadState = trackKey
                      ? downloads.get(trackKey)
                      : undefined;

                    // Check both: local file exists OR completed in this session (via ref)
                    const isDownloaded =
                      (unifiedTrack.local_path &&
                        unifiedTrack.local_path !== "") ||
                      (unifiedTrack.audio_quality &&
                        unifiedTrack.audio_quality !== "") ||
                      (trackKey && isTrackCompleted(trackKey));

                    return isStreamingTrack ? (
                      <DownloadIndicator
                        status={downloadState}
                        isDownloaded={isDownloaded}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isDownloaded) {
                            // Delete only works for Tidal tracks currently
                            const numericTidalId = unifiedTrack.tidal_id || (track.id.match(/^\d+$/) ? Number(track.id) : null);
                            if (numericTidalId && !isNaN(numericTidalId)) {
                              deleteDownloadedTrack(numericTidalId).then(() => {
                                refreshFavorites();
                              });
                            }
                          } else if (!downloadState) {
                            downloadTrack(mapToTrack(track));
                          }
                        }}
                      />
                    ) : (
                      <span />
                    );
                  })()}
                </div>

                {/* Duration */}
                <div className="flex items-center justify-end text-sm text-theme-muted font-variant-numeric tabular-nums">
                  {formatDuration(track.duration)}
                </div>

                {/* Unfavorite Button */}
                <div className="flex items-center justify-end">
                  <button
                    onClick={(e) => handleUnfavorite(track, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/10 text-pink-500 hover:text-pink-400 transition-all"
                    title="Remove from Liked Songs"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Context Menu */}
      {contextMenu.isOpen && (
        <ContextMenu
          items={menuItems}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};
