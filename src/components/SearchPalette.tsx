import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { searchLibrary, UnifiedTrack, addTidalTrack } from '../api/library';
import { usePlayer } from '../context/PlayerContext';

interface TidalTrack {
    id: number;
    title: string;
    artist?: { id?: number; name: string };
    album?: { id?: number; title: string; cover?: string };
    duration?: number;
    audioQuality?: string;
    audio_quality?: string;
}

interface SearchResult {
    id: string;
    type: 'local' | 'tidal';
    title: string;
    artist: string;
    album: string;
    duration: number;
    cover?: string;
    tidalId?: number;
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

interface SearchPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SearchPalette = ({ isOpen, onClose }: SearchPaletteProps) => {
    const { playTrack } = usePlayer();
    const [query, setQuery] = useState('');
    const [localResults, setLocalResults] = useState<SearchResult[]>([]);
    const [tidalResults, setTidalResults] = useState<SearchResult[]>([]);
    const [loadingLocal, setLoadingLocal] = useState(false);
    const [loadingTidal, setLoadingTidal] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [addedTracks, setAddedTracks] = useState<Set<number>>(new Set());

    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    const debouncedQuery = useDebounce(query, 150);

    // Get tidal IDs that exist in local results (for deduplication)
    const localTidalIds = useMemo(() =>
        new Set(localResults.filter(r => r.tidalId).map(r => r.tidalId)),
        [localResults]
    );

    // Filter out tidal results that are already in library
    const filteredTidalResults = useMemo(() =>
        tidalResults.filter(r => !localTidalIds.has(r.tidalId)),
        [tidalResults, localTidalIds]
    );

    // All results combined for keyboard navigation
    const allResults = useMemo(() => {
        return [...localResults, ...filteredTidalResults];
    }, [localResults, filteredTidalResults]);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setLocalResults([]);
            setTidalResults([]);
            setSelectedIndex(0);
            setAddedTracks(new Set());
            // Focus input after a small delay for animation
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Search local library using FTS5
    useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setLocalResults([]);
            return;
        }

        const searchLocal = async () => {
            setLoadingLocal(true);
            try {
                console.log('Searching local library for:', debouncedQuery);
                const results = await searchLibrary(debouncedQuery);
                console.log('FTS search results:', results);

                setLocalResults(results.map(track => ({
                    id: track.id,
                    type: 'local' as const,
                    title: track.title,
                    artist: track.artist,
                    album: track.album,
                    duration: track.duration,
                    cover: track.cover_image,
                    tidalId: track.tidal_id,
                    track,
                })));
            } catch (e) {
                console.error('Local search failed:', e);
                setLocalResults([]);
            } finally {
                setLoadingLocal(false);
            }
        };

