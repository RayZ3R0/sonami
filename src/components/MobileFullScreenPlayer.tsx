import { usePlayer, usePlaybackProgress } from "../context/PlayerContext";
import React, { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useContextMenu } from "../context/ContextMenuContext";
import { usePlaylistMenu } from "../hooks/usePlaylistMenu";
import { useDownload } from "../context/DownloadContext";

interface MobileFullScreenPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

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

export const MobileFullScreenPlayer = ({
  isOpen,
  onClose,
}: MobileFullScreenPlayerProps) => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    shuffle,
    repeatMode,
    toggleShuffle,
    toggleRepeat,
    favorites,
    toggleFavorite,
    playlists,
  } = usePlayer();
  const { currentTime, duration } = usePlaybackProgress();
  const { downloadTrack } = useDownload();
  const { showActionSheet } = useContextMenu();
  const { buildPlaylistSubmenu } = usePlaylistMenu({ playlists });

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [showLyrics, setShowLyrics] = useState(false);
  const [bgColor, setBgColor] = useState({
    primary: "#1a1a2e",
    secondary: "#0a0a0f",
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const lastY = useRef(0);

  // Extract dominant color from album art
  useEffect(() => {
    if (!currentTrack?.cover_image) {
      setBgColor({ primary: "#1a1a2e", secondary: "#0a0a0f" });
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 50;
        canvas.height = 50;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, 50, 50);
        const imageData = ctx.getImageData(0, 0, 50, 50).data;

        let r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (let i = 0; i < imageData.length; i += 16) {
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
          count++;
        }

        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        // Darken for better readability
        const darken = 0.3;
        r = Math.floor(r * darken);
        g = Math.floor(g * darken);
        b = Math.floor(b * darken);

        setBgColor({
          primary: `rgb(${r}, ${g}, ${b})`,
          secondary: `rgb(${Math.floor(r * 0.5)}, ${Math.floor(g * 0.5)}, ${Math.floor(b * 0.5)})`,
        });
      } catch {
        setBgColor({ primary: "#1a1a2e", secondary: "#0a0a0f" });
      }
    };
    img.src = currentTrack.cover_image;
  }, [currentTrack?.cover_image]);

  // Swipe down to close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startY.current = touch.clientY;
    lastY.current = touch.clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const deltaY = touch.clientY - startY.current;
      lastY.current = touch.clientY;

      if (deltaY > 0) {
        setDragY(deltaY);
      }
    },
    [isDragging],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    if (dragY > 150) {
      setIsClosing(true);
      setTimeout(() => {
        onClose();
        setIsClosing(false);
        setDragY(0);
      }, 300);
    } else {
      setDragY(0);
    }
  }, [dragY, onClose]);

  // Seek bar touch handling
  const handleSeekStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      if (!seekBarRef.current) return;
      const touch = e.touches[0];
      const rect = seekBarRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
      const percent = x / rect.width;
      setSeekPosition(percent * duration);
      setIsSeeking(true);
    },
    [duration],
  );

  const handleSeekMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isSeeking || !seekBarRef.current) return;
      e.stopPropagation();
      const touch = e.touches[0];
      const rect = seekBarRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
      const percent = x / rect.width;
      setSeekPosition(percent * duration);
    },
    [isSeeking, duration],
  );

  const handleSeekEnd = useCallback(() => {
    if (isSeeking) {
      seek(seekPosition);
    }
    setIsSeeking(false);
  }, [isSeeking, seekPosition, seek]);

  // Context menu for more options
  const handleMoreOptions = useCallback(async () => {
    if (!currentTrack) return;

    const trackId = currentTrack.id;
    const compositeKey =
      currentTrack.provider_id && currentTrack.external_id
        ? `${currentTrack.provider_id}:${currentTrack.external_id}`
        : null;
    const isLiked =
      favorites.has(trackId) ||
      (compositeKey ? favorites.has(compositeKey) : false);

    const playlistItems = await buildPlaylistSubmenu(currentTrack as any);

    showActionSheet(
      [
        {
          label: isLiked ? "Remove from Liked Songs" : "Add to Liked Songs",
          action: () => toggleFavorite(currentTrack as any),
        },
        ...playlistItems,
        { label: "divider" },
        {
          label: "Download",
          action: () => downloadTrack(currentTrack),
        },
        {
          label: "Share",
          action: () => {
            if (navigator.share) {
              navigator.share({
                title: currentTrack.title,
                text: `${currentTrack.title} by ${currentTrack.artist}`,
              });
            }
          },
        },
      ],
      {
        title: currentTrack.title,
        subtitle: currentTrack.artist,
        coverImage: currentTrack.cover_image,
      },
    );
  }, [
    currentTrack,
    favorites,
    toggleFavorite,
    buildPlaylistSubmenu,
    downloadTrack,
    showActionSheet,
  ]);

  if (!isOpen || !currentTrack) return null;

  const displayTime = isSeeking ? seekPosition : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  // Check if track is liked
  const trackId = currentTrack.id;
  const compositeKey =
    currentTrack.provider_id && currentTrack.external_id
      ? `${currentTrack.provider_id}:${currentTrack.external_id}`
      : null;
  const isLiked =
    favorites.has(trackId) ||
    (compositeKey ? favorites.has(compositeKey) : false);

  const content = (
    <div
      ref={containerRef}
      className={`mobile-fullscreen-player ${isClosing ? "closing" : ""}`}
      style={{
        background: `linear-gradient(180deg, ${bgColor.primary} 0%, ${bgColor.secondary} 100%)`,
        transform: `translateY(${isClosing ? "100%" : `${dragY}px`})`,
        transition: isDragging
          ? "none"
          : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-safe-top pb-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={onClose}
          className="p-2 -ml-2 rounded-full active:bg-white/10 transition-colors"
        >
          <svg
            className="w-6 h-6 text-white/80"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Drag indicator */}
        <div className="w-10 h-1 rounded-full bg-white/30" />

        <button
          onClick={handleMoreOptions}
          className="p-2 -mr-2 rounded-full active:bg-white/10 transition-colors"
        >
          <svg
            className="w-6 h-6 text-white/80"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
            />
          </svg>
        </button>
      </div>

      {/* Album art */}
      <div className="flex-1 flex items-center justify-center px-8 pb-4">
        <div className="relative w-full max-w-[320px] aspect-square">
          {/* Glow effect */}
          <div
            className="absolute inset-0 blur-3xl opacity-40 scale-110"
            style={{
              backgroundImage: currentTrack.cover_image
                ? `url(${currentTrack.cover_image})`
                : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          {/* Album art */}
          <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            {currentTrack.cover_image ? (
              <img
                src={currentTrack.cover_image}
                alt={currentTrack.title}
                className={`w-full h-full object-cover transition-transform duration-500 ${
                  isPlaying ? "scale-100" : "scale-95"
                }`}
              />
            ) : (
              <div className="w-full h-full bg-white/5 flex items-center justify-center">
                <svg
                  className="w-24 h-24 text-white/20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Track info */}
      <div className="px-8 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">
              {currentTrack.title}
            </h1>
            <p className="text-base text-white/60 truncate mt-1">
              {currentTrack.artist}
            </p>
          </div>
          <button
            onClick={() => toggleFavorite(currentTrack as any)}
            className="p-2 active:scale-90 transition-transform flex-shrink-0"
          >
            <svg
              viewBox="0 0 24 24"
              fill={isLiked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              className={`w-7 h-7 transition-colors ${
                isLiked ? "text-pink-500" : "text-white/50"
              }`}
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-8 pb-4">
        <div
          ref={seekBarRef}
          className="relative h-8 flex items-center touch-none"
          onTouchStart={handleSeekStart}
          onTouchMove={handleSeekMove}
          onTouchEnd={handleSeekEnd}
        >
          <div className="w-full h-1 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{
                width: `${progress}%`,
                transition: isSeeking ? "none" : "width 0.1s linear",
              }}
            />
          </div>
          {/* Thumb */}
          <div
            className="absolute w-4 h-4 bg-white rounded-full shadow-lg -translate-x-1/2 transition-transform active:scale-125"
            style={{ left: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-white/50 tabular-nums">
            {formatTime(displayTime)}
          </span>
          <span className="text-xs text-white/50 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Main controls */}
      <div className="flex items-center justify-center gap-8 px-8 pb-8">
        <button
          onClick={toggleShuffle}
          className={`p-3 active:scale-90 transition-transform ${
            shuffle ? "text-theme-accent" : "text-white/50"
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
        </button>

        <button
          onClick={prevTrack}
          className="p-3 text-white active:scale-90 transition-transform"
        >
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        <button
          onClick={togglePlay}
          className="w-18 h-18 rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
          style={{ width: "72px", height: "72px" }}
        >
          {isPlaying ? (
            <svg
              className="w-8 h-8 text-black"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg
              className="w-8 h-8 text-black ml-1"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <button
          onClick={nextTrack}
          className="p-3 text-white active:scale-90 transition-transform"
        >
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>

        <button
          onClick={toggleRepeat}
          className={`p-3 active:scale-90 transition-transform ${
            repeatMode !== "off" ? "text-theme-accent" : "text-white/50"
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            {repeatMode === "one" && (
              <text
                x="10"
                y="14"
                fontSize="8"
                fill="currentColor"
                fontWeight="bold"
              >
                1
              </text>
            )}
          </svg>
        </button>
      </div>

      {/* Bottom actions */}
      <div className="flex items-center justify-center gap-12 px-8 pb-8 safe-area-bottom">
        <button
          onClick={() => {
            // TODO: Implement lyrics view
            setShowLyrics(!showLyrics);
          }}
          className={`p-3 active:scale-90 transition-transform ${
            showLyrics ? "text-theme-accent" : "text-white/40"
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
          </svg>
        </button>

        <button
          onClick={handleMoreOptions}
          className="p-3 text-white/40 active:scale-90 transition-transform"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: currentTrack.title,
                text: `${currentTrack.title} by ${currentTrack.artist}`,
              });
            }
          }}
          className="p-3 text-white/40 active:scale-90 transition-transform"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
