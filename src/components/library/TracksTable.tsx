import React, { useState } from 'react';
import { UnifiedTrack } from '../../api/library';
import { usePlayer } from '../../context/PlayerContext';

interface TracksTableProps {
    tracks: UnifiedTrack[];
}

export const TracksTable: React.FC<TracksTableProps> = ({ tracks }) => {
    const { playTrack, currentTrack } = usePlayer();

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const ImageWithFallback = ({ src, alt }: { src?: string, alt: string }) => {
        const [error, setError] = useState(false);

        if (!src || error) {
            return (
                <div className="w-10 h-10 rounded bg-theme-secondary flex items-center justify-center text-theme-muted">
                    <svg className="w-5 h-5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                </div>
            );
        }

        return (
            <img
                src={src}
                alt={alt}
                onError={() => setError(true)}
                className="w-10 h-10 rounded object-cover shadow-sm bg-theme-secondary"
            />
        );
    };

    return (
        <div className="tracks-table w-full">
            <div className="grid grid-cols-[40px_minmax(200px,2fr)_minmax(150px,1.5fr)_minmax(150px,1.5fr)_60px] gap-4 px-4 py-3 text-xs font-semibold text-theme-muted border-b border-theme-border/30 uppercase tracking-wider mb-2">
                <div className="text-center">#</div>
                <div>Title</div>
                <div>Artist</div>
                <div>Album</div>
                <div className="text-right">Time</div>
            </div>

            <div className="flex flex-col gap-0.5">
                {tracks.map((track, index) => {
                    const isPlaying = currentTrack?.id === track.id;
                    return (
                        <div
                            key={track.id}
                            onDoubleClick={() => playTrack(track, tracks)}
                            className={`
                                group grid grid-cols-[40px_minmax(200px,2fr)_minmax(150px,1.5fr)_minmax(150px,1.5fr)_60px] gap-4 px-4 py-2.5
                                items-center hover:bg-theme-highlight/40 transition-colors cursor-default rounded-md
                                ${isPlaying ? 'bg-theme-highlight/60' : ''}
                            `}
                        >
                            <div className="relative w-full flex justify-center text-theme-muted font-mono text-sm">
                                <span className={`group-hover:opacity-0 transition-opacity flex items-center justify-center h-5 w-5 ${isPlaying ? 'text-theme-accent' : ''}`}>
                                    {isPlaying ? (
                                        <div className="flex items-end gap-[2px] h-3">
                                            <span className="w-[2px] bg-theme-accent animate-eq-1 h-2" />
                                            <span className="w-[2px] bg-theme-accent animate-eq-2 h-3" />
                                            <span className="w-[2px] bg-theme-accent animate-eq-3 h-1.5" />
                                        </div>
                                    ) : (
                                        index + 1
                                    )}
                                </span>
                                <button
                                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-theme-primary hover:text-theme-accent focus:outline-none"
                                    onClick={() => playTrack(track, tracks)}
                                >
                                    <svg className="w-5 h-5 fill-current drop-shadow-sm" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex items-center gap-4 min-w-0">
                                <ImageWithFallback src={track.cover_image} alt={track.title} />
                                <div className="flex flex-col truncate pr-2">
                                    <span className={`truncate font-medium text-[15px] ${isPlaying ? 'text-theme-accent' : 'text-theme-primary'}`}>
                                        {track.title}
                                    </span>
                                    {track.source === 'TIDAL' && (
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1 rounded uppercase tracking-wider">TIDAL</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="truncate text-sm text-theme-muted group-hover:text-theme-primary transition-colors">
                                {track.artist}
                            </div>

                            <div className="truncate text-sm text-theme-muted group-hover:text-theme-primary transition-colors">
                                {track.album}
                            </div>

                            <div className="text-right text-sm text-theme-muted font-mono">
                                {formatDuration(track.duration)}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
