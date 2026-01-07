import { useEffect, useState, useCallback } from "react";
import { getLibraryTracks, getLibraryAlbums, getLibraryArtists, UnifiedTrack, LibraryAlbum, LibraryArtist } from "../api/library";
import { usePlayer } from "../context/PlayerContext";
import { useContextMenu } from "../context/ContextMenuContext";
import { Track } from "../types";

// ... (ImageWithFallback component remains unchanged)
const ImageWithFallback = ({ src, alt, className, iconType = 'music' }: {
    src?: string;
    alt: string;
    className?: string;
    iconType?: 'music' | 'album' | 'artist';
}) => {
    const [error, setError] = useState(false);

    const icons = {
        music: (
            <svg className="w-1/3 h-1/3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
        ),
        album: (
            <svg className="w-1/3 h-1/3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
                <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
            </svg>
        ),
        artist: (
            <svg className="w-1/3 h-1/3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" strokeWidth={1.5} />
            </svg>
        ),
    };

    if (!src || error) {
        return (
            <div className={`bg-gradient-to-br from-theme-secondary to-theme-tertiary flex items-center justify-center text-theme-muted ${className}`}>
                {icons[iconType]}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            onError={() => setError(true)}
            className={`object-cover bg-theme-secondary ${className}`}
            loading="lazy"
        />
    );
};

// Track Card Component
const TrackCard = ({ track, isPlaying, onPlay, onContextMenu }: {
    track: UnifiedTrack;
    isPlaying: boolean;
    onPlay: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}) => {
    return (
        <div
            onClick={onPlay}
            onContextMenu={onContextMenu}
            className="group cursor-pointer p-3 rounded-xl hover:bg-theme-highlight/40 transition-all duration-200"
        >
            {/* Same structure as before */}
            <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-lg mb-3 bg-theme-secondary">
                <ImageWithFallback
                    src={track.cover_image}
                    alt={track.title}
                    className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                    iconType="music"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-theme-accent flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200 shadow-xl">
                        <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>
                {isPlaying && (
                    <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-theme-accent flex items-center justify-center">
                        <div className="flex items-end gap-[2px] h-3">
                            <span className="w-[2px] bg-white rounded-full animate-eq-1" style={{ height: '50%' }} />
                            <span className="w-[2px] bg-white rounded-full animate-eq-2" style={{ height: '100%' }} />
                            <span className="w-[2px] bg-white rounded-full animate-eq-3" style={{ height: '30%' }} />
                        </div>
                    </div>
                )}
            </div>
            <h3 className={`font-semibold truncate ${isPlaying ? 'text-theme-accent' : 'text-theme-primary'} group-hover:text-theme-accent transition-colors`}>
                {track.title}
            </h3>
            <p className="text-sm text-theme-muted truncate mt-0.5">{track.artist}</p>
        </div>
    );
};

// ... (AlbumCard/ArtistCard/Section/CardSkeleton same as before)
// Album Card Component
const AlbumCard = ({ album }: { album: LibraryAlbum }) => {
    return (
        <div className="group cursor-pointer p-3 rounded-xl hover:bg-theme-highlight/40 transition-all duration-200">
            <div className="relative aspect-square w-full rounded-lg overflow-hidden shadow-lg mb-3 bg-theme-secondary">
                <ImageWithFallback
                    src={album.cover_image}
                    alt={album.title}
                    className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                    iconType="album"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                    <button className="w-12 h-12 rounded-full bg-theme-accent flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-200 shadow-xl hover:scale-105">
                        <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </button>
                </div>
            </div>
            <h3 className="font-semibold truncate text-theme-primary group-hover:text-theme-accent transition-colors">
                {album.title}
            </h3>
            <p className="text-sm text-theme-muted truncate mt-0.5">{album.artist}</p>
        </div>
    );
};

// Artist Card Component
const ArtistCard = ({ artist }: { artist: LibraryArtist }) => {
    return (
        <div className="group cursor-pointer p-3 rounded-xl hover:bg-theme-highlight/40 transition-all duration-200 text-center">
            <div className="relative aspect-square w-full rounded-full overflow-hidden shadow-lg mb-3 bg-theme-secondary mx-auto ring-2 ring-transparent group-hover:ring-theme-accent/50 transition-all duration-200">
                <ImageWithFallback
                    src={artist.cover_image}
                    alt={artist.name}
                    className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                    iconType="artist"
                />
            </div>
            <h3 className="font-semibold truncate text-theme-primary group-hover:text-theme-accent transition-colors px-2">
                {artist.name}
            </h3>
        </div>
    );
};

// Section Component
const Section = ({ title, children, isEmpty }: { title: string; children: React.ReactNode; isEmpty?: boolean }) => {
    if (isEmpty) return null;
    return (
        <section className="mb-8">
            <h2 className="text-xl font-bold text-theme-primary mb-4 px-2">{title}</h2>
            {children}
        </section>
    );
};

// Loading skeleton
const CardSkeleton = ({ count = 6, isArtist = false }: { count?: number; isArtist?: boolean }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="p-3 animate-pulse">
                <div className={`aspect-square w-full bg-theme-secondary mb-3 ${isArtist ? 'rounded-full' : 'rounded-lg'}`} />
                <div className="w-3/4 h-4 bg-theme-secondary rounded mb-2" />
                {!isArtist && <div className="w-1/2 h-3 bg-theme-secondary rounded" />}
            </div>
        ))}
    </div>
);


