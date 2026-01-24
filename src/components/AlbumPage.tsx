import { useState, useMemo, useCallback } from "react";
import { usePlayer } from "../context/PlayerContext";
import { useDownload } from "../context/DownloadContext";
import { AppLogo } from "./icons/AppLogo";
import { Track } from "../types";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { getPlaylistsContainingTrack } from "../api/playlist";
import { DownloadIndicator } from "./DownloadIndicator";
import { useAlbum } from "../hooks/useData";

interface AlbumPageProps {
  albumId: string;
  onNavigate: (tab: string) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTotalDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} hr ${mins} min`;
  }
  return `${mins} min`;
}

const TrackRow = ({
  track,
  index,
  onPlay,
  isPlaying,
  isCurrentTrack,
  onContextMenu,
  isLiked,
  onToggleLike,
  downloadStatus,
  isDownloaded,
  onDownloadClick,
}: {
  track: Track;
  index: number;
  onPlay: () => void;
  isPlaying?: boolean;
  isCurrentTrack?: boolean;
  onContextMenu: (e: React.MouseEvent) => void;
  isLiked: boolean;
  onToggleLike: (e: React.MouseEvent) => void;
  downloadStatus?: {
    progress: number;
    status: "pending" | "downloading" | "complete" | "error";
  };
  isDownloaded: boolean;
  onDownloadClick: (e: React.MouseEvent) => void;
}) => (
  <div
    onContextMenu={onContextMenu}
    className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-lg group transition-colors cursor-pointer ${
      isCurrentTrack
        ? "bg-theme-surface-active text-theme-accent"
        : "hover:bg-theme-surface-hover text-theme-secondary hover:text-theme-primary"
    }`}
    onClick={onPlay}
  >
    <div className="w-8 text-center text-xs font-medium tabular-nums flex items-center justify-center">
      {isCurrentTrack && isPlaying ? (
        <div className="flex gap-0.5 items-end h-4">
          <div
            className="w-0.5 bg-theme-accent animate-equalizer rounded-t-sm"
            style={{ height: "60%", animationDelay: "0s" }}
          />
          <div
            className="w-0.5 bg-theme-accent animate-equalizer rounded-t-sm"
            style={{ height: "100%", animationDelay: "0.2s" }}
          />
          <div
            className="w-0.5 bg-theme-accent animate-equalizer rounded-t-sm"
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
    <div className="flex-1 min-w-0 text-left">
      <p
        className={`font-medium truncate ${isCurrentTrack ? "text-theme-accent" : "text-theme-primary"}`}
      >
        {track.title}
      </p>
      <p className="text-sm text-theme-muted truncate group-hover:text-theme-primary transition-colors">
        {track.artist}
      </p>
    </div>

    {/* Actions (Like, Download, Duration) - Always match PlaylistView Layout */}
    <div className="flex items-center gap-4">
      <button
        onClick={onToggleLike}
        className={`opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-white/10 ${
          isLiked
            ? "text-theme-accent opacity-100"
            : "text-theme-muted hover:text-white"
        }`}
      >
        <svg
          className="w-4 h-4"
          fill={isLiked ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      </button>

      <DownloadIndicator
        status={downloadStatus}
        isDownloaded={isDownloaded}
        onClick={onDownloadClick}
      />

      <div className="text-sm text-theme-muted font-mono tabular-nums w-10 text-right">
        {formatDuration(track.duration)}
      </div>
    </div>
  </div>
);

export const AlbumPage = ({ albumId, onNavigate }: AlbumPageProps) => {
  const { album, tracks, isLoading, error } = useAlbum(albumId);

  const {
    playTrack,
    currentTrack,
    isPlaying,
    shuffle,
    toggleShuffle,
    favorites,
    toggleFavorite,
    playlists,
    addToPlaylist,
  } = usePlayer();

  const { downloadTrack, deleteDownloadedTrack, downloads, isTrackCompleted } =
    useDownload();

  // Context Menu State
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

  const handlePlayAll = useCallback(async () => {
    if (!album || tracks.length === 0) return;
    // Ensure tracks have cover image from album if missing
    const queue = tracks.map((t) => ({
      ...t,
      cover_image: t.cover_image || album.cover_url,
    }));
    await playTrack(queue[0], queue);
  }, [album, tracks, playTrack]);

  const handleShufflePlay = useCallback(async () => {
    if (!album || tracks.length === 0) return;
    if (!shuffle) await toggleShuffle();

    const queue = tracks.map((t) => ({
      ...t,
      cover_image: t.cover_image || album.cover_url,
    }));
    const randomIndex = Math.floor(Math.random() * queue.length);
    await playTrack(queue[randomIndex], queue);
  }, [album, tracks, shuffle, toggleShuffle, playTrack]);

  const handlePlayTrack = useCallback(
    async (track: Track) => {
      if (!album) return;
      const queue = tracks.map((t) => ({
        ...t,
        cover_image: t.cover_image || album.cover_url,
      }));
      const trackToPlay = {
        ...track,
        cover_image: track.cover_image || album.cover_url,
      };

      console.log("[AlbumPage] Playing track:", trackToPlay);
      console.log("[AlbumPage] Track Path:", trackToPlay.path);
      console.log("[AlbumPage] Track Provider ID:", trackToPlay.provider_id);

      await playTrack(trackToPlay, queue);
    },
    [album, tracks, playTrack],
  );

  const handleNavigateToArtist = () => {
    if (album?.artist_id) {
      onNavigate(`artist:${album.artist_id}`);
    }
  };

  const handleDownloadAll = async () => {
    if (!album || !tracks.length) return;
    for (const track of tracks) {
      const trackObj = {
        ...track,
        cover_image: track.cover_image || album.cover_url,
      };
      // Safety check: Ensure streaming tracks are correctly identified
      // This check might need update if we use localized IDs, but the hook normalizes source/id
      if (
        trackObj.path?.startsWith("tidal:") ||
        trackObj.path?.startsWith("subsonic:") ||
        trackObj.path?.startsWith("jellyfin:") ||
        trackObj.provider_id !== "local"
      ) {
        await downloadTrack(trackObj);
      }
    }
  };

  // Context Menu Handlers
  const closeContextMenu = () =>
    setContextMenu((prev) => ({ ...prev, isOpen: false }));

  const handleContextMenu = async (e: React.MouseEvent, trackData: Track) => {
    e.preventDefault();
    e.stopPropagation();

    const track = {
      ...trackData,
      cover_image: trackData.cover_image || album?.cover_url,
    };

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
    const isLiked = favorites.has(track.id);

    const availablePlaylists = playlists.filter(
      (p) => !contextMenu.containingPlaylists.has(p.id),
    );

    return [
      {
        label: "Play",
        action: () => {
          if (album) {
            const queue = tracks.map((t) => ({
              ...t,
              cover_image: t.cover_image || album.cover_url,
            }));
            playTrack(track, queue);
          }
        },
      },
      {
        label: isLiked ? "Remove from Liked Songs" : "Add to Liked Songs",
        action: () => toggleFavorite(track),
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
      {
        label: "Download",
        action: () => downloadTrack(track),
      },
    ];
  }, [
    contextMenu,
    playlists,
    favorites,
    album,
    tracks,
    toggleFavorite,
    addToPlaylist,
    downloadTrack,
    playTrack,
  ]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse">
          <AppLogo size={48} className="text-theme-accent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <svg
          className="w-16 h-16 text-theme-muted/30 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h2 className="text-xl font-bold text-theme-primary mb-2">
          Unable to load album
        </h2>
        <p className="text-theme-muted">{error}</p>
      </div>
    );
  }

  if (!album) return null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="relative">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: album.cover_url
              ? `url(${album.cover_url})`
              : undefined,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-theme-background-secondary" />

        <div className="relative px-8 pt-16 pb-8">
          <div className="flex items-end gap-8">
            <div className="relative flex-shrink-0 group">
              {album.cover_url ? (
                <img
                  src={album.cover_url}
                  alt={album.title}
                  className="w-56 h-56 rounded-lg object-cover shadow-2xl"
                />
              ) : (
                <div className="w-56 h-56 rounded-lg bg-theme-surface-active flex items-center justify-center shadow-2xl">
                  <AppLogo size={64} className="text-theme-muted/50" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pb-2">
              <p className="text-sm font-bold text-white/80 uppercase tracking-wider mb-2">
                Album
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 line-clamp-2">
                {album.title}
              </h1>
              <div className="flex items-center gap-2 text-white/80">
                {album.artist_id ? (
                  <button
                    onClick={handleNavigateToArtist}
                    className="font-semibold hover:underline"
                  >
                    {album.artist}
                  </button>
                ) : (
                  <span className="font-semibold">{album.artist}</span>
                )}
                {album.year && (
                  <>
                    <span className="text-white/40">•</span>
                    <span>{album.year}</span>
                  </>
                )}
                {album.track_count && (
                  <>
                    <span className="text-white/40">•</span>
                    <span>{album.track_count} tracks</span>
                  </>
                )}
                {album.duration && (
                  <>
                    <span className="text-white/40">•</span>
                    <span>{formatTotalDuration(album.duration)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Action Buttons */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-theme-accent hover:bg-theme-accent-hover text-white font-semibold transition-all hover:scale-105 shadow-lg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <span className="pt-[2px]">Play</span>
          </button>
          <button
            onClick={handleShufflePlay}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all hover:scale-105 ${
              shuffle
                ? "bg-theme-accent/20 text-theme-accent border border-theme-accent/30"
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-theme-surface hover:bg-theme-surface-hover text-theme-primary font-medium transition-all hover:scale-105"
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
            <span className="pt-[2px]">Download All</span>
          </button>
          {/* Album Like Button (Placeholder for now) */}
          <button className="p-3 rounded-full hover:bg-white/10 text-theme-muted hover:text-theme-primary transition-colors ml-auto">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        </div>

        {/* Track Headers */}
        <div className="bg-theme-surface-hover/30 rounded-t-xl border-b border-white/5 px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wider grid grid-cols-[32px_1fr_120px] gap-4">
          <div className="text-center">#</div>
          <div>Title</div>
          <div className="text-right">Duration</div>
        </div>

        <div className="bg-theme-surface-hover/10 rounded-b-xl overflow-hidden">
          {tracks.map((track, index) => {
            const trackKey = track.id;
            const dlStatus = downloads.get(trackKey);
            const isDl = isTrackCompleted(trackKey) || false;

            return (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                onPlay={() => handlePlayTrack(track)}
                isPlaying={isPlaying}
                isCurrentTrack={currentTrack?.id === track.id}
                onContextMenu={(e) => handleContextMenu(e, track)}
                isLiked={favorites.has(track.id)}
                onToggleLike={(e) => {
                  e.stopPropagation();
                  toggleFavorite({
                    ...track,
                    cover_image: track.cover_image || album.cover_url,
                  });
                }}
                downloadStatus={dlStatus}
                isDownloaded={isDl}
                onDownloadClick={(e) => {
                  e.stopPropagation();
                  if (isDl) {
                    const providerId = track.provider_id || "tidal"; // Fallback to tidal if missing, but it should be there
                    const externalId = track.external_id || trackKey;
                    deleteDownloadedTrack(providerId, externalId);
                  } else if (!dlStatus) {
                    downloadTrack({
                      ...track,
                      cover_image: track.cover_image || album.cover_url,
                    });
                  }
                }}
              />
            );
          })}
        </div>
      </div>

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
