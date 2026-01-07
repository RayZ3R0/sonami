import { useState, useEffect, useMemo } from 'react';
import { getFavorites, removeFavorite, UnifiedTrack } from '../api/favorites';
import { usePlayer } from '../context/PlayerContext';
import { Track } from '../types';

type SortColumn = 'title' | 'artist' | 'album' | 'duration' | 'date_added';
type SortDirection = 'asc' | 'desc';

// Map UnifiedTrack to Track for PlayerContext
// UnifiedTrack from library extends Track, but for Tidal tracks path may be empty
const mapToTrack = (unified: UnifiedTrack): Track => {
    // For Tidal tracks, file_path will be empty, so we need to construct a tidal:// URL
    let trackPath = unified.path;

    // If path is empty and we have a tidal_id, construct the tidal: path
    if ((!trackPath || trackPath.trim() === '') && unified.tidal_id) {
        trackPath = `tidal:${unified.tidal_id}`;
    } else if ((!trackPath || trackPath.trim() === '') && unified.local_path) {
        trackPath = unified.local_path;
    }

    return {
        ...unified,
        path: trackPath,
    };
};

// Format duration helper
const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Format total duration
const formatTotalDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
        return `${hours} hr ${mins} min`;
    }
    return `${mins} min`;
};

// Format relative date
const formatRelativeDate = (timestamp?: number): string => {
    if (!timestamp) return '';
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;

    // For older dates, show simple date
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString();
};

