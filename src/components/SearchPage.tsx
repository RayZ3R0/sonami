import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  useSearch,
  UnifiedSearchTrack,
  UnifiedSearchAlbum,
  UnifiedSearchArtist,
} from "../hooks/useSearch";
import { usePlayer } from "../context/PlayerContext";
import { useContextMenu } from "../context/ContextMenuContext";
import { usePlaylistMenu } from "../hooks/usePlaylistMenu";
import { AppLogo } from "./icons/AppLogo";
import { Track } from "../types";
import { ContextMenuItem } from "./ContextMenu";
import { CreatePlaylistModal } from "./CreatePlaylistModal";
import { useIsMobile } from "../hooks/useIsMobile";

interface SearchPageProps {
  initialQuery?: string;
  onNavigate: (tab: string) => void;
}

type FilterTab = "all" | "artists" | "albums" | "tracks";

// ... (ProviderBadge, ArtistCard, AlbumCard, TrackRow components skipped for brevity)

// ProviderBadge
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
// ... other components

const ArtistCard = ({
  artist,
  onClick,
}: {
  artist: UnifiedSearchArtist;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-3 p-4 rounded-xl bg-theme-surface-hover/50 hover:bg-theme-surface-active transition-all group w-40 flex-shrink-0"
  >
    <div className="relative">
      {artist.cover ? (
        <img
          src={artist.cover}
          alt={artist.name}
          className="w-24 h-24 rounded-full object-cover shadow-lg group-hover:shadow-xl transition-shadow"
        />
      ) : (
        <div className="w-24 h-24 rounded-full bg-theme-surface-active flex items-center justify-center">
          <svg
            className="w-10 h-10 text-theme-muted/50"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-theme-accent flex items-center justify-center shadow-lg">
          <svg
            className="w-5 h-5 text-white ml-0.5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
    <div className="text-center min-w-0 w-full">
      <p className="font-medium text-theme-primary truncate">{artist.name}</p>
      <div className="flex items-center justify-center gap-1.5 mt-1">
        <ProviderBadge type={artist.type} />
      </div>
    </div>
  </button>
);

const AlbumCard = ({
  album,
  onClick,
}: {
  album: UnifiedSearchAlbum;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex flex-col gap-3 p-3 rounded-xl bg-theme-surface-hover/50 hover:bg-theme-surface-active transition-all group w-44 flex-shrink-0"
  >
    <div className="relative">
      {album.cover ? (
        <img
          src={album.cover}
          alt={album.title}
          className="w-full aspect-square rounded-lg object-cover shadow-lg group-hover:shadow-xl transition-shadow"
        />
      ) : (
        <div className="w-full aspect-square rounded-lg bg-theme-surface-active flex items-center justify-center">
          <AppLogo size={40} className="text-theme-muted/50" />
        </div>
      )}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
        <div className="w-12 h-12 rounded-full bg-theme-accent flex items-center justify-center shadow-xl">
          <svg
            className="w-6 h-6 text-white ml-0.5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
    <div className="min-w-0 w-full text-left">
      <p className="font-medium text-theme-primary truncate">{album.title}</p>
      <p className="text-sm text-theme-muted truncate">
        {album.artist}
        {album.year && ` • ${album.year}`}
      </p>
      <div className="flex items-center gap-1.5 mt-1.5">
        <ProviderBadge type={album.type} />
      </div>
    </div>
  </button>
);

const TrackRow = ({
  track,
  index,
  onPlay,
  isPlaying,
  onContextMenu,
  isMobile,
}: {
  track: UnifiedSearchTrack;
  index: number;
  onPlay: () => void;
  isPlaying?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  isMobile?: boolean;
}) => {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center w-full">
      <button
        onClick={onPlay}
        onContextMenu={onContextMenu}
        className={`flex-1 flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-theme-surface-hover transition-colors group text-left ${isPlaying ? "bg-theme-accent/10" : ""}`}
      >
        <div className="w-8 text-center text-theme-muted text-sm font-mono tabular-nums">
          <span className="group-hover:hidden">{index + 1}</span>
          <svg
            className="w-4 h-4 hidden group-hover:block mx-auto text-theme-primary"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <div className="relative flex-shrink-0">
          {track.cover ? (
            <img
              src={track.cover}
              alt={track.album}
              className="w-10 h-10 rounded object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-theme-surface-active flex items-center justify-center">
              <AppLogo size={20} className="text-theme-muted/50" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`font-medium truncate ${isPlaying ? "text-theme-accent" : "text-theme-primary"}`}
          >
            {track.title}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-theme-muted truncate">{track.artist}</p>
            <ProviderBadge type={track.type} />
          </div>
        </div>
        <div className="text-sm text-theme-muted font-mono tabular-nums">
          {formatDuration(track.duration)}
        </div>
      </button>
      {/* Mobile menu button */}
      {isMobile && onContextMenu && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e);
          }}
          className="p-2 mr-2 text-theme-muted hover:text-theme-primary rounded-lg hover:bg-theme-surface-hover transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
      )}
    </div>
  );
};

