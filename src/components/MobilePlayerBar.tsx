import { usePlayer, usePlaybackProgress } from "../context/PlayerContext";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { MobileFullScreenPlayer } from "./MobileFullScreenPlayer";

interface MobilePlayerBarProps {
  onNavigate?: (tab: string) => void;
}

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const MobilePlayerBar = ({ onNavigate }: MobilePlayerBarProps) => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    favorites,
    toggleFavorite,
    playbackQuality,
  } = usePlayer();
  const { currentTime, duration } = usePlaybackProgress();
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [touchDelta, setTouchDelta] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  // Swipe gesture for next/prev track
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchDelta(0);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStart.x;
      const deltaY = Math.abs(touch.clientY - touchStart.y);

      // Only track horizontal swipes
      if (deltaY < 50) {
        setTouchDelta(deltaX);
      }
    },
    [touchStart],
  );

  const handleTouchEnd = useCallback(() => {
    if (Math.abs(touchDelta) > 80) {
      if (touchDelta > 0) {
        prevTrack();
      } else {
        nextTrack();
      }
    }
    setTouchStart(null);
    setTouchDelta(0);
  }, [touchDelta, prevTrack, nextTrack]);

  // Reset animation after swipe
  useEffect(() => {
    if (!touchStart && touchDelta !== 0) {
      const timeout = setTimeout(() => setTouchDelta(0), 300);
      return () => clearTimeout(timeout);
    }
  }, [touchStart, touchDelta]);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Check if track is liked
  const trackId = currentTrack.id;
  const compositeKey =
    currentTrack.provider_id && currentTrack.external_id
      ? `${currentTrack.provider_id}:${currentTrack.external_id}`
      : null;
  const isLiked =
    favorites.has(trackId) ||
    (compositeKey ? favorites.has(compositeKey) : false);

  // Get a color hint from the cover image for accent
  const getQualityLabel = () => {
    if (!playbackQuality) return null;
    const { quality, source } = playbackQuality;
    if (source === "LOCAL")
      return { label: "LOCAL", color: "text-emerald-400" };
    if (quality === "LOSSLESS")
      return { label: "HI-RES", color: "text-amber-400" };
    if (quality === "HIGH") return { label: "HQ", color: "text-cyan-400" };
    return null;
  };

  const qualityInfo = getQualityLabel();

  return (
    <>
      {/* Fullscreen Player */}
      <MobileFullScreenPlayer
        isOpen={isFullScreenOpen}
        onClose={() => setIsFullScreenOpen(false)}
        onNavigate={onNavigate}
      />

      {/* Mobile Mini Player Bar */}
      <div
        ref={barRef}
        className="mobile-player-bar"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: touchStart
            ? `translateX(${touchDelta * 0.3}px)`
            : undefined,
          transition: touchStart ? "none" : "transform 0.3s ease-out",
        }}
      >
        {/* Progress bar at top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-theme-accent to-theme-accent/70 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Main content */}
        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsFullScreenOpen(true)}
        >
          {/* Album Art with glow effect */}
          <div className="relative">
            <div
              className="absolute inset-0 blur-xl opacity-50 scale-150"
              style={{
                backgroundImage: currentTrack.cover_image
                  ? `url(${currentTrack.cover_image})`
                  : undefined,
                backgroundSize: "cover",
              }}
            />
            <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10">
              {currentTrack.cover_image ? (
                <img
                  src={currentTrack.cover_image}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-white/40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-white truncate">
                {currentTrack.title}
              </p>
              {qualityInfo && (
                <span
                  className={`text-[8px] font-bold ${qualityInfo.color} bg-white/5 px-1 py-0.5 rounded`}
                >
                  {qualityInfo.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-white/50 truncate">
                {currentTrack.artist}
              </p>
              <span className="text-[10px] text-white/30 tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Like button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(currentTrack as any);
            }}
            className="p-2 active:scale-90 transition-transform"
          >
            <svg
              viewBox="0 0 24 24"
              fill={isLiked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              className={`w-5 h-5 transition-colors ${
                isLiked ? "text-pink-500" : "text-white/60"
              }`}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          {/* Play/Pause button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            {isPlaying ? (
              <svg
                className="w-5 h-5 text-black"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-black ml-0.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Next button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextTrack();
            }}
            className="p-2 active:scale-90 transition-transform"
          >
            <svg
              className="w-5 h-5 text-white/70"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
};