export const LikedSongsView = () => {
    const { currentTrack, playTrack, shuffle, toggleShuffle, isPlaying } = usePlayer();

    const [favorites, setFavorites] = useState<UnifiedTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<SortColumn>('date_added');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Fetch favorites on mount
    useEffect(() => {
        const fetchFavorites = async () => {
            setLoading(true);
            try {
                const data = await getFavorites();
                setFavorites(data);
            } catch (err) {
                console.error('Failed to fetch favorites:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchFavorites();
    }, []);

    // Sorted favorites
    const sortedFavorites = useMemo(() => {
        return [...favorites].sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'date_added':
                    // Default to 0 if undefined to push to bottom/top consistently
                    comparison = (a.liked_at || 0) - (b.liked_at || 0);
                    break;
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
    }, [favorites, sortBy, sortDirection]);

    // Total duration
    const totalDuration = useMemo(() => {
        return favorites.reduce((acc, t) => acc + t.duration, 0);
    }, [favorites]);

    // Handle sort
    const handleSort = (column: SortColumn) => {
        if (sortBy === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            // Default desc for date_added, asc for others
            setSortDirection(column === 'date_added' ? 'desc' : 'asc');
        }
    };

    // Play all
    const handlePlayAll = async () => {
        if (sortedFavorites.length === 0) return;
        const tracksForQueue = sortedFavorites.map(mapToTrack);
        await playTrack(tracksForQueue[0], tracksForQueue);
    };

    // Shuffle play
    const handleShufflePlay = async () => {
        if (sortedFavorites.length === 0) return;

        // Enable shuffle if not already
        if (!shuffle) {
            await toggleShuffle();
        }

        const tracksForQueue = sortedFavorites.map(mapToTrack);
        const randomIndex = Math.floor(Math.random() * tracksForQueue.length);
        await playTrack(tracksForQueue[randomIndex], tracksForQueue);
    };

    // Play specific track
    const handlePlayTrack = async (track: UnifiedTrack) => {
        const tracksForQueue = sortedFavorites.map(mapToTrack);
        const trackToPlay = mapToTrack(track);
        await playTrack(trackToPlay, tracksForQueue);
    };

    // Unfavorite
    const handleUnfavorite = async (trackId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await removeFavorite(trackId);
            setFavorites(prev => prev.filter(t => t.id !== trackId));
        } catch (err) {
            console.error('Failed to unfavorite:', err);
        }
    };

    // Sort indicator
    const SortIndicator = ({ column }: { column: SortColumn }) => {
        if (sortBy !== column) return null;
        return (
            <span className="ml-1 text-theme-accent">
                {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-pulse text-theme-muted">Loading liked songs...</div>
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
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-24 h-24 text-white">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                    </div>

                    {/* Info */}
                    <div className="flex-1 pb-2">
                        <p className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">Playlist</p>
                        <h1 className="text-5xl font-bold text-white mb-4">Liked Songs</h1>
                        <p className="text-sm text-theme-muted">
                            {favorites.length} {favorites.length === 1 ? 'song' : 'songs'} • {formatTotalDuration(totalDuration)}
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
                        Play
                    </button>
                    <button
                        onClick={handleShufflePlay}
                        disabled={favorites.length === 0}
                        className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${shuffle
                            ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
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

            {/* Table */}
            {favorites.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-theme-muted">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-16 h-16 mb-4 opacity-30">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <p className="text-lg font-medium">No liked songs yet</p>
                    <p className="text-sm opacity-60 mt-1">Like songs to see them here</p>
                </div>
            ) : (
                <div className="flex-1 overflow-auto px-8">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-theme-background-secondary z-10">
                            <tr className="text-left text-xs font-semibold text-theme-muted uppercase tracking-wider border-b border-white/5">
                                <th className="py-3 px-4 w-12">#</th>
                                <th
                                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                                    onClick={() => handleSort('title')}
                                >
                                    Title <SortIndicator column="title" />
                                </th>
                                <th
                                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                                    onClick={() => handleSort('album')}
                                >
                                    Album <SortIndicator column="album" />
                                </th>
                                <th
                                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                                    onClick={() => handleSort('artist')}
                                >
                                    Artist <SortIndicator column="artist" />
                                </th>
                                <th
                                    className="py-3 px-4 cursor-pointer hover:text-white transition-colors"
                                    onClick={() => handleSort('date_added')}
                                >
                                    Date Added <SortIndicator column="date_added" />
                                </th>
                                <th
                                    className="py-3 px-4 w-20 cursor-pointer hover:text-white transition-colors text-right"
                                    onClick={() => handleSort('duration')}
                                >
                                    <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <SortIndicator column="duration" />
                                </th>
                                <th className="py-3 px-4 w-12"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedFavorites.map((track, index) => {
                                const isCurrentTrack = currentTrack?.id === track.id;
                                return (
                                    <tr
                                        key={track.id}
                                        onClick={() => handlePlayTrack(track)}
                                        className={`group cursor-pointer transition-colors ${isCurrentTrack
                                            ? 'bg-pink-500/10'
                                            : 'hover:bg-white/5'
                                            }`}
                                    >
                                        {/* Number / Playing indicator */}
                                        <td className="py-3 px-4 text-sm text-theme-muted">
                                            {isCurrentTrack && isPlaying ? (
                                                <div className="flex items-center justify-center">
                                                    <div className="flex gap-0.5 items-end h-4">
                                                        <div className="w-1 bg-pink-500 animate-[equalizer_0.5s_ease-in-out_infinite]" style={{ height: '60%' }} />
                                                        <div className="w-1 bg-pink-500 animate-[equalizer_0.5s_ease-in-out_infinite_0.1s]" style={{ height: '100%' }} />
                                                        <div className="w-1 bg-pink-500 animate-[equalizer_0.5s_ease-in-out_infinite_0.2s]" style={{ height: '40%' }} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className={`group-hover:hidden ${isCurrentTrack ? 'text-pink-500' : ''}`}>
                                                    {index + 1}
                                                </span>
                                            )}
                                            {!isCurrentTrack && (
                                                <svg className="w-4 h-4 hidden group-hover:block" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            )}
                                        </td>

                                        {/* Title & Cover */}
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                {track.cover_image ? (
                                                    <img
                                                        src={track.cover_image}
                                                        alt={track.album}
                                                        className="w-10 h-10 rounded object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded bg-theme-surface flex items-center justify-center">
                                                        <svg className="w-4 h-4 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div className="flex flex-col min-w-0">
                                                    <span className={`font-medium truncate ${isCurrentTrack ? 'text-pink-500' : 'text-white'}`}>
                                                        {track.title}
                                                    </span>
                                                    <span className="text-xs text-theme-muted truncate md:hidden">
                                                        {track.artist}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Album */}
                                        <td className="py-3 px-4 text-sm text-theme-muted truncate max-w-[200px]">
                                            {track.album}
                                        </td>

                                        {/* Artist */}
                                        <td className="py-3 px-4 text-sm text-theme-muted truncate max-w-[150px]">
                                            {track.artist}
                                        </td>

                                        {/* Date Added */}
                                        <td className="py-3 px-4 text-sm text-theme-muted truncate">
                                            {formatRelativeDate(track.liked_at)}
                                        </td>

                                        {/* Duration */}
                                        <td className="py-3 px-4 text-sm text-theme-muted text-right font-mono tabular-nums">
                                            {formatDuration(track.duration)}
                                        </td>

                                        {/* Unfavorite Button */}
                                        <td className="py-3 px-4">
                                            <button
                                                onClick={(e) => handleUnfavorite(track.id, e)}
                                                className="text-pink-500 hover:text-pink-400 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Remove from Liked Songs"
                                            >
                                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