        searchLocal();
    }, [debouncedQuery]);

    // Search Tidal (slower, parallel) - runs independently
    useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setTidalResults([]);
            return;
        }

        const searchTidal = async () => {
            setLoadingTidal(true);
            try {
                console.log('Searching Tidal for:', debouncedQuery);
                const response: any = await invoke('tidal_search_tracks', { query: debouncedQuery });
                console.log('Tidal search results:', response);
                const items: TidalTrack[] = response.items || [];

                setTidalResults(items
                    .slice(0, 15)
                    .map(track => ({
                        id: `tidal-${track.id}`,
                        type: 'tidal' as const,
                        title: track.title,
                        artist: track.artist?.name || 'Unknown Artist',
                        album: track.album?.title || '',
                        duration: track.duration || 0,
                        cover: track.album?.cover
                            ? `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/160x160.jpg`
                            : undefined,
                        tidalId: track.id,
                        track,
                    })));
            } catch (e) {
                console.error('Tidal search failed:', e);
                setTidalResults([]);
            } finally {
                setLoadingTidal(false);
            }
        };

        // Slight delay for Tidal to let local results come first
        const timer = setTimeout(searchTidal, 200);
        return () => clearTimeout(timer);
    }, [debouncedQuery]);

    // Reset selection when results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [allResults.length]);

    // Scroll selected item into view
    useEffect(() => {
        if (resultsRef.current && allResults.length > 0) {
            const selectedElement = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex, allResults.length]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (allResults[selectedIndex]) {
                    handlePlay(allResults[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
            case 'Tab':
                e.preventDefault();
                // Tab cycles through results
                if (e.shiftKey) {
                    setSelectedIndex(prev => (prev - 1 + allResults.length) % allResults.length);
                } else {
                    setSelectedIndex(prev => (prev + 1) % allResults.length);
                }
                break;
        }
    }, [allResults, selectedIndex, onClose]);

    // Handle click outside
    const handleOverlayClick = useCallback((e: React.MouseEvent) => {
        if (e.target === overlayRef.current) {
            onClose();
        }
    }, [onClose]);

    // Play a track
    const handlePlay = async (result: SearchResult) => {
        if (result.type === 'local') {
            const track = result.track as UnifiedTrack;
            playTrack(track as any, [track] as any);
            onClose();
        } else {
            // Play Tidal track
            const track = result.track as TidalTrack;
            try {
                const coverUrl = track.album?.cover
                    ? `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/640x640.jpg`
                    : null;

                await invoke('play_tidal_track', {
                    trackId: track.id,
                    title: track.title,
                    artist: track.artist?.name || 'Unknown',
                    album: track.album?.title || 'Unknown',
                    duration: track.duration || 0,
                    coverUrl,
                    quality: 'LOSSLESS'
                });
                onClose();
            } catch (e) {
                console.error('Failed to play Tidal track:', e);
            }
        }
    };

    // Add Tidal track to library
    const handleAddToLibrary = async (result: SearchResult, e: React.MouseEvent) => {
        e.stopPropagation();
        if (result.type !== 'tidal' || !result.tidalId) return;

        const track = result.track as TidalTrack;
        const coverUrl = track.album?.cover
            ? `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/640x640.jpg`
            : undefined;

        try {
            const backendTrack = {
                id: track.id,
                title: track.title,
                artist: track.artist ? { id: track.artist.id || 0, name: track.artist.name } : undefined,
                album: track.album ? { id: track.album.id || 0, title: track.album.title, cover: track.album.cover } : undefined,
                duration: track.duration,
                audioQuality: track.audioQuality || track.audio_quality,
                cover: track.album?.cover
            };
            await addTidalTrack(backendTrack, coverUrl);
            setAddedTracks(prev => new Set(prev).add(result.tidalId!));
        } catch (err) {
            console.error('Failed to add track:', err);
        }
    };

    // Format duration
    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
                className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-in ring-1 ring-white/5"
                style={{ backgroundColor: 'var(--theme-background-secondary, #1a1a20)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
                    <svg className="w-5 h-5 text-theme-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search your library and Tidal..."
                        className="flex-1 bg-transparent text-lg text-theme-primary placeholder:text-theme-muted/60 focus:outline-none pt-[3px]"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                    />
                    {isLoading && (
                        <div className="w-5 h-5 border-2 border-theme-accent/70 border-t-transparent rounded-full animate-spin" />
                    )}
                    <div className="flex items-center gap-1 text-xs text-theme-muted/70">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/5 font-mono text-[10px]">esc</kbd>
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
                            <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                            <p className="text-sm">Start typing to search</p>
                            <p className="text-xs mt-1 opacity-70">Search your library and Tidal</p>
                        </div>
                    )}

                    {/* Initial loading state - show skeletons while searching */}
                    {hasQuery && !hasResults && isLoading && (
                        <>
                            {loadingLocal && (
                                <SkeletonSection title="Searching Library..." color="bg-emerald-500" count={2} />
                            )}
                            {loadingTidal && (
                                <div className={loadingLocal ? 'border-t border-white/5' : ''}>
                                    <SkeletonSection title="Searching Tidal..." color="bg-blue-500" count={4} />
                                </div>
                            )}
                        </>
                    )}

                    {/* No Results - only show when done loading */}
                    {hasQuery && !hasResults && !isLoading && (
                        <div className="flex flex-col items-center justify-center py-16 text-theme-muted">
                            <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm">No results for "{query}"</p>
                            <p className="text-xs mt-1 opacity-70">Try a different search term</p>
                        </div>
                    )}

                    {/* Local Results Section */}
                    {localResults.length > 0 && (
                        <div className="py-2">
                            <div className="px-5 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                In Your Library
                            </div>
                            {localResults.map((result, index) => (
                                <SearchResultItem
                                    key={result.id}
                                    result={result}
                                    index={index}
                                    isSelected={selectedIndex === index}
                                    onPlay={() => handlePlay(result)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    formatDuration={formatDuration}
                                />
                            ))}
                        </div>
                    )}

                    {/* Tidal Results Section */}
                    {filteredTidalResults.length > 0 && (
                        <div className="py-2 border-t border-white/5">
                            <div className="px-5 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wider flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                From Tidal
                                {loadingTidal && <span className="text-theme-muted/50">(loading...)</span>}
                            </div>
                            {filteredTidalResults.map((result, index) => {
                                const globalIndex = localResults.length + index;
                                const isAdded = addedTracks.has(result.tidalId!);
                                return (
                                    <SearchResultItem
                                        key={result.id}
                                        result={result}
                                        index={globalIndex}
                                        isSelected={selectedIndex === globalIndex}
                                        onPlay={() => handlePlay(result)}
                                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                                        formatDuration={formatDuration}
                                        showAddButton
                                        isAdded={isAdded}
                                        onAdd={(e) => handleAddToLibrary(result, e)}
                                    />
                                );
                            })}
                        </div>
                    )}

                    {/* Loading indicator for Tidal when local is done */}
                    {hasQuery && loadingTidal && filteredTidalResults.length === 0 && (
                        <div className={`py-2 ${localResults.length > 0 ? 'border-t border-white/5' : ''}`}>
                            <SkeletonSection title="Searching Tidal..." color="bg-blue-500" count={4} />
                        </div>
                    )}
                </div>

                {/* Footer */}
                {hasResults && (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-white/5 bg-black/20 text-xs text-theme-muted/80">
                        <div className="flex items-center gap-4 pt-[2px]">
                            <span className="flex items-center gap-1.5">
                                <kbd className="px-1.5 py-0.5 rounded bg-white/5 font-mono text-[10px]">↑↓</kbd>
                                <span className="text-[11px]">navigate</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <kbd className="px-1.5 py-0.5 rounded bg-white/5 font-mono text-[10px]">↵</kbd>
                                <span className="text-[11px]">play</span>
                            </span>
                        </div>
                        <span className="text-[11px] pt-[2px]">{allResults.length} result{allResults.length !== 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

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
}) => {
    return (
        <div
            data-index={index}
            onClick={onPlay}
            onMouseEnter={onMouseEnter}
            className={`
                flex items-center gap-4 px-5 py-3 cursor-pointer transition-colors
                ${isSelected ? 'bg-theme-accent/15' : 'hover:bg-theme-surface-hover'}
            `}
        >
            {/* Cover */}
            {result.cover ? (
                <img
                    src={result.cover}
                    alt={result.album}
                    className="w-12 h-12 rounded-md object-cover flex-shrink-0 shadow-sm"
                    loading="lazy"
                />
            ) : (
                <div className="w-12 h-12 rounded-md bg-theme-secondary flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-theme-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`truncate font-medium ${isSelected ? 'text-theme-accent' : 'text-theme-primary'}`}>
                        {result.title}
                    </span>
                    {result.type === 'local' && (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                            Library
                        </span>
                    )}
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

            {/* Add Button for Tidal */}
            {showAddButton && (
                <button
                    onClick={onAdd}
                    disabled={isAdded}
                    className={`
                        px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 -translate-y-[1px]
                        ${isAdded
                            ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                            : 'bg-white/5 hover:bg-white/10 text-theme-primary hover:text-theme-accent'
                        }
                    `}
                >
                    {isAdded ? '✓ Added' : '+ Add'}
                </button>
            )}

            {/* Play indicator when selected */}
            {isSelected && (
                <div className="w-8 h-8 rounded-full bg-theme-accent flex items-center justify-center flex-shrink-0 -translate-y-[1px]">
                    <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </div>
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
const SkeletonSection = ({ title, color, count = 3 }: { title: string; color: string; count?: number }) => {
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
