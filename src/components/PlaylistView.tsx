import { usePlayer } from "../context/PlayerContext";
import { useState, useMemo, useEffect } from "react";
import { UnifiedTrack } from "../api/library";
import { Track, PlaylistDetails } from "../types";
import { getPlaylistDetails } from "../api/playlist";

interface PlaylistViewProps {
    playlistId: string;
}

// Map Playlist Track to Player Track
const mapToTrack = (track: Track): Track => {
    // Cast to UnifiedTrack to access potential extra fields (runtime safety check)
    const uTrack = track as unknown as UnifiedTrack;

    // Similar logic to LikedSongsView - ensure path is valid
    let trackPath = track.path;

    // If path is empty and we have a tidal_id (from UnifiedTrack data), construct the tidal: path
    if ((!trackPath || trackPath.trim() === '') && uTrack.tidal_id) {
        trackPath = `tidal:${uTrack.tidal_id}`;
    } else if ((!trackPath || trackPath.trim() === '') && uTrack.local_path) {
        trackPath = uTrack.local_path || '';
    }

    return {
        ...track,
        path: trackPath,
    };
};

// Dynamic Cover Art Component
const PlaylistCover = ({ tracks, coverUrl }: { tracks: Track[], coverUrl?: string | null }) => {
    // Priority: 
    // 1. coverUrl (if present, splits by pipe)
    // 2. tracks (generate from first 4)

    let covers: string[] = [];

    if (coverUrl) {
        covers = coverUrl.split('|');
    }

    // Fallback to tracks if no coverUrl or if coverUrl was empty
    if (covers.length === 0 && tracks.length > 0) {
        covers = tracks
            .filter(t => t.cover_image)
            .slice(0, 4)
            .map(t => t.cover_image!);
    }

    if (covers.length === 0) {
        return (
            <div className="w-52 h-52 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-2xl flex items-center justify-center text-white/20">
                <svg className="w-20 h-20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13" /></svg>
            </div>
        );
    }

    if (covers.length >= 4) {
        return (
            <div className="w-52 h-52 grid grid-cols-2 bg-theme-surface rounded-xl overflow-hidden shadow-2xl">
                {covers.slice(0, 4).map((src, i) => (
                    <img key={i} src={src} className="w-full h-full object-cover" />
                ))}
            </div>
        );
    }

    return (
        <img src={covers[0]} alt="Playlist Cover" className="w-52 h-52 object-cover rounded-xl shadow-2xl" />
    );
};



