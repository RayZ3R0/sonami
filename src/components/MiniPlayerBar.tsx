import { memo, useRef, useState } from "react";
import { usePlayer, usePlaybackProgress } from "../context/PlayerContext";

// Icons (smaller versions for mini player)
const ShuffleIcon = ({ active }: { active: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={active ? "text-theme-accent" : ""}
  >
    <polyline points="16 3 21 3 21 8" />
    <line x1="4" y1="20" x2="21" y2="3" />
    <polyline points="21 16 21 21 16 21" />
    <line x1="15" y1="15" x2="21" y2="21" />
    <line x1="4" y1="4" x2="9" y2="9" />
  </svg>
);

const RepeatIcon = ({ mode }: { mode: "off" | "all" | "one" }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={mode !== "off" ? "text-theme-accent" : ""}
  >
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    {mode === "one" && (
      <text
        x="10"
        y="14"
        fontSize="8"
        fill="currentColor"
        stroke="none"
        fontWeight="bold"
      >
        1
      </text>
    )}
  </svg>
);

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const MiniPlayerBar = memo(() => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    seek,
    shuffle,
    repeatMode,
    toggleShuffle,
    toggleRepeat,
    nextTrack,
    prevTrack,
  } = usePlayer();
  const { currentTime, duration } = usePlaybackProgress();
  const seekBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekBarRef.current) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    seek(percent * duration);
  };

  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleSeekClick(e);
  };

  const handleSeekMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !seekBarRef.current) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    seek(percent * duration);
  };

  const handleSeekEnd = () => {
    setIsDragging(false);
  };

  return (
    <div className="mini-player-bar">
      {/* Dedicated drag handle area - only show in mini mode */}
      <div className="drag-handle-area flex justify-center py-2 -mt-1 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors rounded-t-lg">
        <div className="w-12 h-1 bg-white/25 rounded-full hover:bg-white/40 transition-all duration-200">
          <div className="w-full h-full bg-gradient-to-r from-transparent via-white/15 to-transparent rounded-full"></div>
        </div>
      </div>

      {/* Track info */}
      <div className="track-info mb-3">
        <h3 className="text-white font-semibold text-sm truncate">
          {currentTrack.title}
        </h3>
        <p className="text-white/60 text-xs truncate">{currentTrack.artist}</p>
      </div>

      {/* Progress bar */}
      <div className="progress-section mb-3">
        <div
          ref={seekBarRef}
          className="w-full h-4 flex items-center cursor-pointer group"
          onClick={handleSeekClick}
          onMouseDown={handleSeekStart}
          onMouseMove={handleSeekMove}
          onMouseUp={handleSeekEnd}
          onMouseLeave={handleSeekEnd}
        >
          <div className="w-full h-1 bg-white/20 rounded-full relative group-hover:h-1.5 transition-all">
            <div
              className="h-full bg-white rounded-full transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 4px)` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-white/50 font-mono mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="controls-section flex items-center justify-between">
        <button
          onClick={toggleShuffle}
          className={`mini-control ${shuffle ? "text-theme-accent" : "text-white/60 hover:text-white"}`}
          title={shuffle ? "Shuffle: On" : "Shuffle: Off"}
        >
          <ShuffleIcon active={shuffle} />
        </button>

        <button
          onClick={prevTrack}
          className="mini-control text-white/80 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center 
                        hover:scale-105 active:scale-95 transition-transform shadow-lg"
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="black">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="black"
              className="ml-0.5"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          onClick={nextTrack}
          className="mini-control text-white/80 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>

        <button
          onClick={toggleRepeat}
          className={`mini-control ${repeatMode !== "off" ? "text-theme-accent" : "text-white/60 hover:text-white"}`}
          title={`Repeat: ${repeatMode === "off" ? "Off" : repeatMode === "all" ? "All" : "One"}`}
        >
          <RepeatIcon mode={repeatMode} />
        </button>
      </div>
    </div>
  );
});

MiniPlayerBar.displayName = "MiniPlayerBar";
