import { usePlayer } from "../context/PlayerContext";
import { useState } from "react";
import { Track } from "../types";

interface ContextMenuState {
    x: number;
    y: number;
    track: Track;
}

export const MainStage = () => {
    const { tracks, playTrack, addToQueue, currentTrack } = usePlayer();
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    const handleContextMenu = (e: React.MouseEvent, track: Track) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            track
        });
    };

    const closeContextMenu = () => setContextMenu(null);

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div 
            className="flex-1 h-full overflow-y-auto relative no-scrollbar pb-40"
            onClick={closeContextMenu}
        >

            <div className="absolute top-0 left-0 w-full h-[500px] gradient-top pointer-events-none -z-10" />

            <div className="p-8 pt-6">
                <h1 className="text-4xl font-bold mb-8 tracking-tight text-theme-primary">Listen Now</h1>

                {tracks.length === 0 ? (
                    <div className="empty-state">
                        <p className="text-xl font-bold mb-2">Your Library is Empty</p>
                        <p className="text-sm">Click "File" or "Folder" in the sidebar to add music.</p>
                    </div>
                ) : (
                    <div>
                        <h2 className="text-xl font-bold text-theme-primary mb-4">
                            Your Library
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
                                    onClick={() => playTrack(track)}
                                    onContextMenu={(e) => handleContextMenu(e, track)}
                                >
                                    <div className="card-track-image aspect-square w-full rounded-lg shadow-lg mb-3 bg-theme-secondary relative overflow-hidden transition-transform">
                                        {track.cover_image ? (
                                            <img src={track.cover_image} className="w-full h-full object-cover" alt={track.title} />
                                        ) : (
                                            <div className="album-art-placeholder">
                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                                            </div>
                                        )}

                                        {/* Playing indicator - subtle animated bars */}
                                        {isPlaying && (
                                            <div className="absolute bottom-2 left-2 flex items-end gap-[3px] h-4">
                                                <span className="w-[3px] bg-theme-accent rounded-full animate-eq-1" />
                                                <span className="w-[3px] bg-theme-accent rounded-full animate-eq-2" />
                                                <span className="w-[3px] bg-theme-accent rounded-full animate-eq-3" />
                                            </div>
                                        )}

                                        <div className="card-track-overlay">
                                            <div className="w-12 h-12 bg-theme-primary rounded-full flex items-center justify-center text-theme-inverse shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-all">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className={`font-semibold truncate text-[15px] ${isPlaying ? 'text-theme-accent' : 'text-theme-primary'}`}>{track.title}</h3>
                                    <p className="text-sm text-theme-muted truncate">{track.artist} • {formatDuration(track.duration)}</p>
                                </div>
                            )})}
                        </div>
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 glass-floating rounded-lg py-1 min-w-[160px] shadow-xl"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="w-full px-4 py-2 text-left text-sm text-theme-primary hover:bg-theme-surface-hover transition-colors flex items-center gap-2"
                        onClick={() => {
                            playTrack(contextMenu.track);
                            closeContextMenu();
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        Play Now
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left text-sm text-theme-primary hover:bg-theme-surface-hover transition-colors flex items-center gap-2"
                        onClick={() => {
                            addToQueue(contextMenu.track);
                            closeContextMenu();
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add to Queue
                    </button>
                    <div className="border-t border-theme my-1" />
                    <div className="px-4 py-2 text-xs text-theme-muted">
                        <p className="truncate">{contextMenu.track.album}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
