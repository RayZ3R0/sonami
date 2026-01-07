import { usePlayer, usePlaybackProgress } from "../context/PlayerContext";
import React, { useRef, useState, useEffect, useCallback } from "react";
import { FullScreenView } from "./FullScreenView";

const MarqueeText = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const isScrolling =
          textRef.current.scrollWidth > containerRef.current.clientWidth + 1;
        setIsOverflowing(isScrolling);
      }
    };

    checkOverflow();

    const timeoutId = setTimeout(checkOverflow, 100);

    const resizeObserver = new ResizeObserver(() => checkOverflow());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden whitespace-nowrap ${isOverflowing ? "mask-fade-edges" : ""}`}
      title={text}
    >
      <div className={`inline-flex ${isOverflowing ? "animate-marquee" : ""}`}>
        <span
          ref={textRef}
          className={`${className} ${isOverflowing ? "pr-8" : ""}`}
        >
          {text}
        </span>
        {isOverflowing && <span className={`${className} pr-8`}>{text}</span>}
      </div>
    </div>
  );
};

// Icons
const ShuffleIcon = ({ active }: { active: boolean }) => (
  <svg
    width="18"
    height="18"
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
    width="18"
    height="18"
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

const QueueIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return "0:00";

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const PlayerBar = () => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    seek,
    volume,
    setVolume,
    nextTrack,
    prevTrack,
    shuffle,
    repeatMode,
    toggleShuffle,
    toggleRepeat,
    isQueueOpen,
    setIsQueueOpen,
    playerBarStyle,
  } = usePlayer();
  const { currentTime, duration } = usePlaybackProgress();
  const seekBarRef = useRef<HTMLDivElement>(null);
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!seekBarRef.current) return;
      const rect = seekBarRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percent = x / rect.width;
      setDragPosition(percent * duration);
    };

    const handleGlobalMouseUp = () => {
      if (dragPosition !== null) {
        seek(dragPosition);
      }
      setIsDragging(false);
      setDragPosition(null);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isDragging, dragPosition, duration, seek]);

  useEffect(() => {
    if (!isVolumeDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!volumeBarRef.current) return;
      const rect = volumeBarRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const newVolume = x / rect.width;
      setVolume(newVolume);
    };

    const handleGlobalMouseUp = () => {
      setIsVolumeDragging(false);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isVolumeDragging, setVolume]);

  const handleVolumeWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setVolume(Math.max(0, Math.min(1, volume + delta)));
    },
    [volume, setVolume],
  );

  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!volumeBarRef.current) return;
    const rect = volumeBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newVolume = x / rect.width;
    setVolume(newVolume);
    setIsVolumeDragging(true);
  };

  const openFullScreen = useCallback(() => {
    setIsFullScreenOpen(true);
  }, []);

  const closeFullScreen = useCallback(() => {
    setIsFullScreenOpen(false);
  }, []);

  if (!currentTrack) return null;

  const displayTime =
    isDragging && dragPosition !== null ? dragPosition : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!seekBarRef.current) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    setDragPosition(percent * duration);
    setIsDragging(true);
  };

  const handleSeekHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekBarRef.current || isDragging) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    setHoverPosition(percent * duration);
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    if (!seekBarRef.current) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    seek(percent * duration);
  };

  const isFloating = playerBarStyle === "floating";

  // Dynamic classes based on style
  const containerClasses = isFloating
    ? "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-[860px]"
    : "w-full z-50 bg-theme-background"; // bg-theme-background ensures no transparency issues if glass fails

  const innerClasses = isFloating
    ? "glass-floating rounded-2xl flex flex-col overflow-hidden shadow-2xl transition-all hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
    : "flex flex-col overflow-hidden shadow-[0_-4px_20px_rgba(0,0,0,0.1)] bg-theme-background";

  return (
    <>
      <FullScreenView isOpen={isFullScreenOpen} onClose={closeFullScreen} />

      <div className={containerClasses}>
        <div className={innerClasses}>
          <div className="px-4 pt-3 pb-2 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3 w-[30%] min-w-[180px]">
              <div
                className="w-12 h-12 rounded-lg bg-theme-secondary shadow-lg overflow-hidden flex-shrink-0 player-album-art-clickable"
                onClick={openFullScreen}
                title="Open full screen view"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && openFullScreen()}
              >
                {currentTrack.cover_image ? (
                  <img
                    src={currentTrack.cover_image}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="album-art-placeholder">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-theme-muted"
                    >
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex flex-col overflow-hidden min-w-0">
                <MarqueeText
                  text={currentTrack.title}
                  className="text-sm font-semibold text-theme-primary leading-tight"
                />
                <span className="text-xs text-theme-secondary truncate">
                  {currentTrack.artist}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleShuffle}
                className={`player-control-sm ${shuffle ? "text-theme-accent" : ""}`}
                title={shuffle ? "Shuffle: On" : "Shuffle: Off"}
              >
                <ShuffleIcon active={shuffle} />
              </button>

              <button onClick={prevTrack} className="player-control">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>

              <button onClick={togglePlay} className="btn-play shadow-black/20">
                {isPlaying ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="ml-0.5"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button onClick={nextTrack} className="player-control">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>

              <button
                onClick={toggleRepeat}
                className={`player-control-sm ${repeatMode !== "off" ? "text-theme-accent" : ""}`}
                title={`Repeat: ${repeatMode === "off" ? "Off" : repeatMode === "all" ? "All" : "One"}`}
              >
                <RepeatIcon mode={repeatMode} />
              </button>
            </div>

            <div className="flex items-center justify-end w-[30%] gap-3 pr-1">
              <div className="group flex items-center gap-2">
                <button
                  onClick={() => setVolume(volume > 0 ? 0 : 1)}
                  className="text-theme-secondary hover:text-theme-primary transition-colors"
                >
                  {volume === 0 ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </button>
                <div
                  ref={volumeBarRef}
                  className="w-20 h-4 flex items-center cursor-pointer group"
                  onMouseDown={handleVolumeMouseDown}
                  onWheel={handleVolumeWheel}
                >
                  <div className="w-full h-1 progress-track overflow-hidden group-hover:h-1.5 transition-all relative">
                    <div
                      className="h-full progress-fill"
                      style={{ width: `${volume * 100}%` }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-theme-primary rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ left: `calc(${volume * 100}% - 5px)` }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsQueueOpen(!isQueueOpen)}
                className={`player-control-sm relative ${isQueueOpen ? "text-theme-accent" : ""}`}
                title="Queue"
              >
                <QueueIcon />
              </button>
            </div>
          </div>

          <div className="px-4 pb-3 pt-1">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-theme-secondary w-12 text-right tabular-nums">
                {formatTime(displayTime)}
              </span>

              <div
                ref={seekBarRef}
                className="flex-1 h-6 flex items-center cursor-pointer group"
                onClick={handleSeekClick}
                onMouseDown={handleSeekStart}
                onMouseMove={handleSeekHover}
                onMouseLeave={() => setHoverPosition(null)}
              >
                <div className="w-full h-1 progress-track relative group-hover:h-1.5 transition-all">
                  <div className="absolute inset-0 rounded-full overflow-hidden">
                    <div
                      className="h-full progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {hoverPosition !== null && !isDragging && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-theme-surface-active rounded-full"
                      style={{ left: `${(hoverPosition / duration) * 100}%` }}
                    />
                  )}

                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-theme-primary rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `calc(${progress}% - 6px)` }}
                  />
                </div>
              </div>

              <span className="text-[11px] font-mono text-theme-secondary w-12 tabular-nums">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
