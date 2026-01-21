import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { searchLibrary, UnifiedTrack } from "../api/library";
import { getProviderConfigs, ProviderConfig } from "../api/providers";
import { usePlayer } from "../context/PlayerContext";
import { useDownload } from "../context/DownloadContext";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { AppLogo } from "./icons/AppLogo";

interface TidalTrack {
  id: number;
  title: string;
  artist?: { id?: number; name: string; picture?: string };
  album?: { id?: number; title: string; cover?: string };
  duration?: number;
  audioQuality?: string;
  audio_quality?: string;
}

interface SearchResult {
  id: string;
  type: "local" | "tidal" | "subsonic" | "jellyfin";
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover?: string;
  providerId?: string;
  externalId?: string;
  track: UnifiedTrack | TidalTrack;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Individual search result item
const SearchResultItem = ({
  result,
  index,
  isSelected,
  onPlay,
  onMouseEnter,
  formatDuration,
  showAddButton,
  isAdded,
  onAdd,
  onContextMenu,
  downloadState,
  isDownloaded,
}: {
  result: SearchResult;
  index: number;
  isSelected: boolean;
  onPlay: () => void;
  onMouseEnter: () => void;
  formatDuration: (s: number) => string;
  showAddButton?: boolean;
  isAdded?: boolean;
  onAdd?: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  downloadState?: { progress: number; status: string };
  isDownloaded?: boolean;
}) => {
  return (
    <div
      data-index={index}
      onClick={onPlay}
      onMouseEnter={onMouseEnter}
      onContextMenu={onContextMenu}
      className={`
                flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors
                ${isSelected ? "bg-theme-accent/15" : "hover:bg-theme-surface-hover"}
            `}
    >
      {/* Cover with Play Button Overlay */}
      <div className="relative flex-shrink-0 group/cover">
        {result.cover ? (
          <img
            src={result.cover}
            alt={result.album}
            className="w-12 h-12 rounded-md object-cover shadow-sm"
            loading="lazy"
          />
        ) : (
          <div className="w-12 h-12 rounded-md bg-theme-surface-active flex items-center justify-center">
            <AppLogo size={24} className="text-theme-muted/50" />
          </div>
        )}
        {/* Play Button Overlay */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          className={`
                        absolute inset-0 flex items-center justify-center rounded-md
                        bg-black/40 backdrop-blur-[2px]
                        transition-opacity duration-200
                        ${isSelected ? "opacity-100" : "opacity-0 group-hover/cover:opacity-100"}
                    `}
        >
          <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-lg">
            <svg
              className="w-3 h-3 text-black ml-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`truncate font-medium ${isSelected ? "text-theme-accent" : "text-theme-primary"}`}
          >
            {result.title}
          </span>
          {result.type === "local" && (
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
              Library
            </span>
          )}
          {result.type === "tidal" && (
            <span className="text-[9px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
              Tidal
            </span>
          )}
          {result.type === "subsonic" && (
            <span className="text-[9px] font-bold text-orange-400 bg-orange-500/15 px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
              Subsonic
            </span>
          )}
          {result.type === "jellyfin" && (
            <span className="text-[9px] font-bold text-purple-400 bg-purple-500/15 px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
              Jellyfin
            </span>
          )}
          {downloadState && downloadState.status === "downloading" ? (
            <div
              className="w-4 h-4 flex items-center justify-center text-theme-accent"
              title={`Downloading: ${(downloadState.progress * 100).toFixed(0)}%`}
            >
              <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24">
                <circle
                  className="text-white/10"
                  strokeWidth="3"
                  stroke="currentColor"
                  fill="transparent"
                  r="10"
                  cx="12"
                  cy="12"
                />
                <circle
                  className="text-theme-accent transition-all duration-300 ease-out"
                  strokeWidth="3"
                  strokeDasharray={2 * Math.PI * 10}
                  strokeDashoffset={
                    2 * Math.PI * 10 * (1 - downloadState.progress)
                  }
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="10"
                  cx="12"
                  cy="12"
                />
              </svg>
            </div>
          ) : isDownloaded ? (
            <div className="text-theme-accent" title="Downloaded">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          ) : null}
        </div>
        <div className="text-sm text-theme-muted truncate">
          {result.artist}
          {result.album && ` • ${result.album}`}
        </div>
      </div>

      {/* Duration */}
      <div className="text-sm text-theme-muted font-mono tabular-nums flex-shrink-0">
        {formatDuration(result.duration)}
      </div>

      {/* Add to Liked Songs Button for Tidal */}
      {showAddButton && (
        <button
          onClick={onAdd}
          disabled={isAdded}
          className={`
                        px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 flex items-center gap-1.5
                        ${isAdded
              ? "bg-pink-500/20 text-pink-400 cursor-default"
              : "bg-white/5 hover:bg-white/10 text-theme-primary hover:text-pink-400"
            }
                    `}
          title={isAdded ? "Added to Liked Songs" : "Add to Liked Songs"}
        >
          <svg
            viewBox="0 0 24 24"
            fill={isAdded ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {isAdded ? "Liked" : "Like"}
        </button>
      )}
    </div>
  );
};

// Skeleton loading item with shimmer animation
const SkeletonResultItem = ({ delay = 0 }: { delay?: number }) => {
  return (
    <div
      className="flex items-center gap-4 px-5 py-3 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Cover skeleton */}
      <div className="w-12 h-12 rounded-md bg-theme-surface-hover flex-shrink-0 overflow-hidden relative">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>

      {/* Info skeleton */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 bg-theme-surface-hover rounded-md w-3/4 overflow-hidden relative">
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
        <div className="h-3 bg-theme-surface-hover rounded-md w-1/2 overflow-hidden relative">
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      </div>

      {/* Duration skeleton */}
      <div className="w-10 h-4 bg-theme-surface-hover rounded-md flex-shrink-0 overflow-hidden relative">
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      </div>
    </div>
  );
};

// Skeleton section for loading states
const SkeletonSection = ({
  title,
  color,
  count = 3,
}: {
  title: string;
  color: string;
  count?: number;
}) => {
  return (
    <div className="py-2">
      <div className="px-5 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wider flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color} animate-pulse`} />
        {title}
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonResultItem key={i} delay={i * 75} />
      ))}
    </div>
  );
};

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

export const SearchPalette = ({ isOpen, onClose, onNavigate }: SearchPaletteProps) => {
  const {
    playTrack,
    playlists,
    addToPlaylist,
    toggleFavorite,

    streamQuality,
    searchProviderOrder,
  } = usePlayer();
  const { downloads } = useDownload();
  const [query, setQuery] = useState("");
  const [localResults, setLocalResults] = useState<SearchResult[]>([]);
  const [tidalResults, setTidalResults] = useState<SearchResult[]>([]);
  const [subsonicResults, setSubsonicResults] = useState<SearchResult[]>([]);
  const [jellyfinResults, setJellyfinResults] = useState<SearchResult[]>([]);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [loadingTidal, setLoadingTidal] = useState(false);
  const [loadingSubsonic, setLoadingSubsonic] = useState(false);
  const [loadingJellyfin, setLoadingJellyfin] = useState(false);
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [addedTracks, setAddedTracks] = useState<Set<string>>(new Set());

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    items: ContextMenuItem[];
    position: { x: number; y: number };
  }>({ isOpen: false, items: [], position: { x: 0, y: 0 } });

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const paletteContainerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 150);

  const currentQueryRef = useRef(query);

  // Create a set of local track keys (provider:externalId) for deduplication
  const localTrackKeys = useMemo(
    () => new Set(
      localResults
        .filter((r) => r.providerId && r.externalId)
        .map((r) => `${r.providerId}:${r.externalId}`)
    ),
    [localResults],
  );

  // Filter out Tidal results that already exist locally
  const filteredTidalResults = useMemo(
    () => tidalResults.filter((r) => {
      if (!r.providerId || !r.externalId) return true;
      const key = `${r.providerId}:${r.externalId}`;
      return !localTrackKeys.has(key);
    }),
    [tidalResults, localTrackKeys],
  );

  const allResults = useMemo(() => {
    const resultsByType: Record<string, SearchResult[]> = {
      local: localResults,
      tidal: filteredTidalResults,
      subsonic: subsonicResults,
      jellyfin: jellyfinResults,
    };

    return searchProviderOrder.flatMap((type) => resultsByType[type] || []);
  }, [
    localResults,
    filteredTidalResults,
    subsonicResults,
    jellyfinResults,
    searchProviderOrder,
  ]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setLocalResults([]);
      setTidalResults([]);
      setSubsonicResults([]);
      setJellyfinResults([]);
      setSelectedIndex(0);
      setAddedTracks(new Set());
      setTimeout(() => inputRef.current?.focus(), 50);

      // Fetch configured providers
      getProviderConfigs().then(setProviderConfigs).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    const activeQuery = debouncedQuery;
    currentQueryRef.current = activeQuery;

    if (!activeQuery || activeQuery.length < 2) {
      setLocalResults([]);
      return;
    }

    const searchLocal = async () => {
      setLoadingLocal(true);
      try {
        console.log("Searching local library for:", activeQuery);
        const results = await searchLibrary(activeQuery);

        // Stale check
        if (currentQueryRef.current !== activeQuery) {
          console.log("Discarding stale local results for:", activeQuery);
          return;
        }

        console.log("FTS search results:", results);

        setLocalResults(
          results.map((track) => ({
            id: track.id,
            type: "local" as const,
            title: track.title,
            artist: track.artist,
            album: track.album,
            duration: track.duration,
            cover: track.cover_image,
            providerId: track.provider_id,
            externalId: track.external_id,
            track,
          })),
        );
      } catch (e) {
        if (currentQueryRef.current === activeQuery) {
          console.error("Local search failed:", e);
          setLocalResults([]);
        }
      } finally {
        if (currentQueryRef.current === activeQuery) {
          setLoadingLocal(false);
        }
      }
    };

    searchLocal();
  }, [debouncedQuery]);

  useEffect(() => {
    const activeQuery = debouncedQuery;

    if (!activeQuery || activeQuery.length < 2) {
      setTidalResults([]);
      return;
    }

    const searchTidal = async () => {
      setLoadingTidal(true);
      try {
        console.log("Searching Tidal for:", activeQuery);
        const response: any = await invoke("tidal_search_tracks", {
          query: activeQuery,
        });

        // Stale check
        if (currentQueryRef.current !== activeQuery) {
          console.log("Discarding stale Tidal results for:", activeQuery);
          return;
        }

        console.log("Tidal search results:", response);
        const items: TidalTrack[] = response.items || [];

        setTidalResults(
          items.slice(0, 15).map((track) => ({
            id: `tidal-${track.id}`,
            type: "tidal" as const,
            title: track.title,
            artist: track.artist?.name || "Unknown Artist",
            album: track.album?.title || "",
            duration: track.duration || 0,
            cover: track.album?.cover
              ? `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, "/")}/160x160.jpg`
              : undefined,
            providerId: "tidal",
            externalId: track.id.toString(),
            track,
          })),
        );
      } catch (e) {
        if (currentQueryRef.current === activeQuery) {
          console.error("Tidal search failed:", e);
          setTidalResults([]);
        }
      } finally {
        if (currentQueryRef.current === activeQuery) {
          setLoadingTidal(false);
        }
      }
    };

    const timer = setTimeout(searchTidal, 200);
    return () => clearTimeout(timer);
  }, [debouncedQuery]);

  // Subsonic search effect
  useEffect(() => {
    const activeQuery = debouncedQuery;
    const subsonicConfigured = providerConfigs.some(
      (c) => c.provider_id === "subsonic",
    );

    if (!activeQuery || activeQuery.length < 2 || !subsonicConfigured) {
      setSubsonicResults([]);
      return;
    }

    const searchSubsonic = async () => {
      setLoadingSubsonic(true);
      try {
        console.log("Searching Subsonic for:", activeQuery);
        const response: any = await invoke("search_music", {
          query: activeQuery,
          providerId: "subsonic",
        });

        if (currentQueryRef.current !== activeQuery) return;

        const tracks = response.tracks || [];
        setSubsonicResults(
          tracks.slice(0, 15).map((track: any) => ({
            id: `subsonic-${track.id}`,
            type: "subsonic" as const,
            title: track.title,
            artist: track.artist || "Unknown Artist",
            album: track.album || "",
            duration: track.duration || 0,
            cover: track.cover_url,
            track,
          })),
        );
      } catch (e) {
        if (currentQueryRef.current === activeQuery) {
          console.error("Subsonic search failed:", e);
          setSubsonicResults([]);
        }
      } finally {
        if (currentQueryRef.current === activeQuery) {
          setLoadingSubsonic(false);
        }
      }
    };

    const timer = setTimeout(searchSubsonic, 200);
    return () => clearTimeout(timer);
  }, [debouncedQuery, providerConfigs]);

  // Jellyfin search effect
  useEffect(() => {
    const activeQuery = debouncedQuery;
    const jellyfinConfigured = providerConfigs.some(
      (c) => c.provider_id === "jellyfin",
    );

    if (!activeQuery || activeQuery.length < 2 || !jellyfinConfigured) {
      setJellyfinResults([]);
      return;
    }

    const searchJellyfin = async () => {
      setLoadingJellyfin(true);
      try {
        console.log("Searching Jellyfin for:", activeQuery);
        const response: any = await invoke("search_music", {
          query: activeQuery,
          providerId: "jellyfin",
        });

        if (currentQueryRef.current !== activeQuery) return;

        const tracks = response.tracks || [];
        setJellyfinResults(
          tracks.slice(0, 15).map((track: any) => ({
            id: `jellyfin-${track.id}`,
            type: "jellyfin" as const,
            title: track.title,
            artist: track.artist || "Unknown Artist",
            album: track.album || "",
            duration: track.duration || 0,
            cover: track.cover_url,
            track,
          })),
        );
      } catch (e) {
        if (currentQueryRef.current === activeQuery) {
          console.error("Jellyfin search failed:", e);
          setJellyfinResults([]);
        }
      } finally {
        if (currentQueryRef.current === activeQuery) {
          setLoadingJellyfin(false);
        }
      }
    };

    const timer = setTimeout(searchJellyfin, 200);
    return () => clearTimeout(timer);
  }, [debouncedQuery, providerConfigs]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [allResults.length]);

  useEffect(() => {
    if (resultsRef.current && allResults.length > 0) {
      const selectedElement = resultsRef.current.querySelector(
        `[data-index="${selectedIndex}"]`,
      );
      selectedElement?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex, allResults.length]);

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({
      ...prev,
      isOpen: false,
      items: [],
      position: { x: 0, y: 0 },
    }));
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!contextMenu || !resultsRef.current) return;

    const resultsContainer = resultsRef.current;
    const handleScroll = () => {
      closeContextMenu();
    };

    resultsContainer.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    return () => {
      resultsContainer.removeEventListener("scroll", handleScroll);
    };
  }, [contextMenu, closeContextMenu]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (contextMenu.isOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeContextMenu();
        }
        if (["ArrowDown", "ArrowUp", "Enter", "Tab"].includes(e.key)) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, allResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (allResults[selectedIndex]) {
            handlePlay(allResults[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            setSelectedIndex(
              (prev) => (prev - 1 + allResults.length) % allResults.length,
            );
          } else {
            setSelectedIndex((prev) => (prev + 1) % allResults.length);
          }
          break;
      }
    },
    [allResults, selectedIndex, onClose, contextMenu, closeContextMenu],
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  const handlePlay = async (result: SearchResult) => {
    if (result.type === "local") {
      const track = result.track as UnifiedTrack;
      playTrack(track as any, [track] as any);
      onClose();
    } else if (result.type === "tidal") {
      const track = result.track as TidalTrack;
      try {
        const coverUrl = track.album?.cover
          ? `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, "/")}/640x640.jpg`
          : null;

        await invoke("play_tidal_track", {
          trackId: track.id,
          title: track.title,
          artist: track.artist?.name || "Unknown",
          album: track.album?.title || "Unknown",
          duration: track.duration || 0,
          coverUrl,
          quality: streamQuality,
        });
        onClose();
      } catch (e) {
        console.error("Failed to play Tidal track:", e);
      }
    } else if (result.type === "subsonic" || result.type === "jellyfin") {
      // Use generic provider track play command
      try {
        const providerId = result.type;
        const trackId = result.id.replace(`${providerId}-`, "");

        await invoke("play_provider_track", {
          providerId,
          trackId,
          title: result.title,
          artist: result.artist,
          album: result.album,
          duration: result.duration,
          coverUrl: result.cover,
        });
        onClose();
      } catch (e) {
        console.error(`Failed to play ${result.type} track:`, e);
      }
    }
  };

  const handleAddToLikedSongs = async (
    result: SearchResult,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const track = getTrackFromResult(result);
    // Use toggleFavorite which handles both adding and removing
    // and supports generic providers via UnifiedTrack
    await toggleFavorite(track);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTrackFromResult = (result: SearchResult): UnifiedTrack => {
    if (result.type === "local") {
      return result.track as UnifiedTrack;
    }

    if (result.type === "subsonic" || result.type === "jellyfin") {
      const providerId = result.type;
      const externalId = result.id.replace(`${providerId}-`, "");
      return {
        ...result.track,
        id: result.id,
        source: result.type === "subsonic" ? "SUBSONIC" : "JELLYFIN",
        provider_id: providerId,
        external_id: externalId,
        cover_image: result.cover,
        path: `${providerId}:${externalId}`,
      } as unknown as UnifiedTrack;
    }

    const t = result.track as TidalTrack;
    return {
      id: `tidal-${t.id}`,
      title: t.title,
      artist: t.artist?.name || "Unknown",
      album: t.album?.title || "Unknown",
      duration: t.duration || 0,
      cover_image: t.album?.cover
        ? `https://resources.tidal.com/images/${t.album.cover.replace(/-/g, "/")}/640x640.jpg`
        : undefined,
      path: `tidal:${t.id}`,
      source: "TIDAL",
      provider_id: "tidal",
      external_id: t.id.toString(),
    } as unknown as UnifiedTrack;
  };

  const handleContextMenu = (e: React.MouseEvent, result: SearchResult) => {
    e.preventDefault();
    e.stopPropagation();

    const track = getTrackFromResult(result);
    const isLocal = result.type === "local";

    setContextMenu({
      isOpen: true,
      items: [
        {
          label: "Play",
          action: () => handlePlay(result),
        },
        {
          label: "Add to Liked Songs",
          action: () => {
            if (isLocal) {
              toggleFavorite(track);
            } else {
              handleAddToLikedSongs(result, e);
            }
          },
        },
        {
          label: "Add to Playlist",
          submenu: playlists.map((pl) => ({
            label: pl.title,
            action: async () => {
              await addToPlaylist(pl.id, track);
            },
          })),
        },
      ],
      position: { x: e.clientX, y: e.clientY },
    });
  };

  if (!isOpen) return null;

  const isLoading = loadingLocal || loadingTidal;
  const hasQuery = query.length >= 2;
  const hasResults = allResults.length > 0;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/70 backdrop-blur-md animate-fade-in"
    >
      <div
        ref={paletteContainerRef}
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in ring-1 ring-white/5"
        style={{
          backgroundColor: "var(--theme-background-secondary, #1a1a20)",
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (contextMenu) {
            closeContextMenu();
          }
        }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
          <svg
            className="w-5 h-5 text-theme-muted flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search your library and Tidal..."
            className="flex-1 bg-transparent text-lg text-theme-primary placeholder:text-theme-muted/60 focus:outline-none pt-[5px]"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {isLoading && (
            <div className="animate-pulse">
              <AppLogo size={20} className="text-theme-accent" />
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-theme-muted/70">
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 font-mono text-[10px]">
              esc
            </kbd>
            <span className="text-[11px] translate-y-[1px]">to close</span>
          </div>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-[60vh] overflow-y-auto overscroll-contain"
        >
          {/* Empty State */}
          {!hasQuery && (
            <div className="flex flex-col items-center justify-center py-16 text-theme-muted">
              <div className="mb-4 text-theme-muted/20">
                <AppLogo size={64} />
              </div>
              <p className="text-sm">Start typing to search</p>
              <p className="text-xs mt-1 opacity-70">
                Search your library and Tidal
              </p>
            </div>
          )}

          {hasQuery && !hasResults && isLoading && (
            <>
              {loadingLocal && (
                <SkeletonSection
                  title="Searching Library..."
                  color="bg-emerald-500"
                  count={2}
                />
              )}
              {loadingTidal && (
                <div className={loadingLocal ? "border-t border-white/5" : ""}>
                  <SkeletonSection
                    title="Searching Tidal..."
                    color="bg-blue-500"
                    count={4}
                  />
                </div>
              )}
            </>
          )}

          {hasQuery && !hasResults && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-theme-muted">
              <svg
                className="w-12 h-12 mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm">No results for "{query}"</p>
              <p className="text-xs mt-1 opacity-70">
                Try a different search term
              </p>
            </div>
          )}

          {/* Dynamic Results Sections - respects user's provider order */}
          {(() => {
            let lastType: string | null = null;
            const sectionConfig: Record<
              string,
              { label: string; color: string; loading?: boolean }
            > = {
              local: { label: "In Your Library", color: "bg-emerald-500" },
              tidal: {
                label: "From Tidal",
                color: "bg-blue-500",
                loading: loadingTidal,
              },
              subsonic: {
                label: "From Subsonic",
                color: "bg-orange-500",
                loading: loadingSubsonic,
              },
              jellyfin: {
                label: "From Jellyfin",
                color: "bg-purple-500",
                loading: loadingJellyfin,
              },
            };

            return allResults.map((result, index) => {
              const showHeader = result.type !== lastType;
              const isFirstSection = lastType === null;
              lastType = result.type;
              const config = sectionConfig[result.type] || {
                label: result.type,
                color: "bg-gray-500",
              };

              const isAdded =
                result.type === "tidal" && result.providerId && result.externalId && addedTracks.has(`${result.providerId}:${result.externalId}`);
              const isDownloaded =
                result.type === "local" &&
                (() => {
                  const t = result.track as UnifiedTrack;
                  return (
                    (!!t.local_path && t.local_path !== "") ||
                    (!!t.audio_quality && t.audio_quality !== "")
                  );
                })();

              return (
                <div key={result.id}>
                  {showHeader && (
                    <div
                      className={`py-2 ${!isFirstSection ? "border-t border-white/5" : ""}`}
                    >
                      <div className="px-5 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wider flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${config.color}`}
                        />
                        {config.label}
                        {config.loading && (
                          <span className="text-theme-muted/50">
                            (loading...)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <SearchResultItem
                    result={result}
                    index={index}
                    isSelected={selectedIndex === index}
                    onPlay={() => handlePlay(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    formatDuration={formatDuration}
                    showAddButton={result.type === "tidal"}
                    isAdded={!!isAdded}
                    onAdd={
                      result.type === "tidal"
                        ? (e) => handleAddToLikedSongs(result, e)
                        : undefined
                    }
                    onContextMenu={(e) => handleContextMenu(e, result)}
                    downloadState={
                      result.providerId && result.externalId
                        ? downloads.get(result.providerId === 'tidal' ? result.externalId : `${result.providerId}:${result.externalId}`)
                        : undefined
                    }
                    isDownloaded={isDownloaded}
                  />
                </div>
              );
            });
          })()}
        </div>

        {hasResults && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 bg-black/20 text-xs text-theme-muted/80">
            <div className="flex items-center gap-4 pt-[2px]">
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 font-mono text-[10px]">
                  ↑↓
                </kbd>
                <span className="text-[11px]">navigate</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 font-mono text-[10px]">
                  ↵
                </kbd>
                <span className="text-[11px]">play</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              {onNavigate && query.length >= 2 && (
                <button
                  onClick={() => onNavigate(`search:${query}`)}
                  className="text-[11px] text-theme-accent hover:text-theme-accent/80 transition-colors font-medium"
                >
                  View all results →
                </button>
              )}
              <span className="text-[11px] pt-[2px]">
                {allResults.length} result{allResults.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {contextMenu.isOpen && (
          <ContextMenu
            items={contextMenu.items}
            position={contextMenu.position}
            onClose={closeContextMenu}
            containerRef={paletteContainerRef}
          />
        )}
      </div>
    </div>
  );
};