const SectionHeader = ({
  title,
  onSeeAll,
  count,
}: {
  title: string;
  onSeeAll?: () => void;
  count?: number;
}) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-xl font-bold text-theme-primary">{title}</h2>
    {onSeeAll && count && count > 0 && (
      <button
        onClick={onSeeAll}
        className="text-sm font-medium text-theme-muted hover:text-theme-primary transition-colors"
      >
        See all
      </button>
    )}
  </div>
);

const HorizontalScroll = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent -mx-2 px-2">
    {children}
  </div>
);

export const SearchPage = ({
  initialQuery = "",
  onNavigate,
}: SearchPageProps) => {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { playTrack, toggleFavorite, favorites, playlists, refreshPlaylists } =
    usePlayer();
  const { showMenu } = useContextMenu();

  // Playlist menu hook for toggle functionality
  const { buildPlaylistSubmenu } = usePlaylistMenu({
    playlists,
    refreshPlaylists,
    onCreatePlaylistClick: () => setShowCreatePlaylist(true),
  });

  const searchTypes = useMemo((): ("track" | "album" | "artist")[] => {
    if (activeTab === "all") return ["track", "album", "artist"];
    if (activeTab === "tracks") return ["track"];
    if (activeTab === "albums") return ["album"];
    return ["artist"];
  }, [activeTab]);

  const { results, isLoading } = useSearch({
    query,
    types: searchTypes,
    enabled: query.length >= 2,
  });

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Convert search track to Track format for like/play operations
  const convertToTrack = useCallback((track: UnifiedSearchTrack): Track => {
    return {
      id: track.id,
      title: track.title,
      artist: track.artist,
      artist_id: track.artistId || track.artist_id,
      album: track.album,
      album_id: track.albumId || track.album_id,
      duration: track.duration,
      cover_image: track.cover,
      path: track.path || track.id,
      source: track.type.toUpperCase() as Track["source"],
      provider_id: track.providerId || track.type,
      external_id: track.externalId || track.id.split(":").pop() || track.id,
    };
  }, []);

  const handlePlayTrack = useCallback(
    async (track: UnifiedSearchTrack) => {
      const t = convertToTrack(track);
      console.log("[SearchPage] Playing track:", t);
      await playTrack(t, [t]);
    },
    [playTrack, convertToTrack],
  );

  // Build context menu items for a track
  const getMenuItemsForTrack = useCallback(
    async (searchTrack: UnifiedSearchTrack): Promise<ContextMenuItem[]> => {
      const track = convertToTrack(searchTrack);
      const isFavorited = favorites.has(track.id) || favorites.has(track.path);

      // Build playlist submenu with toggle functionality
      const playlistSubmenu = await buildPlaylistSubmenu(track);

      const items: ContextMenuItem[] = [
        {
          label: "Play",
          action: () => handlePlayTrack(searchTrack),
        },
        {
          label: isFavorited ? "Remove from Liked Songs" : "Add to Liked Songs",
          action: () => toggleFavorite(track),
        },
        {
          label: "Add to Playlist",
          submenu: playlistSubmenu,
        },
      ];

      return items;
    },
    [
      favorites,
      toggleFavorite,
      handlePlayTrack,
      convertToTrack,
      buildPlaylistSubmenu,
    ],
  );

  const handleContextMenu = useCallback(
    async (e: React.MouseEvent, track: UnifiedSearchTrack) => {
      e.preventDefault();
      e.stopPropagation();
      const items = await getMenuItemsForTrack(track);
      showMenu(
        items,
        { x: e.clientX, y: e.clientY },
        {
          title: track.title,
          subtitle: track.artist,
          coverImage: track.cover,
        },
      );
    },
    [getMenuItemsForTrack, showMenu],
  );

  const handleNavigateToArtist = (artist: UnifiedSearchArtist) => {
    onNavigate(`artist:${artist.id}`);
  };

  const handleNavigateToAlbum = (album: UnifiedSearchAlbum) => {
    onNavigate(`album:${album.id}`);
  };

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "artists", label: "Artists" },
    { id: "albums", label: "Albums" },
    { id: "tracks", label: "Tracks" },
  ];

  const hasResults =
    results.tracks.length > 0 ||
    results.albums.length > 0 ||
    results.artists.length > 0;
  const hasQuery = query.length >= 2;

  return (
    <div className="flex flex-col h-full">
      <div
        className={`sticky top-0 z-10 bg-theme-background-secondary/95 backdrop-blur-xl border-b border-white/5 px-8 ${isMobile ? "pt-0 pb-2" : "pt-6 pb-2"}`}
      >
        <div className={`flex flex-col ${isMobile ? "gap-2" : "gap-4"}`}>
          {!isMobile && (
            <div className="relative group">
              <svg
                className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 text-theme-muted group-focus-within:text-theme-accent transition-colors"
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
                placeholder="Search..."
                className="w-full pl-12 pr-4 pt-3 pb-1 text-4xl font-bold bg-transparent border-none outline-none ring-0 text-white placeholder:text-white/20 focus:outline-none focus:ring-0 focus:border-none transition-none"
              />
              {isLoading && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 animate-pulse">
                  <AppLogo size={24} className="text-theme-accent" />
                </div>
              )}
            </div>
          )}

          {hasQuery && (
            <div className="flex items-center gap-2 pb-2 overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 pt-2 pb-1 rounded-full text-sm font-medium transition-all backdrop-blur-sm ${
                    activeTab === tab.id
                      ? "bg-theme-accent text-white shadow-lg shadow-theme-accent/20"
                      : "bg-white/5 hover:bg-white/10 text-theme-muted hover:text-white border border-white/5 hover:border-white/10"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {!hasQuery && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <AppLogo size={80} className="text-theme-muted/20 mb-6" />
            <h2 className="text-2xl font-bold text-theme-primary mb-2">
              Search Sonami
            </h2>
            <p className="text-theme-muted max-w-md">
              Find your favorite artists, albums, and tracks across your
              library, Tidal, Subsonic, and Jellyfin.
            </p>
          </div>
        )}

        {hasQuery && !hasResults && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg
              className="w-16 h-16 text-theme-muted/30 mb-6"
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
            <h2 className="text-xl font-bold text-theme-primary mb-2">
              No results found
            </h2>
            <p className="text-theme-muted">
              No results for "{query}". Try a different search term.
            </p>
          </div>
        )}

        {hasQuery && hasResults && activeTab === "all" && (
          <div className="space-y-10">
            {results.artists.length > 0 && (
              <section>
                <SectionHeader
                  title="Artists"
                  onSeeAll={() => setActiveTab("artists")}
                  count={results.artists.length}
                />
                <HorizontalScroll>
                  {results.artists.slice(0, 6).map((artist) => (
                    <ArtistCard
                      key={artist.id}
                      artist={artist}
                      onClick={() => handleNavigateToArtist(artist)}
                    />
                  ))}
                </HorizontalScroll>
              </section>
            )}

            {results.albums.length > 0 && (
              <section>
                <SectionHeader
                  title="Albums"
                  onSeeAll={() => setActiveTab("albums")}
                  count={results.albums.length}
                />
                <HorizontalScroll>
                  {results.albums.slice(0, 6).map((album) => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      onClick={() => handleNavigateToAlbum(album)}
                    />
                  ))}
                </HorizontalScroll>
              </section>
            )}

            {results.tracks.length > 0 && (
              <section>
                <SectionHeader
                  title="Tracks"
                  onSeeAll={() => setActiveTab("tracks")}
                  count={results.tracks.length}
                />
                <div className="bg-theme-surface-hover/30 rounded-xl overflow-hidden">
                  {results.tracks.slice(0, 6).map((track, index) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      index={index}
                      onPlay={() => handlePlayTrack(track)}
                      onContextMenu={(e) => handleContextMenu(e, track)}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {hasQuery && hasResults && activeTab === "artists" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.artists.map((artist) => (
              <ArtistCard
                key={artist.id}
                artist={artist}
                onClick={() => handleNavigateToArtist(artist)}
              />
            ))}
          </div>
        )}

        {hasQuery && hasResults && activeTab === "albums" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {results.albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                onClick={() => handleNavigateToAlbum(album)}
              />
            ))}
          </div>
        )}

        {hasQuery && hasResults && activeTab === "tracks" && (
          <div className="bg-theme-surface-hover/30 rounded-xl overflow-hidden">
            {results.tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                onPlay={() => handlePlayTrack(track)}
                onContextMenu={(e) => handleContextMenu(e, track)}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={showCreatePlaylist}
        onClose={() => setShowCreatePlaylist(false)}
      />
    </div>
  );
};