export const PlaylistView = ({ playlistId }: PlaylistViewProps) => {
    const { playTrack, currentTrack, removeFromPlaylist, deletePlaylist, renamePlaylist, shuffle, toggleShuffle, isPlaying } = usePlayer();

    // Local state for full playlist details
    const [details, setDetails] = useState<PlaylistDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");

    const [sortBy, setSortBy] = useState<'title' | 'artist' | 'album' | 'duration'>('title');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Fetch details when ID changes
    useEffect(() => {
        const fetchDetails = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getPlaylistDetails(playlistId);
                setDetails(data);
                setEditName(data.playlist.title);
            } catch (e) {
                console.error("Failed to load playlist:", e);
                setError("Failed to load playlist.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [playlistId]);


    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const totalDuration = useMemo(() => {
        if (!details) return 0;
        return details.tracks.reduce((acc, t) => acc + t.duration, 0);
    }, [details]);

    // Sorted tracks
    const sortedTracks = useMemo(() => {
        if (!details) return [];
        return [...details.tracks].sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'title':
                    comparison = a.title.localeCompare(b.title);
                    break;
                case 'artist':
                    comparison = a.artist.localeCompare(b.artist);
                    break;
                case 'album':
                    comparison = a.album.localeCompare(b.album);
                    break;
                case 'duration':
                    comparison = a.duration - b.duration;
                    break;
            }
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [details, sortBy, sortDirection]);

    const handleSort = (column: 'title' | 'artist' | 'album' | 'duration') => {
        if (sortBy === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortDirection('asc');
        }
    };

    const SortIndicator = ({ column }: { column: 'title' | 'artist' | 'album' | 'duration' }) => {
        if (sortBy !== column) return null;
        return (
            <span className="ml-1 text-theme-accent inline-block">
                {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
        );
    };

    const formatTotalDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours} hr ${mins} min`;
        }
        return `${mins} min`;
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center text-theme-muted">
                Loading playlist...
            </div>
        );
    }

    if (error || !details) {
        return (
            <div className="flex-1 flex items-center justify-center text-theme-muted">
                {error || "Playlist not found."}
            </div>
        );
    }

    const { playlist, tracks } = details;

    const handleRename = async () => {
        if (editName.trim() && editName !== playlist.title) {
            try {
                await renamePlaylist(playlist.id, editName.trim());
                // Update local state to reflect change immediately if needed, or re-fetch
                setDetails(prev => prev ? { ...prev, playlist: { ...prev.playlist, title: editName.trim() } } : null);
            } catch (e) {
                console.error("Rename failed", e);
            }
        }
        setIsEditing(false);
    };

    const startEdit = () => {
        setEditName(playlist.title);
        setIsEditing(true);
    };

    const handleDelete = () => {
        if (confirm(`Are you sure you want to delete "${playlist.title}"?`)) {
            deletePlaylist(playlist.id);
        }
    };

    const handlePlayAll = async () => {
        if (tracks.length === 0) return;
        // Map UnifiedTrack to Track (fix path issue)
        const queue = tracks.map(mapToTrack);
        await playTrack(queue[0], queue);
    };

    const handleShufflePlay = async () => {
        if (tracks.length === 0) return;
        if (!shuffle) await toggleShuffle();

        const queue = tracks.map(mapToTrack);
        const randomIndex = Math.floor(Math.random() * queue.length);
        await playTrack(queue[randomIndex], queue);
    };

    // Play specific track
    const handlePlayTrack = async (track: Track) => {
        // Use sorted list for queue context to match display
        const queue = sortedTracks.map(mapToTrack);
        const trackToPlay = mapToTrack(track);
        await playTrack(trackToPlay, queue);
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-8 py-6 bg-gradient-to-b from-indigo-900/30 to-transparent">
                <div className="flex items-end gap-6">
                    {/* Dynamic Cover */}

                    <PlaylistCover tracks={tracks} coverUrl={details.playlist.cover_url} />

                    {/* Info */}
                    <div className="flex-1 pb-2 min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2 block">Playlist</span>

                        {isEditing ? (
                            <input
                                className="block w-full text-5xl font-black text-white bg-transparent border-b border-white/20 focus:border-white/50 focus:outline-none mb-4"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                autoFocus
                            />
                        ) : (
                            <h1
                                className="text-5xl font-black text-white mb-4 truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-white/20"
                                onClick={startEdit}
                                title="Click to rename"
                            >
                                {playlist.title}
                            </h1>
                        )}

                        <div className="flex items-center gap-2 text-sm text-theme-muted">
                            <span className="font-semibold text-white">{tracks.length} tracks</span>
                            <span>•</span>
                            <span>{formatTotalDuration(totalDuration)}</span>
                            <span>•</span>
                            <button onClick={handleDelete} className="hover:text-theme-error transition-colors">
                                Delete Playlist
                            </button>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-4 mt-6">
                    <button
                        onClick={handlePlayAll}
                        disabled={tracks.length === 0}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white font-semibold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                        Play
                    </button>
                    <button
                        onClick={handleShufflePlay}
                        disabled={tracks.length === 0}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${shuffle
                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                            : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                        </svg>
                        Shuffle
                    </button>
                </div>
            </div>

            <div className="flex flex-col flex-1 overflow-auto px-8">
                {/* Header Row */}
                <div className="sticky top-0 bg-theme-background-secondary z-10 grid grid-cols-[16px_1fr_1fr_1fr_48px_32px] gap-4 px-4 py-3 border-b border-white/5 text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2">
                    <span>#</span>
                    <span className="cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('title')}>
                        Title <SortIndicator column="title" />
                    </span>
                    <span className="cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('album')}>
                        Album <SortIndicator column="album" />
                    </span>
                    <span className="cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('artist')}>
                        Artist <SortIndicator column="artist" />
                    </span>
                    <span className="text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('duration')}>
                        Time <SortIndicator column="duration" />
                    </span>
                    <span></span>
                </div>

                {sortedTracks.length === 0 ? (
                    <div className="py-10 text-center text-theme-muted text-sm">
                        This playlist is empty. Right-click songs in your library to add them here.
                    </div>
                ) : (
                    sortedTracks.map((track, index) => {
                        const isCurrentTrack = currentTrack?.id === track.id;
                        return (
                            <div
                                key={`${track.id}-${index}`}
                                onClick={() => handlePlayTrack(track)}
                                className={`grid grid-cols-[16px_1fr_1fr_1fr_48px_32px] gap-4 px-4 py-2.5 rounded-lg group transition-colors cursor-pointer ${isCurrentTrack
                                    ? 'bg-theme-surface-active text-theme-accent'
                                    : 'hover:bg-theme-surface-hover text-theme-secondary hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center text-xs font-medium justify-center">
                                    {isCurrentTrack && isPlaying ? (
                                        <div className="flex gap-0.5 items-end h-4">
                                            <div className="w-1 bg-theme-accent animate-equalizer rounded-t-sm" style={{ height: '60%', animationDelay: '0s' }} />
                                            <div className="w-1 bg-theme-accent animate-equalizer rounded-t-sm" style={{ height: '100%', animationDelay: '0.2s' }} />
                                            <div className="w-1 bg-theme-accent animate-equalizer rounded-t-sm" style={{ height: '40%', animationDelay: '0.4s' }} />
                                        </div>
                                    ) : (
                                        <>
                                            <span className={`group-hover:hidden ${isCurrentTrack ? 'text-theme-accent' : 'opacity-60'}`}>
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

                                <div className="flex items-center gap-3 min-w-0">
                                    {track.cover_image ? (
                                        <img
                                            src={track.cover_image}
                                            alt={track.album}
                                            className="w-10 h-10 rounded object-cover shadow-sm"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center">
                                            <svg className="w-5 h-5 opacity-20" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                            </svg>
                                        </div>
                                    )}
                                    <span className={`truncate font-medium ${isCurrentTrack ? 'text-theme-accent' : 'text-white'}`}>
                                        {track.title}
                                    </span>
                                </div>

                                <div className="flex items-center min-w-0">
                                    <span className="truncate text-theme-muted text-sm group-hover:text-white/70 transition-colors">
                                        {track.album}
                                    </span>
                                </div>

                                <div className="flex items-center min-w-0">
                                    <span className="truncate text-theme-muted text-sm group-hover:text-white/70 transition-colors">
                                        {track.artist}
                                    </span>
                                </div>

                                <div className="flex items-center justify-end text-sm text-theme-muted font-variant-numeric tabular-nums">
                                    {formatDuration(track.duration)}
                                </div>

                                <div className="flex items-center justify-end">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Remove "${track.title}" from playlist?`)) {
                                                removeFromPlaylist(playlist.id, track.id);
                                            }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/10 hover:text-theme-error text-theme-muted transition-all"
                                        title="Remove from playlist"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
