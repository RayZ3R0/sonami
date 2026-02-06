import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { usePlayer } from "../context/PlayerContext";
import { useContextMenu } from "../context/ContextMenuContext";
import { useTopArtists, QUERY_KEYS } from "../hooks/queries";
import { Track } from "../types";
import { ImageWithFallback } from "./shared/ImageWithFallback";
import {
  RecommendedTrack,
  RecommendationSection,
  TopArtistInfo,
} from "../types/recommendations";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isPlayable = (t: RecommendedTrack) =>
  !!t.matched_provider_id && !!t.matched_external_id;

const toPlayableTrack = (rec: RecommendedTrack): Track | null => {
  if (!isPlayable(rec)) return null;

  // Validate that we have a valid external_id before creating the path
  if (!rec.matched_external_id || rec.matched_external_id.trim() === "") {
    console.error("Invalid track: missing external_id", rec);
    return null;
  }

  // Derive source from provider_id — backend requires this field
  const sourceMap: Record<string, "LOCAL" | "TIDAL" | "SUBSONIC" | "JELLYFIN"> =
    {
      local: "LOCAL",
      tidal: "TIDAL",
      subsonic: "SUBSONIC",
      jellyfin: "JELLYFIN",
    };
  const source = sourceMap[rec.matched_provider_id!] || "LOCAL";

  return {
    id: rec.matched_local_id || crypto.randomUUID(),
    title: rec.title,
    artist: rec.artist,
    artist_id: rec.matched_artist_id,
    album: rec.album || "",
    album_id: rec.matched_album_id,
    duration: Math.floor(rec.duration_ms / 1000),
    cover_image: rec.cover_url,
    path: `${rec.matched_provider_id}:${rec.matched_external_id}`,
    source,
    provider_id: rec.matched_provider_id,
    external_id: rec.matched_external_id,
  };
};

const toPlayableQueue = (tracks: RecommendedTrack[]): Track[] =>
  tracks.map(toPlayableTrack).filter((t): t is Track => t !== null);

// ---------------------------------------------------------------------------
// ProviderBadge (consistent with SearchPage)
// ---------------------------------------------------------------------------

