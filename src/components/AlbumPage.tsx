import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePlayer } from "../context/PlayerContext";
import { useDownload } from "../context/DownloadContext";
import { AppLogo } from "./icons/AppLogo";
import { Track } from "../types";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { getPlaylistsContainingTrack } from "../api/playlist";
import { DownloadIndicator } from "./DownloadIndicator";

interface AlbumPageProps {
    albumId: string;
    onNavigate: (tab: string) => void;
}

interface TidalAlbum {
    id: number;
    title: string;
    artist?: { id?: number; name: string; picture?: string };
    cover?: string;
    releaseDate?: string;
    numberOfTracks?: number;
    duration?: number;
}

interface TidalTrack {
    id: number;
    title: string;
    artist?: { id?: number; name: string };
    album?: { id?: number; title: string; cover?: string };
    duration?: number;
    trackNumber?: number;
}

interface AlbumData {
    id: string;
    title: string;
    artist: string;
    artistId?: string;
    cover?: string;
    year?: string;
    trackCount?: number;
    duration?: number;
    providerId: string;
    tracks: TrackData[];
}

interface TrackData {
    id: string;
    title: string;
    artist: string;
    duration: number;
    trackNumber?: number;
    raw: any;
    path: string; // Unified path for player
}

function getTidalCoverUrl(coverId?: string, size: number = 640): string | undefined {
    if (!coverId) return undefined;
    return `https://resources.tidal.com/images/${coverId.replace(/-/g, "/")}/${size}x${size}.jpg`;
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

const mapToTrack = (track: TrackData, albumCover?: string): Track => {
    // Use the raw track's id directly (it's a number for Tidal tracks)
    const rawTrack = track.raw as any;
    const tidalId = rawTrack?.id as number | undefined;
    // Construct a Track object compatible with PlayerContext
    return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: rawTrack?.album?.title || "Unknown Album",
        duration: track.duration,
        cover_image: albumCover,
        path: track.path,
        source: "TIDAL",

        provider_id: "tidal",
        external_id: tidalId?.toString(),
    };
};

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
    track: TrackData;
    index: number;
    onPlay: () => void;
    isPlaying?: boolean;
    isCurrentTrack?: boolean;
    onContextMenu: (e: React.MouseEvent) => void;
    isLiked: boolean;
    onToggleLike: (e: React.MouseEvent) => void;
    downloadStatus?: { progress: number; status: "pending" | "downloading" | "complete" | "error" };
    isDownloaded: boolean;
    onDownloadClick: (e: React.MouseEvent) => void;
}) => (
    <div
        onContextMenu={onContextMenu}
        className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-lg group transition-colors cursor-pointer ${isCurrentTrack
            ? "bg-theme-surface-active text-theme-accent"
            : "hover:bg-theme-surface-hover text-theme-secondary hover:text-theme-primary"
            }`}
        onClick={onPlay}
    >
        <div className="w-8 text-center text-xs font-medium tabular-nums flex items-center justify-center">
            {isCurrentTrack && isPlaying ? (
                <div className="flex gap-0.5 items-end h-4">
                    <div className="w-0.5 bg-theme-accent animate-equalizer rounded-t-sm" style={{ height: "60%", animationDelay: "0s" }} />
                    <div className="w-0.5 bg-theme-accent animate-equalizer rounded-t-sm" style={{ height: "100%", animationDelay: "0.2s" }} />
                    <div className="w-0.5 bg-theme-accent animate-equalizer rounded-t-sm" style={{ height: "40%", animationDelay: "0.4s" }} />
                </div>
            ) : (
                <>
                    <span className={`group-hover:hidden ${isCurrentTrack ? "text-theme-accent" : "opacity-60"}`}>
                        {track.trackNumber || index + 1}
                    </span>
                    <svg className="w-4 h-4 hidden group-hover:block text-theme-primary" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </>
            )}
        </div>
        <div className="flex-1 min-w-0 text-left">
            <p className={`font-medium truncate ${isCurrentTrack ? "text-theme-accent" : "text-theme-primary"}`}>
                {track.title}
            </p>
            <p className="text-sm text-theme-muted truncate group-hover:text-theme-primary transition-colors">{track.artist}</p>
        </div>

        {/* Actions (Like, Download, Duration) - Always match PlaylistView Layout */}
        <div className="flex items-center gap-4">
            <button
                onClick={onToggleLike}
                className={`opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-white/10 ${isLiked ? "text-theme-accent opacity-100" : "text-theme-muted hover:text-white"
                    }`}
            >
                <svg className="w-4 h-4" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
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
    const [album, setAlbum] = useState<AlbumData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const {
        playTrack,
        currentTrack,
        isPlaying,
        shuffle,
        toggleShuffle,
        favorites,
        toggleFavorite,
        playlists,
        addToPlaylist
    } = usePlayer();

    const { downloadTrack, deleteDownloadedTrack, downloads, isTrackCompleted } = useDownload();

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

    const parseAlbumId = (id: string): { providerId: string; externalId: string } => {
        const colonIndex = id.indexOf(":");
        if (colonIndex === -1) {
            return { providerId: "local", externalId: id };
        }
        return {
            providerId: id.substring(0, colonIndex),
            externalId: id.substring(colonIndex + 1),
        };
    };

    const { providerId, externalId } = parseAlbumId(albumId);

    useEffect(() => {
        const fetchAlbum = async () => {
            setIsLoading(true);
            setError(null);

            try {
                if (providerId === "tidal") {
                    const numericId = parseInt(externalId, 10);
                    const [albumData, tracksData] = await Promise.all([
                        invoke<TidalAlbum>("tidal_get_album", { albumId: numericId }),
                        invoke<TidalTrack[]>("tidal_get_album_tracks", { albumId: numericId }),
                    ]);

                    const tracks: TrackData[] = tracksData.map((t, i) => ({
                        id: `tidal:${t.id}`,
                        title: t.title,
                        artist: t.artist?.name || albumData.artist?.name || "Unknown Artist",
                        duration: t.duration || 0,
                        trackNumber: t.trackNumber || i + 1,
                        raw: t,
                        path: `tidal:${t.id}`
                    }));

                    const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);

                    setAlbum({
                        id: albumId,
                        title: albumData.title,
                        artist: albumData.artist?.name || "Unknown Artist",
                        artistId: albumData.artist?.id ? `tidal:${albumData.artist.id}` : undefined,
                        cover: getTidalCoverUrl(albumData.cover, 640),
                        year: albumData.releaseDate?.split("-")[0],
                        trackCount: albumData.numberOfTracks || tracks.length,
                        duration: totalDuration,
                        providerId: "tidal",
                        tracks,
                    });
                } else if (providerId === "subsonic" || providerId === "jellyfin") {
                    setError(`${providerId} album pages coming soon`);
                } else {
                    setError("Local album pages coming soon");
                }
            } catch (e) {
                console.error("Failed to fetch album:", e);
                setError(e instanceof Error ? e.message : "Failed to load album");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAlbum();
    }, [albumId, providerId, externalId]);

    const handlePlayAll = useCallback(async () => {
        if (!album || album.tracks.length === 0) return;
        const queue = album.tracks.map(t => mapToTrack(t, album.cover));
        await playTrack(queue[0], queue);
    }, [album, playTrack]);

    const handleShufflePlay = useCallback(async () => {
        if (!album || album.tracks.length === 0) return;
        if (!shuffle) await toggleShuffle();

        const queue = album.tracks.map(t => mapToTrack(t, album.cover));
        const randomIndex = Math.floor(Math.random() * queue.length);
        await playTrack(queue[randomIndex], queue);
    }, [album, shuffle, toggleShuffle, playTrack]);

    const handlePlayTrack = useCallback(async (track: TrackData) => {
        if (!album) return;
        const queue = album.tracks.map(t => mapToTrack(t, album.cover));
        const trackToPlay = mapToTrack(track, album.cover);

        console.log("[AlbumPage] Playing track:", trackToPlay);
        console.log("[AlbumPage] Track Path:", trackToPlay.path);
        console.log("[AlbumPage] Track Provider ID:", trackToPlay.provider_id);

        await playTrack(trackToPlay, queue);
    }, [album, playTrack]);

    const handleNavigateToArtist = () => {
        if (album?.artistId) {
            onNavigate(`artist:${album.artistId}`);
        }
    };

    const handleDownloadAll = async () => {
        if (!album) return;
        for (const track of album.tracks) {
            const trackObj = mapToTrack(track, album.cover);
            // Safety check: Ensure streaming tracks are correctly identified
            if (trackObj.path?.startsWith("tidal:") || trackObj.path?.startsWith("subsonic:") || trackObj.path?.startsWith("jellyfin:")) {
                await downloadTrack(trackObj);
            }
        }
    };

    // Context Menu Handlers
    const closeContextMenu = () => setContextMenu((prev) => ({ ...prev, isOpen: false }));

    const handleContextMenu = async (e: React.MouseEvent, trackData: TrackData) => {
        e.preventDefault();
        e.stopPropagation();

        const track = mapToTrack(trackData, album?.cover);

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
            (p) => !contextMenu.containingPlaylists.has(p.id)
        );

        return [
            {
                label: "Play",
                action: () => {
                    if (album) {
                        const queue = album.tracks.map(t => mapToTrack(t, album.cover));
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
                submenu: availablePlaylists.length > 0
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
    }, [contextMenu, playlists, favorites, album, toggleFavorite, addToPlaylist, downloadTrack, playTrack]);

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
                <svg className="w-16 h-16 text-theme-muted/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-xl font-bold text-theme-primary mb-2">Unable to load album</h2>
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
                    style={{ backgroundImage: album.cover ? `url(${album.cover})` : undefined }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-theme-background-secondary" />

                <div className="relative px-8 pt-16 pb-8">
                    <div className="flex items-end gap-8">
                        <div className="relative flex-shrink-0 group">
                            {album.cover ? (
                                <img
                                    src={album.cover}
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
                            <p className="text-sm font-bold text-white/80 uppercase tracking-wider mb-2">Album</p>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4 line-clamp-2">
                                {album.title}
                            </h1>
                            <div className="flex items-center gap-2 text-white/80">
                                {album.artistId ? (
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
                                {album.trackCount && (
                                    <>
                                        <span className="text-white/40">•</span>
                                        <span>{album.trackCount} tracks</span>
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
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all hover:scale-105 ${shuffle
                            ? "bg-theme-accent/20 text-theme-accent border border-theme-accent/30"
                            : "bg-theme-surface hover:bg-theme-surface-hover text-theme-primary"
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                        </svg>
                        <span className="pt-[2px]">Shuffle</span>
                    </button>
                    <button
                        onClick={handleDownloadAll}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-theme-surface hover:bg-theme-surface-hover text-theme-primary font-medium transition-all hover:scale-105"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span className="pt-[2px]">Download All</span>
                    </button>
                    {/* Album Like Button (Placeholder for now) */}
                    <button className="p-3 rounded-full hover:bg-white/10 text-theme-muted hover:text-theme-primary transition-colors ml-auto">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
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
                    {album.tracks.map((track, index) => {
                        // Use uniform format: provider:externalId
                        const trackKey = track.id.startsWith("tidal:") ? track.id : `tidal:${track.id.replace("tidal:", "")}`;
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
                                    toggleFavorite(mapToTrack(track, album.cover));
                                }}
                                downloadStatus={dlStatus}
                                isDownloaded={isDl}
                                onDownloadClick={(e) => {
                                    e.stopPropagation();
                                    if (isDl) {
                                        // Pass providerId and externalId
                                        const providerId = "tidal";
                                        const externalId = trackKey;
                                        deleteDownloadedTrack(providerId, externalId);
                                    } else if (!dlStatus) {
                                        downloadTrack(mapToTrack(track, album.cover));
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
