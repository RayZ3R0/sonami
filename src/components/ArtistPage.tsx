import { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppLogo } from "./icons/AppLogo";
import { usePlayer } from "../context/PlayerContext";
import { useDownload } from "../context/DownloadContext";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { Track } from "../types";
import { getPlaylistsContainingTrack } from "../api/playlist";

interface ArtistPageProps {
    artistId: string;
    onNavigate: (tab: string) => void;
}

interface TidalArtist {
    id: number;
    name: string;
    picture?: string;
    banner?: string;
}

interface ArtistData {
    id: string;
    name: string;
    cover?: string;
    banner?: string;
    providerId: string;
}

interface TidalTrack {
    id: number;
    title: string;
    duration: number | null;
    album?: { id: number; title: string; cover?: string };
    trackNumber?: number;
    artists?: { id: number; name: string }[];
    audioQuality?: string;
}

interface TidalAlbum {
    id: number;
    title: string;
    cover?: string;
    releaseDate?: string;
    numberOfTracks?: number;
}

function getTidalCoverUrl(coverId?: string, size: number = 640): string | undefined {
    if (!coverId) return undefined;
    return `https://resources.tidal.com/images/${coverId.replace(/-/g, "/")}/${size}x${size}.jpg`;
}

export const ArtistPage = ({ artistId, onNavigate }: ArtistPageProps) => {
    const { playTrack, toggleFavorite, favorites, playlists, addToPlaylist } = usePlayer();
    const { downloadTrack } = useDownload();
    const [artist, setArtist] = useState<ArtistData | null>(null);
    const [topTracks, setTopTracks] = useState<TidalTrack[]>([]);
    const [albums, setAlbums] = useState<TidalAlbum[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [showAllTracks, setShowAllTracks] = useState(false);
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

    const parseArtistId = (id: string): { providerId: string; externalId: string } => {
        const colonIndex = id.indexOf(":");
        if (colonIndex === -1) {
            return { providerId: "local", externalId: id };
        }
        return {
            providerId: id.substring(0, colonIndex),
            externalId: id.substring(colonIndex + 1),
        };
    };

    const { providerId, externalId } = parseArtistId(artistId);

    useEffect(() => {
        const fetchArtist = async () => {
            setIsLoading(true);
            setError(null);
            setTopTracks([]);
            setAlbums([]);

            try {
                if (providerId === "tidal") {
                    const numericId = parseInt(externalId, 10);

                    // Fetch basic info, top tracks, and albums
                    const [artistData, tracksData, albumsData] = await Promise.all([
                        invoke<TidalArtist>("tidal_get_artist", { artistId: numericId }),
                        invoke<TidalTrack[]>("tidal_get_artist_top_tracks", { artistId: numericId }),
                        invoke<TidalAlbum[]>("tidal_get_artist_albums", { artistId: numericId })
                    ]);

                    setArtist({
                        id: artistId,
                        name: artistData.name,
                        cover: getTidalCoverUrl(artistData.picture, 640),
                        banner: getTidalCoverUrl(artistData.banner, 1280),
                        providerId: "tidal",
                    });

                    setTopTracks(tracksData);
                    setAlbums(albumsData);
                } else if (providerId === "subsonic" || providerId === "jellyfin") {
                    setError(`${providerId} artist pages coming soon`);
                } else {
                    setError("Local artist pages coming soon");
                }
            } catch (e) {
                console.error("Failed to fetch artist:", e);
                setError(e instanceof Error ? e.message : "Failed to load artist");
            } finally {
                setIsLoading(false);
            }
        };

        fetchArtist();
    }, [artistId, providerId, externalId]);

    const mapTrack = useCallback((t: TidalTrack): Track => ({
        id: `tidal:${t.id}`,
        path: `tidal:${t.id}`,
        title: t.title,
        artist: t.artists?.[0]?.name || artist?.name || "Unknown Artist",
        album: t.album?.title || "Unknown Album",
        cover_image: getTidalCoverUrl(t.album?.cover, 640),
        duration: t.duration || 0,

        source: "TIDAL",
        provider_id: "tidal",
        external_id: t.id.toString(),
    }), [artist]);

    const handlePlayTrack = async (index: number) => {
        if (!artist) return;

        // Map topTracks to player tracks
        const displayCount = showAllTracks ? 10 : 5;
        const tracks: Track[] = topTracks.slice(0, displayCount).map(mapTrack);

        const trackToPlay = tracks[index];

        console.log("[ArtistPage] Playing track:", trackToPlay);
        console.log("[ArtistPage] Track Path:", trackToPlay.path);
        console.log("[ArtistPage] Track Provider ID:", trackToPlay.provider_id);

        await playTrack(trackToPlay, tracks);
    };

    const formatDuration = (seconds?: number | null) => {
        if (!seconds) return "-:--";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const closeContextMenu = () => setContextMenu((prev) => ({ ...prev, isOpen: false }));

    const handleContextMenu = async (e: React.MouseEvent, tidalTrack: TidalTrack) => {
        e.preventDefault();
        e.stopPropagation();

        const track = mapTrack(tidalTrack);

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
                    const displayCount = showAllTracks ? 10 : 5;
                    const queue = topTracks.slice(0, displayCount).map(mapTrack);
                    playTrack(track, queue);
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
    }, [contextMenu, playlists, favorites, topTracks, showAllTracks, mapTrack, toggleFavorite, addToPlaylist, downloadTrack, playTrack]);

    const handleFollow = () => {
        setIsFollowing(!isFollowing);
    };

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
                <div className="w-20 h-20 bg-theme-surface-active rounded-full flex items-center justify-center mb-6">
                    <AppLogo size={40} className="text-theme-muted/50" />
                </div>
                <h2 className="text-xl font-bold text-theme-primary mb-2">Unavailable</h2>
                <p className="text-theme-muted">{error}</p>
            </div>
        );
    }

    if (!artist) return null;

    return (
        <div className="h-full overflow-y-auto scroll-smooth" style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }} >
            <div className="relative">
                {/* Hero Background */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: artist.banner ? `url(${artist.banner})` : artist.cover ? `url(${artist.cover})` : undefined }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-theme-background-secondary" />

                <div className="relative px-8 pt-32 pb-10">
                    <div className="flex items-end gap-8">
                        {/* Circular Artist Image */}
                        <div className="relative flex-shrink-0 group">
                            {artist.cover ? (
                                <img
                                    src={artist.cover}
                                    alt={artist.name}
                                    className="w-48 h-48 rounded-full object-cover shadow-2xl ring-4 ring-black/40"
                                />
                            ) : (
                                <div className="w-48 h-48 rounded-full bg-theme-surface-active flex items-center justify-center shadow-2xl ring-4 ring-black/40">
                                    <AppLogo size={64} className="text-theme-muted/50" />
                                </div>
                            )}
                            {/* Verification Badge (Mock) */}
                            <div className="absolute bottom-2 right-2 bg-blue-500 rounded-full w-8 h-8 flex items-center justify-center border-4 border-black text-white" title="Verified Artist">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                </svg>
                            </div>
                        </div>

                        <div className="flex-1 min-w-0 pb-2">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/40 text-white backdrop-blur-sm border border-white/10">Artist</span>
                            </div>
                            <h1 className="text-5xl md:text-6xl lg:text-7xl font-black text-white mb-6 drop-shadow-md">
                                {artist.name}
                            </h1>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => onNavigate(`search:${artist.name}`)}
                                    className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-theme-accent hover:bg-theme-accent-hover text-white font-bold transition-all hover:scale-105 shadow-xl"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                    <span>Mix</span>
                                </button>

                                <button
                                    onClick={handleFollow}
                                    className={`px-6 py-3 rounded-full font-semibold border transition-all hover:scale-105 ${isFollowing
                                        ? "bg-transparent border-white/30 text-white hover:border-white"
                                        : "bg-transparent border-white/30 text-white hover:border-white"
                                        }`}
                                >
                                    {isFollowing ? "Following" : "Follow"}
                                </button>

                                <button className="p-3.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors">
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-8 py-8 space-y-12 bg-gradient-to-b from-theme-background-secondary via-theme-background to-theme-background">
                {/* Popular Tracks Section */}
                {topTracks.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold text-theme-primary mb-6">Popular</h2>
                        <div className="space-y-1">
                            {topTracks.slice(0, showAllTracks ? 10 : 5).map((track, i) => (
                                <div
                                    key={track.id}
                                    className="group flex items-center p-3 rounded-lg hover:bg-theme-surface-hover/50 transition-colors cursor-pointer"
                                    onClick={() => handlePlayTrack(i)}
                                    onContextMenu={(e) => handleContextMenu(e, track)}
                                >
                                    <div className="w-8 text-center text-sm text-theme-muted group-hover:hidden">
                                        {i + 1}
                                    </div>
                                    <div className="w-8 text-center hidden group-hover:flex items-center justify-center text-theme-white">
                                        <svg className="w-4 h-4 text-theme-accent" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    </div>

                                    <div className="relative w-10 h-10 mr-4 flex-shrink-0">
                                        <img
                                            src={getTidalCoverUrl(track.album?.cover, 160)}
                                            className="w-full h-full rounded object-cover"
                                            alt={track.title}
                                        />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <div className="font-medium text-theme-primary truncate">{track.title}</div>
                                            {track.audioQuality === "LOSSLESS" && (
                                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-theme-accent/20 text-theme-accent font-bold">HiFi</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-theme-muted truncate">
                                            {track.album?.title}
                                        </div>
                                    </div>

                                    <div className="text-sm text-theme-muted">{formatDuration(track.duration)}</div>
                                </div>
                            ))}
                        </div>
                        {topTracks.length > 5 && (
                            <button
                                className="mt-4 text-xs font-semibold text-theme-muted hover:text-white uppercase tracking-wider transition-colors"
                                onClick={() => setShowAllTracks(!showAllTracks)}
                            >
                                {showAllTracks ? "Show Less" : `Show ${Math.min(topTracks.length - 5, 5)} More`}
                            </button>
                        )}
                    </section>
                )}

                {/* Discography Section */}
                {albums.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold text-theme-primary mb-6">Discography</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {albums.map((album) => (
                                <div
                                    key={album.id}
                                    className="group cursor-pointer bg-theme-surface p-4 rounded-xl hover:bg-theme-surface-hover transition-all duration-300"
                                    onClick={() => onNavigate(`album:tidal:${album.id}`)}
                                >
                                    <div className="relative aspect-square mb-4 overflow-hidden rounded-lg shadow-lg">
                                        {album.cover && (
                                            <img
                                                src={getTidalCoverUrl(album.cover, 640)}
                                                alt={album.title}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                loading="lazy"
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="w-12 h-12 bg-theme-accent rounded-full flex items-center justify-center shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform">
                                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-theme-primary truncate mb-1">{album.title}</h3>
                                        <div className="flex items-center text-xs text-theme-muted">
                                            <span>{album.releaseDate?.split('-')[0] || 'Unknown Year'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {
                contextMenu.isOpen && (
                    <ContextMenu
                        items={menuItems}
                        position={{ x: contextMenu.x, y: contextMenu.y }}
                        onClose={closeContextMenu}
                    />
                )
            }
        </div >
    );
};
