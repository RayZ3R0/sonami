import { usePlayer } from "../context/PlayerContext";
import React, { useRef } from 'react';

export const PlayerBar = () => {
    const { currentTrack, isPlaying, togglePlay, currentTime, duration, seek, volume, setVolume } = usePlayer();
    const volumeRef = useRef<HTMLDivElement>(null);

    if (!currentTrack) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const percent = x / width;
        const newTime = percent * duration;
        seek(newTime);
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[800px]">
            {/* The Floating Capsule */}
            <div className="glass-floating rounded-2xl flex flex-col overflow-hidden shadow-2xl transition-all hover:scale-[1.005]">

                <div className="p-3 flex items-center justify-between h-[80px] relative z-10 transition-colors duration-500">
                    {/* Left: Album Art + Info */}
                    <div className="flex items-center gap-4 w-1/3 min-w-[200px]">
                        <div className="w-14 h-14 rounded-xl bg-zinc-800 shadow-md overflow-hidden relative group">
                            {currentTrack.cover_image ? (
                                <img src={currentTrack.cover_image} className="w-full h-full object-cover animate-in fade-in duration-500" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900" />
                            )}
                        </div>
                        <div className="flex flex-col overflow-hidden mr-4">
                            <span className="text-sm font-bold text-white tracking-wide truncate">{currentTrack.title}</span>
                            <span className="text-xs text-gray-400 truncate">{currentTrack.artist}</span>
                        </div>
                    </div>

                    {/* Center: Controls */}
                    <div className="flex flex-col items-center gap-1 flex-1">
                        <div className="flex items-center gap-8">
                            <button className="text-gray-400 hover:text-white transition-colors transform active:scale-95">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 20L9 12l10-8v16zM5 4v16h2V4H5z" /></svg>
                            </button>
                            <button
                                onClick={togglePlay}
                                className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
                            >
                                {isPlaying ? (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                                ) : (
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                )}
                            </button>
                            <button className="text-gray-400 hover:text-white transition-colors transform active:scale-95">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4l10 8-10 8V4zm14 0v16h-2V4h2z" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Right: Volume & Options */}
                    <div className="flex items-center justify-end w-1/3 gap-4 pr-2">
                        <div className="group flex items-center gap-2 cursor-pointer">
                            <button 
                                onClick={() => setVolume(volume > 0 ? 0 : 1)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                {volume === 0 ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                                ) : volume < 0.5 ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                                )}
                            </button>
                            <div 
                                ref={volumeRef}
                                className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer hover:h-2 transition-all"
                                onClick={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = e.clientX - rect.left;
                                    const newVolume = Math.max(0, Math.min(1, x / rect.width));
                                    setVolume(newVolume);
                                }}
                            >
                                <div 
                                    className="h-full bg-white/70 group-hover:bg-white transition-colors rounded-full" 
                                    style={{ width: `${volume * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Seamless Bottom Seek Bar (Flowy, Functional, & Curves) */}
                <div
                    className="absolute bottom-0 left-0 w-full h-5 z-50 cursor-pointer group flex items-end"
                    onClick={handleSeek}
                >
                    {/* Visual Bar - Animates Height on Hover to 'Fill' the curves */}
                    <div className="w-full h-1 group-hover:h-2 transition-all duration-300 ease-out relative bg-white/10 group-hover:bg-white/20 backdrop-blur-md">
                        {/* Progress Fill */}
                        <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-transparent via-white/70 to-white shadow-[0_0_20px_rgba(255,255,255,0.5)]"
                            style={{
                                width: `${progress}%`,
                                transition: 'width 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
};
