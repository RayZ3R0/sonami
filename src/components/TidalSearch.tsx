import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SearchTrack {
    id: number;
    title: string;
    artist?: { id?: number; name: string };
    album?: { id?: number; title: string; cover?: string };
    duration?: number;
    audioQuality?: string;
    audio_quality?: string;
}

export const TidalSearch = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchTrack[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const search = async () => {
        if (!query.trim()) return;

        setLoading(true);
        setError('');

        try {
            const response: any = await invoke('tidal_search_tracks', { query: query.trim() });
            setResults(response.items || []);
        } catch (e: any) {
            setError(e.toString());
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const playTrack = async (track: SearchTrack) => {
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
                coverUrl: coverUrl,
                quality: 'LOSSLESS'
            });
        } catch (e: any) {
            setError(`Failed to play: ${e.toString()}`);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Search Header */}
            <div className="flex-shrink-0 p-6 border-b border-theme-border">
                <h1 className="text-3xl font-bold mb-4">Search Tidal</h1>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && search()}
                        placeholder="Search for tracks..."
                        className="flex-1 px-4 py-3 bg-theme-secondary rounded-lg border border-theme-border focus:outline-none focus:border-theme-accent"
                        disabled={loading}
                    />
                    <button
                        onClick={search}
                        disabled={loading || !query.trim()}
                        className="px-6 py-3 bg-theme-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </div>
                {error && (
                    <div className="mt-3 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
                {results.length === 0 && !loading && (
                    <div className="flex items-center justify-center h-full text-theme-secondary">
                        <div className="text-center">
                            <div className="text-6xl mb-4">🎵</div>
                            <p className="text-lg">Search for tracks on Tidal</p>
                            <p className="text-sm mt-2">Try "Zero Day", "Radiohead", etc.</p>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-theme-secondary">Loading...</div>
                    </div>
                )}

                {results.length > 0 && (
                    <div className="p-6 space-y-2">
                        {results.map((track) => (
                            <div
                                key={track.id}
                                className="flex items-center gap-4 p-4 rounded-lg hover:bg-theme-secondary/50 transition-colors group"
                            >
                                {/* Album Cover */}
                                {track.album?.cover ? (
                                    <img
                                        src={`https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/160x160.jpg`}
                                        alt={track.album.title}
                                        className="w-14 h-14 rounded object-cover flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded bg-theme-secondary flex items-center justify-center flex-shrink-0">
                                        🎵
                                    </div>
                                )}

                                {/* Track Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold truncate">{track.title}</div>
                                    <div className="text-sm text-theme-secondary truncate">
                                        {track.artist?.name || 'Unknown Artist'}
                                        {track.album?.title && ` • ${track.album.title}`}
                                    </div>
                                    <div className="text-xs text-theme-tertiary mt-1">
                                        {track.audio_quality || track.audioQuality || 'LOSSLESS'}
                                        {track.duration && ` • ${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}`}
                                    </div>
                                </div>

                                {/* Play Button */}
                                <button
                                    onClick={() => playTrack(track)}
                                    className="px-6 py-2 bg-theme-accent text-white rounded-full hover:scale-105 transition-transform opacity-0 group-hover:opacity-100"
                                >
                                    Play
                                </button>
                                <button
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        const coverUrl = track.album?.cover
                                            ? `https://resources.tidal.com/images/${track.album.cover.replace(/-/g, '/')}/640x640.jpg`
                                            : undefined;
                                        try {
                                            // Construct the full TidalTrack object expected by backend
                                            const backendTrack = {
                                                id: track.id,
                                                title: track.title,
                                                artist: track.artist ? { id: track.artist.id || 0, name: track.artist.name } : undefined,
                                                album: track.album ? { id: track.album.id || 0, title: track.album.title, cover: track.album.cover } : undefined,
                                                duration: track.duration,
                                                audioQuality: track.audioQuality || track.audio_quality,
                                                cover: track.album?.cover
                                            };
                                            await import('../api/library').then(m => m.addTidalTrack(backendTrack, coverUrl));

                                            // Simple feedback (could be improved with toast)
                                            const btn = e.currentTarget;
                                            btn.innerText = "✓ Added";
                                            btn.disabled = true;
                                            setTimeout(() => {
                                                btn.innerText = "Add"; // Reset if needed, though typically one-way
                                            }, 2000);
                                        } catch (err) {
                                            console.error("Failed to add:", err);
                                        }
                                    }}
                                    className="px-4 py-2 bg-theme-surface hover:bg-theme-surface-active text-theme-primary rounded-full transition-colors opacity-0 group-hover:opacity-100 ml-2 text-sm border border-theme-border"
                                >
                                    Add
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