export const HomeView = () => {
    const { playTrack, currentTrack, addToPlaylist, playlists, toggleFavorite, favorites } = usePlayer();
    const { showMenu } = useContextMenu();
    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
    const [albums, setAlbums] = useState<LibraryAlbum[]>([]);
    const [artists, setArtists] = useState<LibraryArtist[]>([]);

    const loadData = useCallback(async () => {
        // ... (load logic remains unchanged)
        setLoading(true);
        try {
            const [tracksData, albumsData, artistsData] = await Promise.all([
                getLibraryTracks(),
                getLibraryAlbums(),
                getLibraryArtists(),
            ]);
            setTracks(tracksData);
            setAlbums(albumsData);
            setArtists(artistsData);
        } catch (e) {
            console.error("Failed to load library data:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handlePlayTrack = useCallback((track: UnifiedTrack) => {
        playTrack(track as unknown as Track, tracks as unknown as Track[]);
    }, [playTrack, tracks]);

    const handleContextMenu = (e: React.MouseEvent, track: UnifiedTrack) => {
        e.preventDefault();
        e.stopPropagation();

        const trackAsTrack = track as unknown as Track;
        // Simple heuristic - if it's in favorites array (needs simpler check in reality)
        // For now, toggleFavorite handles logic, we just label "Toggle Like" or specific
        // We'll stick to a generic "Add to Playlist" for now.

        showMenu([
            {
                label: 'Play',
                action: () => handlePlayTrack(track),
            },
            {
                label: 'Add to Liked Songs',
                action: () => toggleFavorite({ ...trackAsTrack, id: track.id || track.tidal_id?.toString() || '' }), // best effort id
            },
            {
                label: 'Add to Playlist',
                submenu: playlists.map(pl => ({
                    label: pl.title,
                    action: () => addToPlaylist(pl.id, trackAsTrack),
                })),
            },
        ], { x: e.clientX, y: e.clientY });
    };

    // ... (rest of render logic)
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    const isEmpty = tracks.length === 0 && albums.length === 0 && artists.length === 0;

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            {/* ... (render logic) */}
            <div className="flex-1 overflow-y-auto px-6 pb-32">
                {/* Header */}
                <div className="pt-8 pb-6">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-theme-primary mb-2">
                        {getGreeting()}
                    </h1>
                    {!loading && !isEmpty && (
                        <p className="text-theme-secondary text-lg">
                            {tracks.length} tracks • {albums.length} albums • {artists.length} artists
                        </p>
                    )}
                </div>

                {loading ? (
                    <div className="space-y-8">
                        <Section title="Recent Tracks">
                            <CardSkeleton count={6} />
                        </Section>
                        <Section title="Albums">
                            <CardSkeleton count={6} />
                        </Section>
                    </div>
                ) : isEmpty ? (
                    /* ... (Empty state logic same as before) ... */
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-32 h-32 rounded-full bg-theme-secondary/50 flex items-center justify-center mb-8">
                            <svg className="w-16 h-16 text-theme-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-theme-primary mb-3">Your library is empty</h2>
                        <p className="text-theme-muted max-w-md mb-6">
                            Import music from your computer or search Tidal to start building your collection.
                        </p>
                        <div className="flex gap-3 text-sm text-theme-muted">
                            <span className="flex items-center gap-2">
                                Press
                                <kbd className="px-2 py-1 rounded bg-theme-secondary border border-theme-border font-mono text-xs">⌘K</kbd>
                                to search
                            </span>
                        </div>
                    </div>
                ) : (
                    /* Content */
                    <>
                        {/* Recent Tracks */}
                        <Section title="Recent Tracks" isEmpty={tracks.length === 0}>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                                {tracks.slice(0, 12).map((track) => (
                                    <TrackCard
                                        key={track.id}
                                        track={track}
                                        isPlaying={currentTrack?.id === track.id}
                                        onPlay={() => handlePlayTrack(track)}
                                        onContextMenu={(e) => handleContextMenu(e, track)}
                                    />
                                ))}
                            </div>
                        </Section>

                        {/* Albums */}
                        <Section title="Albums" isEmpty={albums.length === 0}>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                                {albums.slice(0, 6).map((album) => (
                                    <AlbumCard key={album.id} album={album} />
                                ))}
                            </div>
                        </Section>

                        {/* Artists */}
                        <Section title="Artists" isEmpty={artists.length === 0}>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                                {artists.slice(0, 6).map((artist) => (
                                    <ArtistCard key={artist.id} artist={artist} />
                                ))}
                            </div>
                        </Section>
                    </>
                )}
            </div>
        </div>
    );
};
