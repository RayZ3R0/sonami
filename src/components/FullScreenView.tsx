import { useEffect, useCallback, memo, useState, useRef } from "react";
import { usePlayer, usePlaybackProgress } from "../context/PlayerContext";
import { MiniPlayerBar } from "./MiniPlayerBar";
import { SyncedLyrics, LyricsData } from "./SyncedLyrics";
import { invoke } from "@tauri-apps/api/core";
import { captureAppScreenshot } from "../utils/screenshot";

import ColorThief from "colorthief";

interface FullScreenViewProps {
  isOpen: boolean;
  onClose: () => void;
}

const LYRICS_X_OFFSET = 1100;
const GRADIENT_WIDTH_PERCENT = 230;

const imageCache = new Map<string, string>();

export const FullScreenView = memo(
  ({ isOpen, onClose }: FullScreenViewProps) => {
    const { currentTrack, isPlaying, lyricsProvider } = usePlayer();
    const { currentTime } = usePlaybackProgress();
    const [lyrics, setLyrics] = useState<LyricsData | null>(null);
    const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

    const [layerStyles, setLayerStyles] = useState<{
      solid: React.CSSProperties;
      shadow: React.CSSProperties;
    }>({
      solid: {},
      shadow: {},
    });

    const lastExtractedImageRef = useRef<string | null>(null);

    const STORAGE_KEY_MINI_PLAYER_POS =
      "spotist-fullscreen-mini-player-position";

    const getDefaultPosition = useCallback(
      () => ({
        x: 32,
        y: Math.max(32, window.innerHeight - 200),
      }),
      [],
    );

    const [isFullWidth, setIsFullWidth] = useState(false);
    const [miniPlayerPosition, setMiniPlayerPosition] = useState(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_MINI_PLAYER_POS);
        if (saved) {
          const parsed = JSON.parse(saved);

          const x = typeof parsed.x === "number" ? parsed.x : 32;
          const y =
            typeof parsed.y === "number"
              ? parsed.y
              : Math.max(32, window.innerHeight - 200);

          if (
            !isNaN(x) &&
            !isNaN(y) &&
            isFinite(x) &&
            isFinite(y) &&
            x >= 0 &&
            y >= 0 &&
            x < window.innerWidth - 280 &&
            y < window.innerHeight - 80
          ) {
            return { x, y };
          }
        }
      } catch (error) {
        console.warn(
          "Failed to load mini player position from localStorage:",
          error,
        );
      }
      return { x: 32, y: Math.max(32, window.innerHeight - 200) };
    });

    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isInSnapZone, setIsInSnapZone] = useState(false);
    const miniPlayerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_MINI_PLAYER_POS);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.isFullWidth) {
            setIsFullWidth(true);
            setMiniPlayerPosition({ x: 0, y: window.innerHeight - 80 });
          }
        }
      } catch (error) {
        console.warn("Failed to restore full-width mode:", error);
      }
    }, []);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      },
      [onClose],
    );

    useEffect(() => {
      if (
        currentTrack?.cover_image &&
        currentTrack.cover_image !== lastExtractedImageRef.current
      ) {
        extractColors(currentTrack.cover_image);
        lastExtractedImageRef.current = currentTrack.cover_image;
      }
    }, [currentTrack]);

    // Fetch lyrics when track changes
    useEffect(() => {
      if (!currentTrack || !isOpen) {
        setLyrics(null);
        return;
      }

      const fetchLyrics = async () => {
        setIsLoadingLyrics(true);
        try {
          const result = await invoke<LyricsData | null>("get_lyrics", {
            path: currentTrack.path || "",
            title: currentTrack.title,
            artist: currentTrack.artist,
            album: currentTrack.album || "",
            duration: currentTrack.duration,
            provider: lyricsProvider,
          });
          setLyrics(result);
        } catch (error) {
          console.error("Failed to fetch lyrics:", error);
          setLyrics(null);
        } finally {
          setIsLoadingLyrics(false);
        }
      };

      fetchLyrics();
    }, [currentTrack, isOpen]);

    useEffect(() => {
      if (isOpen) {
        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
      }
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }, [isOpen, handleKeyDown]);

    const getDefaultGradient = useCallback(() => {
      const cDark = [15, 15, 25];
      const c1 = [40, 40, 60];
      const c2 = [30, 30, 50];
      const c3 = [20, 20, 40];
      return {
        solid: {
          background: `
            radial-gradient(at 0% 0%, rgba(${c2[0]},${c2[1]},${c2[2]},1) 0px, transparent 50%),
            radial-gradient(at 100% 0%, rgba(${cDark[0]},${cDark[1]},${cDark[2]},1) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(${c3[0]},${c3[1]},${c3[2]},1) 0px, transparent 50%),
            radial-gradient(at 0% 100%, rgba(${c1[0]},${c1[1]},${c1[2]},1) 0px, transparent 50%),
            linear-gradient(to right, rgba(${cDark[0]},${cDark[1]},${cDark[2]},1), rgba(${c1[0]},${c1[1]},${c1[2]},1))
          `,
        },
        shadow: {
          background: `rgb(${cDark[0]}, ${cDark[1]}, ${cDark[2]})`,
        },
      };
    }, []);

    const extractColors = useCallback(
      (imageUrl: string) => {
        const processImage = async () => {
          try {
            let processableUrl = imageUrl;

            if (
              imageUrl.startsWith("http://") ||
              imageUrl.startsWith("https://")
            ) {
              if (imageCache.has(imageUrl)) {
                processableUrl = imageCache.get(imageUrl)!;
              } else {
                const { invoke } = await import("@tauri-apps/api/core");
                const dataUrl = await invoke<string>(
                  "fetch_image_as_data_url",
                  { url: imageUrl },
                );
                imageCache.set(imageUrl, dataUrl);
                processableUrl = dataUrl;
              }
            }

            const img = new Image();

            img.onerror = () => {
              console.warn(
                "Failed to load image for color extraction, using fallback",
              );
              setLayerStyles(getDefaultGradient());
            };

            img.onload = () => {
              try {
                const colorThief = new ColorThief();
                const palette = colorThief.getPalette(img, 10);

                if (palette && palette.length >= 2) {
                  const getLuminance = (rgb: number[]) =>
                    0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
                  const darkestColor = [...palette].sort(
                    (a, b) => getLuminance(a) - getLuminance(b),
                  )[0];

                  const c1 = palette[0];
                  const c2 = palette[4] || palette[1];
                  const c3 = palette[8] || palette[2];
                  const cDark = darkestColor || [0, 0, 0];

                  const shadowStyle = {
                    background: `rgb(${cDark[0]}, ${cDark[1]}, ${cDark[2]})`,
                  };

                  const solidStyle = {
                    background: `
                            radial-gradient(at 0% 0%, rgba(${c2[0]},${c2[1]},${c2[2]},1) 0px, transparent 50%),
                            radial-gradient(at 100% 0%, rgba(${cDark[0]},${cDark[1]},${cDark[2]},1) 0px, transparent 50%),
                            radial-gradient(at 100% 100%, rgba(${c3[0]},${c3[1]},${c3[2]},1) 0px, transparent 50%),
                            radial-gradient(at 0% 100%, rgba(${c1[0]},${c1[1]},${c1[2]},1) 0px, transparent 50%),
                            linear-gradient(to right, rgba(${cDark[0]},${cDark[1]},${cDark[2]},1), rgba(${c1[0]},${c1[1]},${c1[2]},1))
                        `,
                  };

                  setLayerStyles({ solid: solidStyle, shadow: shadowStyle });
                } else {
                  setLayerStyles(getDefaultGradient());
                }
              } catch (e) {
                console.error("Color extraction error:", e);
                setLayerStyles(getDefaultGradient());
              }
            };

            img.src = processableUrl;
          } catch (e) {
            console.error("Failed to fetch image:", e);
            setLayerStyles(getDefaultGradient());
          }
        };

        processImage();
      },
      [getDefaultGradient],
    );

    const handleMouseDown = useCallback(
      (e: React.MouseEvent) => {
        if (!miniPlayerRef.current) return;

        const target = e.target as HTMLElement;

        if (!isFullWidth && !target.closest(".drag-handle-area")) {
          return;
        }

        if (isFullWidth && !target.closest(".full-width-drag-indicator")) {
          return;
        }

        const MINI_PLAYER_WIDTH = 300;
        const MINI_PLAYER_HEIGHT = 100;

        if (isFullWidth) {
          const offsetX = MINI_PLAYER_WIDTH / 2;
          const offsetY = MINI_PLAYER_HEIGHT / 2;

          setDragOffset({ x: offsetX, y: offsetY });
          setIsFullWidth(false);

          setMiniPlayerPosition({
            x: Math.max(
              16,
              Math.min(
                e.clientX - offsetX,
                window.innerWidth - MINI_PLAYER_WIDTH - 16,
              ),
            ),
            y: Math.max(
              32,
              Math.min(
                e.clientY - offsetY,
                window.innerHeight - MINI_PLAYER_HEIGHT - 16,
              ),
            ),
          });
        } else {
          const rect = miniPlayerRef.current.getBoundingClientRect();
          setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }

        setIsDragging(true);

        e.preventDefault();
        e.stopPropagation();
      },
      [isFullWidth],
    );

    const handleDoubleClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setIsFullWidth(false);
        const resetPosition = getDefaultPosition();
        setMiniPlayerPosition(resetPosition);
        try {
          localStorage.setItem(
            STORAGE_KEY_MINI_PLAYER_POS,
            JSON.stringify({
              ...resetPosition,
              isFullWidth: false,
            }),
          );
        } catch (error) {
          console.warn("Failed to save reset position:", error);
        }
      },
      [getDefaultPosition],
    );

    const handleMouseMove = useCallback(
      (e: MouseEvent) => {
        if (!isDragging || !miniPlayerRef.current) return;

        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        const MINI_PLAYER_WIDTH = 300;
        const MINI_PLAYER_HEIGHT = 100;
        const MARGIN = 16;

        const constrainedX = Math.max(
          MARGIN,
          Math.min(newX, window.innerWidth - MINI_PLAYER_WIDTH - MARGIN),
        );
        const constrainedY = Math.max(
          MARGIN,
          Math.min(newY, window.innerHeight - MINI_PLAYER_HEIGHT - MARGIN),
        );

        const snapTriggerY = window.innerHeight - 120;
        const inSnapZone = constrainedY >= snapTriggerY;
        setIsInSnapZone(inSnapZone);

        // Direct DOM manipulation for instant response (no React re-render lag)
        miniPlayerRef.current.style.left = `${constrainedX}px`;
        miniPlayerRef.current.style.top = `${constrainedY}px`;

        // Store position in data attributes for mouseUp
        miniPlayerRef.current.dataset.dragX = String(constrainedX);
        miniPlayerRef.current.dataset.dragY = String(constrainedY);
      },
      [isDragging, dragOffset],
    );

    const handleMouseUp = useCallback(() => {
      if (isDragging && miniPlayerRef.current) {
        setIsDragging(false);

        // Read final position from data attributes
        const finalX = parseFloat(miniPlayerRef.current.dataset.dragX || "0");
        const finalY = parseFloat(miniPlayerRef.current.dataset.dragY || "0");

        let newIsFullWidth = isFullWidth;
        let newPosition = { x: finalX, y: finalY };

        if (isInSnapZone) {
          newIsFullWidth = true;
          newPosition = { x: 0, y: window.innerHeight - 64 };
          setIsFullWidth(true);
        }

        // Sync final position to React state
        setMiniPlayerPosition(newPosition);
        setIsInSnapZone(false);

        try {
          localStorage.setItem(
            STORAGE_KEY_MINI_PLAYER_POS,
            JSON.stringify({
              ...newPosition,
              isFullWidth: newIsFullWidth,
            }),
          );
        } catch (error) {
          console.warn("Failed to save mini player position:", error);
        }
      }
    }, [isDragging, isInSnapZone, isFullWidth]);

    useEffect(() => {
      if (isDragging) {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
        };
      }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    useEffect(() => {
      const handleResize = () => {
        setMiniPlayerPosition((prev) => {
          const MINI_PLAYER_WIDTH = 300;
          const MINI_PLAYER_HEIGHT = 100;
          const MARGIN = 16;

          const constrainedX = Math.max(
            MARGIN,
            Math.min(prev.x, window.innerWidth - MINI_PLAYER_WIDTH - MARGIN),
          );
          const constrainedY = Math.max(
            MARGIN,
            Math.min(prev.y, window.innerHeight - MINI_PLAYER_HEIGHT - MARGIN),
          );
          const newPosition = { x: constrainedX, y: constrainedY };

          if (newPosition.x !== prev.x || newPosition.y !== prev.y) {
            try {
              localStorage.setItem(
                STORAGE_KEY_MINI_PLAYER_POS,
                JSON.stringify(newPosition),
              );
            } catch (error) {
              console.warn(
                "Failed to save mini player position on resize:",
                error,
              );
            }
          }

          return newPosition;
        });
      };

      if (isOpen) {
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
      }
    }, [isOpen]);

    if (!isOpen || !currentTrack) return null;

    return (
      <div
        className="fixed inset-0 z-[100] fullscreen-view-container fullscreen-enter"
        role="dialog"
        aria-modal="true"
        aria-label="Full screen player"
      >
        {/* Close button - top left corner */}
        <div className="fixed top-0 left-0 z-[110] fullscreen-close-enter">
          <button
            onClick={onClose}
            className="group flex items-center gap-2 px-3.5 py-3
                        bg-black/20 hover:bg-black/30 backdrop-blur-md
                        border-r border-b border-white/10 hover:border-white/20
                        rounded-br-2xl
                        transition-all duration-300 ease-out
                        active:scale-95"
            aria-label="Close full screen view"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-70 group-hover:opacity-100 transition-opacity"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="text-sm font-medium text-white/70 group-hover:text-white transition-colors relative top-[1.5px]">
              Back
            </span>
          </button>
        </div>

        {/* Screenshot button - dev only, invisible, top right */}
        {import.meta.env.DEV && (
          <button
            onClick={async () => {
              const result = await captureAppScreenshot();
              if (result.success) {
                alert(`Screenshot saved!\n${result.path}`);
              } else {
                alert(`Screenshot failed: ${result.error}`);
              }
            }}
            className="fixed top-0 right-0 w-12 h-12 opacity-0 cursor-pointer z-[110]"
            title="Capture Screenshot (Dev Only)"
          />
        )}

        {/* Main Background with Album Art */}
        <div
          className="absolute inset-0 z-0 flex items-center justify-start bg-[#0a0a0f] fullscreen-bg-layer fullscreen-album-enter"
          style={layerStyles.solid}
        >
          {currentTrack.cover_image ? (
            <img
              src={currentTrack.cover_image}
              alt={currentTrack.title}
              className="h-full w-auto max-w-none object-contain object-left"
              loading="eager"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              <svg
                width="120"
                height="120"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-white/20"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
          )}
        </div>

        {/* Right Panel Overlay - Animated */}
        <div
          className="absolute right-0 top-0 bottom-0 fullscreen-acrylic-panel fullscreen-overlay-enter z-10 pointer-events-none"
          style={{ width: `${GRADIENT_WIDTH_PERCENT}%` }}
        >
          <div
            className="absolute inset-0 fullscreen-solid-layer"
            style={{
              ...layerStyles.solid,
              zIndex: 1,
            }}
          />
        </div>

        {/* Lyrics Container - Animated */}
        <div
          className="absolute right-0 top-0 bottom-0 z-20 flex flex-col justify-center py-20 pointer-events-auto fullscreen-lyrics-enter"
          style={{
            left: `${LYRICS_X_OFFSET}px`,
            right: 0,
          }}
        >
          {isLoadingLyrics ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white/60 rounded-full animate-spin mb-4" />
              <p className="text-lg font-medium text-white/60">
                Loading lyrics...
              </p>
            </div>
          ) : (
            <SyncedLyrics
              lyrics={lyrics}
              currentTime={currentTime}
              isPlaying={isPlaying}
            />
          )}
        </div>

        {/* Snap zone indicator */}
        {isDragging && (
          <div
            className={`snap-zone-indicator ${isInSnapZone ? "active" : ""}`}
          />
        )}

        {/* Mini Player */}
        <div
          ref={miniPlayerRef}
          className={`${isFullWidth ? "fixed bottom-0 left-0 right-0" : "absolute"} z-50 ${isDragging ? "transition-none" : "transition-all duration-300 ease-out"}`}
          style={
            isFullWidth
              ? {}
              : {
                  left: `${miniPlayerPosition.x}px`,
                  top: `${miniPlayerPosition.y}px`,
                  userSelect: "none",
                }
          }
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        >
          <div
            className={`draggable-mini-player-container ${isDragging ? "dragging" : ""} ${isFullWidth ? "full-width" : ""}`}
          >
            {/* Full-width mode drag indicator */}
            {isFullWidth && (
              <div
                className="full-width-drag-indicator"
                title="Drag to detach"
              />
            )}
            <MiniPlayerBar />
          </div>
        </div>
        {isPlaying && !isFullWidth && (
          <div className="absolute bottom-8 right-8 z-50">
            <div className="vinyl-indicator">
              <div className="vinyl-disc" />
            </div>
          </div>
        )}
      </div>
    );
  },
);

FullScreenView.displayName = "FullScreenView";
