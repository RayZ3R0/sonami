import { useEffect, useState } from "react";
import { getLibraryTracks, UnifiedTrack } from "../api/library";
import { usePlayer } from "../context/PlayerContext";


export const LibraryView = () => {
    const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
    const [loading, setLoading] = useState(true);
    const { playTrack, currentTrack } = usePlayer();

    useEffect(() => {
        loadLibrary();
    }, []);

    const loadLibrary = async () => {
        try {
            const libTracks = await getLibraryTracks();
            setTracks(libTracks);
        } catch (e) {
            console.error("Failed to load library:", e);
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-theme-secondary">Loading library...</div>
            </div>
        );
    }

    return (
        <div className="p-8 pt-6 pb-40">
            <h1 className="text-4xl font-bold mb-8 tracking-tight text-theme-primary">Your Library</h1>

            {tracks.length === 0 ? (
                <div className="empty-state">
                    <p className="text-xl font-bold mb-2">Your Library is Empty</p>
                    <p className="text-sm">Search for tracks on Tidal or import local files.</p>
                </div>
            ) : (
                <div>
                    <h2 className="text-xl font-bold text-theme-primary mb-4">
                        All Tracks
                        <span className="text-sm font-normal text-theme-muted ml-2">
                            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
                        </span>
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {tracks.map(track => {
                            const isPlaying = currentTrack?.id === track.id;
                            return (
                                <div
                                    key={track.id}
                                    className="card-track group"
                                    onClick={() => playTrack(track, tracks)}
                                >
                                    <div className="card-track-image aspect-square w-full rounded-lg shadow-lg mb-3 bg-theme-secondary relative overflow-hidden transition-transform">
                                        {track.cover_image ? (
                                            <img src={track.cover_image} className="w-full h-full object-cover" alt={track.title} />
                                        ) : (
                                            <div className="album-art-placeholder flex items-center justify-center w-full h-full bg-theme-secondary">
                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                                            </div>
                                        )}

                                        {isPlaying && (
                                            <div className="absolute bottom-2 left-2 flex items-end gap-[3px] h-4">
                                                <span className="w-[3px] bg-theme-accent rounded-full animate-eq-1" />
                                                <span className="w-[3px] bg-theme-accent rounded-full animate-eq-2" />
                                                <span className="w-[3px] bg-theme-accent rounded-full animate-eq-3" />
                                            </div>
                                        )}

                                        <div className="card-track-overlay absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="w-12 h-12 bg-theme-primary rounded-full flex items-center justify-center text-theme-inverse shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-all">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className={`font-semibold truncate text-[15px] ${isPlaying ? 'text-theme-accent' : 'text-theme-primary'}`}>{track.title}</h3>
                                    <p className="text-sm text-theme-muted truncate">
                                        {track.source === 'TIDAL' && <span className="mr-1 text-[10px] bg-blue-500/20 text-blue-400 px-1 rounded">TIDAL</span>}
                                        {track.artist} • {formatDuration(track.duration)}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
