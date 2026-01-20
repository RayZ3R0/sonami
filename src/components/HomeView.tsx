import { useCallback } from "react";
import { usePlayer } from "../context/PlayerContext";
import { useContextMenu } from "../context/ContextMenuContext";
import { UnifiedTrack } from "../api/library";
import { useRecentTracks, useMostPlayed } from "../hooks/queries";
import { Track } from "../types";
import { TrackCarousel } from "./shared/TrackCarousel";
import { AppLogo } from "./icons/AppLogo";

export const HomeView = () => {
  const {
    playTrack,
    currentTrack,
    addToPlaylist,
    toggleFavorite,
    isPlaying,
    playlists,
  } = usePlayer();
  const { showMenu } = useContextMenu();

  // Use React Query hooks
  const { data: recentTracks = [], isLoading: loadingRecent } =
    useRecentTracks(20);
  const { data: mostPlayedTracks = [], isLoading: loadingMost } =
    useMostPlayed(20);

  const loading = loadingRecent || loadingMost;

  const handlePlayTrack = useCallback(
    (track: UnifiedTrack, context: UnifiedTrack[]) => {
      // Create a queue from the carousel context
      playTrack(track as unknown as Track, context as unknown as Track[]);
    },
    [playTrack],
  );

  const handleContextMenu = (e: React.MouseEvent, track: UnifiedTrack) => {
    e.preventDefault();
    e.stopPropagation();

    const trackAsTrack = track as unknown as Track;

    showMenu(
      [
        {
          label: "Play",
          action: () => handlePlayTrack(track, [track]), // Or provide full context?
        },
        {
          label: "Add to Liked Songs",
          action: () =>
            toggleFavorite({
              ...trackAsTrack,
              id: track.id || track.tidal_id?.toString() || "",
            }),
        },
        {
          label: "Add to Playlist",
          submenu: playlists.map((pl) => ({
            label: pl.title,
            action: () => addToPlaylist(pl.id, trackAsTrack),
          })),
        },
      ],
      { x: e.clientX, y: e.clientY },
    );
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return "Good night";
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const currentTrackId = currentTrack?.id;
  const showPlayerState = isPlaying && !!currentTrack;

  if (loading && recentTracks.length === 0) {
    return (
      <div className="flex flex-col h-full w-full p-8 space-y-12 animate-pulse">
        <div className="h-10 w-64 bg-theme-secondary rounded-lg mb-8" />
        <div className="space-y-4">
          <div className="h-8 w-48 bg-theme-secondary rounded" />
          <div className="h-48 w-full bg-theme-secondary/50 rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="h-8 w-48 bg-theme-secondary rounded" />
          <div className="h-48 w-full bg-theme-secondary/50 rounded-xl" />
        </div>
      </div>
    );
  }

  const isEmpty = recentTracks.length === 0 && mostPlayedTracks.length === 0;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Header */}
        <div className="px-6 md:px-8 pt-9 pb-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-theme-primary">
            {getGreeting()}
          </h1>
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="mb-6">
              <AppLogo size={80} className="text-theme-muted/50" />
            </div>
            <p className="text-xl text-theme-secondary font-medium">
              Start listening to build your history
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <TrackCarousel
              title="Recently Played"
              tracks={recentTracks}
              onPlay={(track) => handlePlayTrack(track, recentTracks)}
              onContextMenu={handleContextMenu}
              currentTrackId={currentTrackId}
              isPlaying={showPlayerState}
            />

            <TrackCarousel
              title="Most Played"
              tracks={mostPlayedTracks}
              onPlay={(track) => handlePlayTrack(track, mostPlayedTracks)}
              onContextMenu={handleContextMenu}
              currentTrackId={currentTrackId}
              isPlaying={showPlayerState}
            />
          </div>
        )}
      </div>
    </div>
  );
};