const ProviderBadge = ({ type }: { type: string }) => {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    local: {
      label: "Library",
      bg: "bg-emerald-500/15",
      text: "text-emerald-400",
    },
    tidal: { label: "Tidal", bg: "bg-blue-500/15", text: "text-blue-400" },
    subsonic: {
      label: "Subsonic",
      bg: "bg-orange-500/15",
      text: "text-orange-400",
    },
    jellyfin: {
      label: "Jellyfin",
      bg: "bg-purple-500/15",
      text: "text-purple-400",
    },
  };
  const c = config[type] || {
    label: type,
    bg: "bg-gray-500/15",
    text: "text-gray-400",
  };
  return (
    <span
      className={`text-[9px] font-bold ${c.text} ${c.bg} px-1.5 py-0.5 rounded uppercase tracking-wider`}
    >
      {c.label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Seed Chip
// ---------------------------------------------------------------------------

const SeedChip = ({
  artist,
  isSelected,
  isLoading,
  onToggle,
}: {
  artist: TopArtistInfo;
  isSelected: boolean;
  isLoading: boolean;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    className={`flex-shrink-0 flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-all duration-200 ring-1 pt-[1px] ${
      isSelected
        ? "bg-theme-accent text-white ring-theme-accent shadow-lg shadow-theme-accent/20"
        : "bg-theme-surface text-theme-secondary ring-white/5 hover:bg-theme-surface-hover hover:text-theme-primary"
    }`}
  >
    {isSelected && isLoading && (
      <svg
        className="w-3 h-3 animate-spin flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    )}
    <span className="truncate max-w-[140px]">{artist.name}</span>
    <span className="text-[10px] opacity-60 tabular-nums">
      {artist.play_count}
    </span>
  </button>
);

// ---------------------------------------------------------------------------
// Track Card
// ---------------------------------------------------------------------------

const RecommendedTrackCard = ({
  track,
  onPlay,
  onContextMenu,
  isCurrent,
  isPlaying,
}: {
  track: RecommendedTrack;
  onPlay: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  isCurrent: boolean;
  isPlaying: boolean;
}) => {
  const playable = isPlayable(track);
  const isTrackPlaying = isCurrent && isPlaying;

  return (
    <div
      className={`flex-none w-[180px] md:w-[200px] lg:w-[220px] group select-none ${
        playable ? "cursor-pointer" : "cursor-default"
      }`}
      onClick={playable ? onPlay : undefined}
      onContextMenu={playable ? onContextMenu : undefined}
    >
      {/* Cover */}
      <div
        className={`relative aspect-square w-full rounded-2xl overflow-hidden shadow-sm transition-all duration-300 mb-3 bg-theme-surface ${
          playable ? "hover:shadow-xl transform group-hover:-translate-y-1" : ""
        }`}
      >
        <ImageWithFallback
          src={track.cover_url}
          alt={track.title}
          className={`w-full h-full object-cover ${
            !playable ? "opacity-40 grayscale" : ""
          }`}
          iconType="music"
        />

        {/* Playable overlay */}
        {playable && (
          <div
            className={`absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center ${
              isTrackPlaying
                ? "bg-black/40"
                : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full bg-theme-accent text-white flex items-center justify-center shadow-2xl transform transition-all duration-300 ${
                isTrackPlaying
                  ? "scale-100"
                  : "translate-y-4 group-hover:translate-y-0 group-hover:scale-100"
              }`}
            >
              {isTrackPlaying ? (
                <div className="flex items-end gap-[3px] h-4 mb-1">
                  <span className="w-[3px] bg-white rounded-full animate-music-bar-1 h-3" />
                  <span className="w-[3px] bg-white rounded-full animate-music-bar-2 h-4" />
                  <span className="w-[3px] bg-white rounded-full animate-music-bar-3 h-2" />
                </div>
              ) : (
                <svg
                  className="w-6 h-6 ml-1"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Unavailable overlay */}
        {!playable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="text-xs font-medium text-white/70 bg-black/50 px-2.5 py-1 rounded-full backdrop-blur-sm">
              Not available
            </span>
          </div>
        )}

        {/* Provider badge (top-right) */}
        {track.matched_provider_id && (
          <div className="absolute top-2 right-2">
            <ProviderBadge type={track.matched_provider_id} />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="px-1">
        <h3
          className={`font-semibold truncate text-base mb-0.5 transition-colors ${
            isCurrent
              ? "text-theme-accent"
              : playable
                ? "text-theme-primary group-hover:text-white"
                : "text-theme-muted"
          }`}
        >
          {track.title}
        </h3>
        <p className="text-sm text-theme-muted truncate group-hover:text-theme-secondary transition-colors">
          {track.artist}
        </p>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Section Carousel — arrow-only navigation, no scroll wheel/trackpad
// ---------------------------------------------------------------------------

const SectionCarousel = ({
  section,
  onPlayTrack,
  onContextMenu,
  currentTrackId,
  isPlaying,
  showOnlyPlayable,
}: {
  section: RecommendationSection;
  onPlayTrack: (
    track: RecommendedTrack,
    section: RecommendationSection,
  ) => void;
  onContextMenu: (
    e: React.MouseEvent,
    track: RecommendedTrack,
    section: RecommendationSection,
  ) => void;
  currentTrackId?: string;
  isPlaying: boolean;
  showOnlyPlayable: boolean;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const tracks = showOnlyPlayable
    ? section.tracks.filter(isPlayable)
    : section.tracks;

  const playableCount = section.tracks.filter(isPlayable).length;

  // RAF-debounced scroll state updates (WebKit-compatible, replaces scrollend)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let rafId: number;
    const updateScrollState = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateScrollState);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    updateScrollState(); // Initial state

    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [tracks.length]);

  // Block wheel/trackpad horizontal scrolling (non-passive for preventDefault)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const block = (e: WheelEvent) => {
      // Block all wheel-based horizontal scrolling on the carousel
      if (Math.abs(e.deltaX) > 0 || e.shiftKey) {
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", block, { passive: false });
    return () => el.removeEventListener("wheel", block);
  }, []);

  const handleScroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const amount = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
    }
  };

  if (tracks.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 mb-10">
      {/* Section header */}
      <div className="flex items-center justify-between pl-8 pr-6 md:pl-10 md:pr-8">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-theme-primary tracking-tight truncate">
            {section.title}
          </h2>
          <p className="text-sm text-theme-muted mt-0.5">
            {section.description}
            <span className="mx-1.5 opacity-40">·</span>
            <span className="text-theme-secondary">
              {playableCount} playable
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => handleScroll("left")}
            disabled={!canScrollLeft}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ring-1 ring-white/5 ${
              canScrollLeft
                ? "bg-theme-surface hover:bg-theme-surface-hover text-theme-primary shadow-sm"
                : "bg-theme-surface/50 text-theme-muted/30 cursor-default"
            }`}
            aria-label="Scroll left"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={() => handleScroll("right")}
            disabled={!canScrollRight}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ring-1 ring-white/5 ${
              canScrollRight
                ? "bg-theme-surface hover:bg-theme-surface-hover text-theme-primary shadow-sm"
                : "bg-theme-surface/50 text-theme-muted/30 cursor-default"
            }`}
            aria-label="Scroll right"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Track cards — no wheel scroll, arrow-only, GPU-accelerated */}
      <div
        ref={scrollRef}
        className="flex gap-5 scroll-smooth pb-2 overflow-x-auto overflow-y-hidden no-scrollbar"
        style={{
          WebkitOverflowScrolling: "touch",
          willChange: "transform",
        }}
      >
        <div className="shrink-0 w-3 md:w-5" aria-hidden="true" />
        {tracks.map((track, idx) => {
          const playable = toPlayableTrack(track);
          const isCurrent = !!playable && currentTrackId === playable.id;

          return (
            <RecommendedTrackCard
              key={`${track.spotify_uri}-${idx}`}
              track={track}
              onPlay={() => onPlayTrack(track, section)}
              onContextMenu={(e) => onContextMenu(e, track, section)}
              isCurrent={isCurrent}
              isPlaying={isPlaying}
            />
          );
        })}
        <div className="shrink-0 w-1 md:w-3" aria-hidden="true" />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

const SeedsSkeleton = () => (
  <div className="flex gap-3 pl-8 pr-6 md:pl-10 md:pr-8 overflow-hidden">
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="flex-shrink-0 h-9 rounded-full bg-theme-surface animate-pulse"
        style={{ width: `${80 + ((i * 23) % 50)}px` }}
      />
    ))}
  </div>
);

const SectionSkeleton = () => (
  <div className="pl-8 pr-6 md:pl-10 md:pr-8 mb-10 animate-pulse">
    <div className="h-7 w-48 bg-theme-surface rounded-lg mb-2" />
    <div className="h-4 w-64 bg-theme-surface/70 rounded mb-6" />
    <div className="flex gap-5 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[200px]">
          <div className="aspect-square w-full rounded-2xl bg-theme-surface mb-3" />
          <div className="h-4 w-32 bg-theme-surface/70 rounded mb-1.5" />
          <div className="h-3 w-24 bg-theme-surface/50 rounded" />
        </div>
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Loading bar for progressive section loading
// ---------------------------------------------------------------------------

const ProgressiveLoadingBar = ({
  loaded,
  total,
}: {
  loaded: number;
  total: number;
}) => {
  if (loaded >= total) return null;
  return (
    <div className="flex items-center gap-3 pl-8 pr-6 md:pl-10 md:pr-8 py-4 text-sm text-theme-muted">
      <svg
        className="w-4 h-4 animate-spin flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      Loading more recommendations… ({loaded}/{total})
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main: DiscoverPage
// ---------------------------------------------------------------------------

interface DiscoverPageProps {
  onNavigate: (tab: string) => void;
}

export const DiscoverPage = ({
  onNavigate: _onNavigate,
}: DiscoverPageProps) => {
  const queryClient = useQueryClient();
  const {
    playTrack,
    currentTrack,
    addToPlaylist,
    toggleFavorite,
    isPlaying,
    playlists,
    streamQuality,
  } = usePlayer();
  const { showMenu } = useContextMenu();

  // -- State --
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [showOnlyPlayable, setShowOnlyPlayable] = useState(true);

  // -- Data --
  const { data: topArtists = [], isLoading: loadingArtists } =
    useTopArtists(15);

  // Auto-select top 5 when data arrives if nothing selected
  const seedArtists = useMemo(() => {
    if (selectedArtists.length > 0) return selectedArtists;
    return topArtists.slice(0, 5).map((a) => a.name);
  }, [selectedArtists, topArtists]);

  // Per-artist queries for progressive loading — each artist fetches independently
  const artistQueries = useQueries({
    queries: seedArtists.map((artistName) => ({
      queryKey: QUERY_KEYS.artistRecommendations(artistName),
      queryFn: () =>
        invoke<RecommendationSection>("get_artist_recommendations", {
          artistName,
        }),
      enabled: !!artistName,
      staleTime: 24 * 60 * 60 * 1000, // 24 hours
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  });

  // Sections that have loaded so far (progressive)
  const sections = artistQueries
    .filter((q) => q.isSuccess && q.data)
    .map((q) => q.data as RecommendationSection);

  const loadingRecs = artistQueries.some((q) => q.isLoading);
  const isError =
    artistQueries.every((q) => q.isError) && artistQueries.length > 0;
  const error = artistQueries.find((q) => q.error)?.error;
  const loading = loadingArtists;

  // Track which artists are still loading (for chip spinners)
  const loadingArtistNames = new Set(
    seedArtists.filter((_, i) => artistQueries[i]?.isLoading),
  );

  // -- Handlers --

  const toggleArtist = useCallback((name: string) => {
    setSelectedArtists((prev) => {
      const exists = prev.includes(name);
      if (exists) {
        const next = prev.filter((n) => n !== name);
        return next;
      }
      if (prev.length >= 10) return prev;
      if (prev.length === 0) return [name];
      return [...prev, name];
    });
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["discover"],
    });
  }, [queryClient]);

  const handlePlayTrack = useCallback(
    async (rec: RecommendedTrack, section: RecommendationSection) => {
      if (
        !isPlayable(rec) ||
        !rec.matched_external_id ||
        !rec.matched_provider_id
      )
        return;

      try {
        if (rec.matched_provider_id === "tidal") {
          // Strip provider prefix if present (e.g., "tidal:12345" -> "12345")
          const stripPrefix = (id: string | undefined) => {
            if (!id) return null;
            const parts = id.split(":");
            return parts.length > 1 ? parseInt(parts[1], 10) : parseInt(id, 10);
          };

          // Use play_tidal_track for full metadata support
          await invoke("play_tidal_track", {
            trackId: parseInt(rec.matched_external_id, 10),
            title: rec.title,
            artist: rec.artist,
            artistId: stripPrefix(rec.matched_artist_id),
            album: rec.album || "Unknown",
            albumId: stripPrefix(rec.matched_album_id),
            duration: Math.floor(rec.duration_ms / 1000),
            coverUrl: rec.cover_url || null,
            quality: streamQuality,
          });
        } else if (
          rec.matched_provider_id === "subsonic" ||
          rec.matched_provider_id === "jellyfin"
        ) {
          // Use play_provider_track for generic providers
          await invoke("play_provider_track", {
            providerId: rec.matched_provider_id,
            trackId: rec.matched_external_id,
            title: rec.title,
            artist: rec.artist,
            artistId: rec.matched_artist_id || null,
            album: rec.album || "Unknown",
            albumId: rec.matched_album_id || null,
            duration: Math.floor(rec.duration_ms / 1000),
            coverUrl: rec.cover_url || null,
          });
        } else {
          // Fallback to generic playTrack for local/unknown providers
          const track = toPlayableTrack(rec);
          if (!track) return;
          const queue = toPlayableQueue(section.tracks);
          playTrack(track, queue);
        }
      } catch (e) {
        console.error(`Failed to play ${rec.matched_provider_id} track:`, e);
      }
    },
    [playTrack, streamQuality],
  );

  const handleContextMenu = useCallback(
    (
      e: React.MouseEvent,
      rec: RecommendedTrack,
      section: RecommendationSection,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const track = toPlayableTrack(rec);
      if (!track) return;
      const queue = toPlayableQueue(section.tracks);

      showMenu(
        [
          {
            label: "Play",
            action: () => playTrack(track, queue),
          },
          {
            label: "Add to Liked Songs",
            action: () => toggleFavorite(track),
          },
          {
            label: "Add to Playlist",
            submenu: playlists.map((pl) => ({
              label: pl.title,
              action: () => addToPlaylist(pl.id, track),
            })),
          },
        ],
        { x: e.clientX, y: e.clientY },
      );
    },
    [playTrack, toggleFavorite, addToPlaylist, playlists, showMenu],
  );

  const currentTrackId = currentTrack?.id;
  const showPlayerState = isPlaying && !!currentTrack;

  // -- Empty state (no listening history at all) --
  if (!loadingArtists && topArtists.length === 0) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-32">
          <div className="pl-8 pr-6 md:pl-10 md:pr-8 pt-9 pb-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-theme-primary">
              Discover
            </h1>
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-20 h-20 rounded-full bg-theme-surface flex items-center justify-center mb-6">
              <svg
                className="w-10 h-10 text-theme-muted/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <p className="text-xl text-theme-secondary font-medium mb-2">
              Start listening to discover new music
            </p>
            <p className="text-sm text-theme-muted max-w-md">
              Play some tracks to build your listening history. We'll use your
              favorite artists to find new music you'll love.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -- Full loading state (artists haven't loaded yet) --
  if (loading) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-32">
          <div className="pl-8 pr-6 md:pl-10 md:pr-8 pt-9 pb-6">
            <div className="h-12 w-52 bg-theme-surface rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-theme-surface/60 rounded mt-3 animate-pulse" />
          </div>
          <SeedsSkeleton />
          <div className="mt-10">
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Header */}
        <div className="pl-8 pr-6 md:pl-10 md:pr-8 pt-9 pb-2 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-theme-primary">
              Discover
            </h1>
            <p className="text-sm text-theme-muted mt-1">
              Music recommendations based on what you love
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 pb-1">
            {/* Playable-only toggle */}
            <button
              onClick={() => setShowOnlyPlayable((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ring-1 ${
                showOnlyPlayable
                  ? "bg-theme-accent/15 text-theme-accent ring-theme-accent/30"
                  : "bg-theme-surface text-theme-muted ring-white/5 hover:text-theme-secondary"
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Playable
            </button>
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="w-8 h-8 rounded-full bg-theme-surface hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary flex items-center justify-center transition-colors ring-1 ring-white/5"
              aria-label="Refresh recommendations"
              title="Refresh"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Seed chips */}
        {topArtists.length > 0 && (
          <div className="mt-4 mb-8">
            <div
              className="flex gap-2.5 overflow-x-auto pt-1 pb-3 scrollbar-hide"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div
                className="shrink-0 w-[1.375rem] md:w-[1.875rem]"
                aria-hidden="true"
              />
              {topArtists.map((artist) => (
                <SeedChip
                  key={artist.id}
                  artist={artist}
                  isSelected={seedArtists.includes(artist.name)}
                  isLoading={loadingArtistNames.has(artist.name)}
                  onToggle={() => toggleArtist(artist.name)}
                />
              ))}
              <div
                className="shrink-0 w-[0.875rem] md:w-[1.375rem]"
                aria-hidden="true"
              />
            </div>
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <p className="text-theme-secondary font-medium mb-1">
              Couldn't load recommendations
            </p>
            <p className="text-sm text-theme-muted mb-4 max-w-sm">
              {(error as Error)?.message || "Something went wrong. Try again."}
            </p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded-full bg-theme-accent text-white text-sm font-medium hover:bg-theme-accent-hover transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Recommendation sections (progressive) */}
        {!isError && (
          <div>
            {/* Show loaded sections as they arrive */}
            {sections.map((section) => (
              <SectionCarousel
                key={section.seed_artist}
                section={section}
                onPlayTrack={handlePlayTrack}
                onContextMenu={handleContextMenu}
                currentTrackId={currentTrackId}
                isPlaying={showPlayerState}
                showOnlyPlayable={showOnlyPlayable}
              />
            ))}

            {/* Skeleton placeholders for sections still loading */}
            {loadingRecs && (
              <>
                {sections.length === 0 && <SectionSkeleton />}
                <SectionSkeleton />
              </>
            )}

            {/* Progressive loading indicator */}
            {!loadingRecs && sections.length > 0 && (
              <ProgressiveLoadingBar
                loaded={sections.length}
                total={seedArtists.length}
              />
            )}

            {/* Nothing came back at all */}
            {!loadingRecs && sections.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <p className="text-theme-secondary font-medium mb-1">
                  No recommendations found
                </p>
                <p className="text-sm text-theme-muted max-w-sm">
                  We couldn't find recommendations for the selected artists. Try
                  selecting different artists or refreshing.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
