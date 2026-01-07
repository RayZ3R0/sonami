import { useState, useEffect, useMemo } from "react";
import { getFavorites, removeFavorite, UnifiedTrack } from "../api/favorites";
import { usePlayer } from "../context/PlayerContext";
import { Track } from "../types";

type SortColumn = "title" | "artist" | "album" | "duration" | "date_added";
type SortDirection = "asc" | "desc";

const mapToTrack = (unified: UnifiedTrack): Track => {
  let trackPath = unified.path;

  if ((!trackPath || trackPath.trim() === "") && unified.tidal_id) {
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
  } = usePlayer();

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

  const handleUnfavorite = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeFavorite(trackId);
      setFavorites((prev) => prev.filter((t) => t.id !== trackId));
      refreshFavorites();
    } catch (err) {
      console.error("Failed to unfavorite:", err);
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
            <h1 className="text-5xl font-bold text-white mb-4">Liked Songs</h1>
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
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-pink-500 hover:bg-pink-400 text-white font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="pt-[2px]">Play</span>
          </button>
          <button
            onClick={handleShufflePlay}
            disabled={favorites.length === 0}
            className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
              shuffle
                ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
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
          <div className="sticky top-0 bg-theme-background-secondary z-10 grid grid-cols-[16px_1fr_1fr_1fr_120px_48px_32px] gap-4 px-4 py-3 border-b border-white/5 text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
            <span>#</span>
            <span
              className="cursor-pointer hover:text-white transition-colors"
              onClick={() => handleSort("title")}
            >
              Title <SortIndicator column="title" />
            </span>
            <span
              className="cursor-pointer hover:text-white transition-colors"
              onClick={() => handleSort("album")}
            >
              Album <SortIndicator column="album" />
            </span>
            <span
              className="cursor-pointer hover:text-white transition-colors"
              onClick={() => handleSort("artist")}
            >
              Artist <SortIndicator column="artist" />
            </span>
            <span
              className="cursor-pointer hover:text-white transition-colors"
              onClick={() => handleSort("date_added")}
            >
              Date Added <SortIndicator column="date_added" />
            </span>
            <span
              className="text-right cursor-pointer hover:text-white transition-colors"
              onClick={() => handleSort("duration")}
            >
              Time <SortIndicator column="duration" />
            </span>
            <span></span>
          </div>

          {sortedFavorites.map((track, index) => {
            const isCurrentTrack = currentTrack?.id === track.id;
            return (
              <div
                key={track.id}
                onClick={() => handlePlayTrack(track)}
                className={`grid grid-cols-[16px_1fr_1fr_1fr_120px_48px_32px] gap-4 px-4 py-2.5 rounded-lg group transition-colors cursor-pointer ${
                  isCurrentTrack
                    ? "bg-pink-500/10 text-pink-500"
                    : "hover:bg-theme-surface-hover text-theme-secondary hover:text-white"
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
                        className="w-4 h-4 hidden group-hover:block text-white"
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
                    className={`truncate font-medium ${isCurrentTrack ? "text-pink-500" : "text-white"}`}
                  >
                    {track.title}
                  </span>
                </div>

                {/* Album */}
                <div className="flex items-center min-w-0">
                  <span className="truncate text-theme-muted text-sm group-hover:text-white/70 transition-colors">
                    {track.album}
                  </span>
                </div>

                {/* Artist */}
                <div className="flex items-center min-w-0">
                  <span className="truncate text-theme-muted text-sm group-hover:text-white/70 transition-colors">
                    {track.artist}
                  </span>
                </div>

                {/* Date Added */}
                <div className="flex items-center text-sm text-theme-muted">
                  {formatRelativeDate(track.liked_at)}
                </div>

                {/* Duration */}
                <div className="flex items-center justify-end text-sm text-theme-muted font-variant-numeric tabular-nums">
                  {formatDuration(track.duration)}
                </div>

                {/* Unfavorite Button */}
                <div className="flex items-center justify-end">
                  <button
                    onClick={(e) => handleUnfavorite(track.id, e)}
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
    </div>
  );
};
