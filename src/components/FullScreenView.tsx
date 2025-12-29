import { useEffect, useCallback, memo, useMemo, useState, useRef, startTransition } from 'react';
import { usePlayer, usePlaybackProgress } from '../context/PlayerContext';
import { MiniPlayerBar } from './MiniPlayerBar';
// @ts-ignore
import ColorThief from 'colorthief';

interface FullScreenViewProps {
    isOpen: boolean;
    onClose: () => void;
}

// CONFIGURATION VARIABLES - Tweak these to adjust layout
const LYRICS_X_OFFSET = 1200; // Pixels to push lyrics to the right
const GRADIENT_WIDTH_PERCENT = 230; // Percentage of screen covered by the gradient from the right



// Memoized lyrics line component for performance
const LyricLine = memo(({ text, isActive, isPast, lineRef }: {
    text: string;
    isActive: boolean;
    isPast: boolean;
    lineRef?: React.RefObject<HTMLParagraphElement | null>;
}) => (
    <p
        ref={lineRef}
        className={`
            lyric-line leading-relaxed
            ${isActive
                ? 'text-white text-4xl font-bold lyric-active'
                : isPast
                    ? 'text-white/40 text-2xl font-medium lyric-past'
                    : 'text-white/50 text-2xl font-medium lyric-future'
            }
            ${text === '' ? 'h-8' : 'py-1'}
        `}
        style={isActive ? {
            textShadow: '0 0 10px rgba(255, 255, 255, 0.4), 0 0 20px rgba(255, 255, 255, 0.25), 0 0 35px rgba(255, 255, 255, 0.15), 0 0 50px rgba(255, 255, 255, 0.08)'
        } : undefined}
    >
        {text || '\u00A0'}
    </p>
));

LyricLine.displayName = 'LyricLine';

// Main component wrapped in memo for performance
export const FullScreenView = memo(({ isOpen, onClose }: FullScreenViewProps) => {
    const { currentTrack, isPlaying } = usePlayer();
    const { currentTime } = usePlaybackProgress();
    const [layerStyles, setLayerStyles] = useState<{ solid: React.CSSProperties, shadow: React.CSSProperties }>({
        solid: {},
        shadow: {}
    });

    const lyricsContainerRef = useRef<HTMLDivElement>(null);
    const activeLyricRef = useRef<HTMLParagraphElement>(null);
    const lastExtractedImageRef = useRef<string | null>(null);
    const lastScrolledIndexRef = useRef<number>(-1);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Draggable mini player state
    const STORAGE_KEY_MINI_PLAYER_POS = 'spotist-fullscreen-mini-player-position';
    
    const getDefaultPosition = useCallback(() => ({
        x: 32, 
        y: Math.max(32, window.innerHeight - 200)
    }), []);
    
    // Initialize states together with proper dependencies
    const [isFullWidth, setIsFullWidth] = useState(false);
    const [miniPlayerPosition, setMiniPlayerPosition] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_MINI_PLAYER_POS);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Handle legacy format (just {x, y}) and new format ({x, y, isFullWidth})
                const x = typeof parsed.x === 'number' ? parsed.x : 32;
                const y = typeof parsed.y === 'number' ? parsed.y : Math.max(32, window.innerHeight - 200);
                
                // Validate the saved position more thoroughly
                if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y) &&
                    x >= 0 && y >= 0 && 
                    x < window.innerWidth - 280 && 
                    y < window.innerHeight - 80) {
                    return { x, y };
                }
            }
        } catch (error) {
            console.warn('Failed to load mini player position from localStorage:', error);
        }
        return { x: 32, y: Math.max(32, window.innerHeight - 200) };
    });
    
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isInSnapZone, setIsInSnapZone] = useState(false);
    const miniPlayerRef = useRef<HTMLDivElement>(null);

    // Snap zone configuration
    const SNAP_ZONE_HEIGHT = 40; // pixels from bottom to trigger snap
    const FULL_WIDTH_THRESHOLD = 0.8; // 80% down the screen to show snap zone

    // Handle saved full-width mode on initial load
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
            console.warn('Failed to restore full-width mode:', error);
        }
    }, []);

    // Handle ESC key to close
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    // Pre-extract colors when track changes (for instant display)
    useEffect(() => {
        if (currentTrack?.cover_image && currentTrack.cover_image !== lastExtractedImageRef.current) {
            extractColors(currentTrack.cover_image);
            lastExtractedImageRef.current = currentTrack.cover_image;
        }
    }, [currentTrack]);

    // Handle isOpen state for keyboard and overflow
    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown]);

    const extractColors = useCallback((imageUrl: string) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = imageUrl;

        img.onload = () => {
            try {
                const colorThief = new ColorThief();
                const palette = colorThief.getPalette(img, 10);

                if (palette && palette.length >= 2) {
                    const getLuminance = (rgb: number[]) => (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]);
                    const darkestColor = [...palette].sort((a, b) => getLuminance(a) - getLuminance(b))[0];

                    const c1 = palette[0];
                    const c2 = palette[4] || palette[1];
                    const c3 = palette[8] || palette[2];
                    const cDark = darkestColor || [0, 0, 0];

                    const shadowStyle = {
                        background: `rgb(${cDark[0]}, ${cDark[1]}, ${cDark[2]})`
                    };

                    const solidStyle = {
                        background: `
                            radial-gradient(at 0% 0%, rgba(${c2[0]},${c2[1]},${c2[2]},1) 0px, transparent 50%),
                            radial-gradient(at 100% 0%, rgba(${cDark[0]},${cDark[1]},${cDark[2]},1) 0px, transparent 50%),
                            radial-gradient(at 100% 100%, rgba(${c3[0]},${c3[1]},${c3[2]},1) 0px, transparent 50%),
                            radial-gradient(at 0% 100%, rgba(${c1[0]},${c1[1]},${c1[2]},1) 0px, transparent 50%),
                            linear-gradient(to right, rgba(${cDark[0]},${cDark[1]},${cDark[2]},1), rgba(${c1[0]},${c1[1]},${c1[2]},1))
                        `
                    };

                    // Update layer styles
                    setLayerStyles({ solid: solidStyle, shadow: shadowStyle });
                }
            } catch (e) {
                console.error("Color extraction error:", e);
                setLayerStyles({ solid: {}, shadow: {} });
            }
        };
    }, []);

    const [lyrics, setLyrics] = useState<{ time: number, text: string }[]>([]);
    const [isSynced, setIsSynced] = useState(false);
    const [hasLyrics, setHasLyrics] = useState(false);

    // Fetch Lyrics
    useEffect(() => {
        if (!currentTrack) {
            setLyrics([]);
            setHasLyrics(false);
            return;
        }

        const fetchLyrics = async () => {
            try {
                // @ts-ignore
                const result = await import('@tauri-apps/api/core').then(mod => mod.invoke<{ synced: boolean, lines: { time: number, text: string }[] } | null>("get_lyrics", { path: currentTrack.path }));

                if (result && result.lines.length > 0) {
                    if (result.synced) {
                        setLyrics(result.lines);
                        setIsSynced(true);
                    } else {
                        // Handle unsynced: Split by lines if it's one big chunk (backend returns entire content in first line for txt/USLT)
                        // Or if backend returns multiple lines with 0 time.
                        // Our backend logic: "lines: vec![LyricLine { time: 0.0, text: content }]" for txt/USLT.
                        const rawText = result.lines[0].text;
                        const splitLines = rawText.split(/\r?\n/).map(line => ({ time: 0, text: line }));
                        setLyrics(splitLines);
                        setIsSynced(false);
                    }
                    setHasLyrics(true);
                } else {
                    setLyrics([{ time: 0, text: "No lyrics found." }]);
                    setHasLyrics(false); // Keeps "Instrumental" look or simple message
                }
            } catch (e) {
                console.error("Failed to fetch lyrics:", e);
                setLyrics([{ time: 0, text: "Error loading lyrics." }]);
                setHasLyrics(false);
            }
        };

        fetchLyrics();
    }, [currentTrack]);

    // Fallback if no lyrics found: Show Instrumental
    useEffect(() => {
        if (!hasLyrics && lyrics.length <= 1 && lyrics[0]?.text === "No lyrics found.") {
            // Maybe use PLACEHOLDER_LYRICS for demo? Or "Instrumental"?
            // User wants "properly grab lyrics", so let's check instrumental.
            // For now, let's just stick to what we set above.
        }
    }, [hasLyrics, lyrics]);


    // Calculate which lyric is currently active based on playback time
    const activeLyricIndex = useMemo(() => {
        if (!isSynced || !hasLyrics) return -1; // No active highlighting for unsynced

        let activeIdx = -1;
        // Logic: active is the *last* lyric that has time <= currentTime
        // But we want to ensure we don't highlight future ones.
        // Actually the previous logic was: find first where currentTime >= time? No loop was reversed.

        for (let i = lyrics.length - 1; i >= 0; i--) {
            if (currentTime >= lyrics[i].time) {
                activeIdx = i;
                break;
            }
        }
        return activeIdx;
    }, [currentTime, lyrics, isSynced, hasLyrics]);

    // Auto-scroll to active lyric - simplified for performance
    useEffect(() => {
        // Only scroll when the active lyric index actually changes AND we are synced
        if (!isSynced || activeLyricIndex === -1 || activeLyricIndex === lastScrolledIndexRef.current) return;

        // Clear any pending scroll
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        // Simplified scroll timing for better performance
        scrollTimeoutRef.current = setTimeout(() => {
            if (activeLyricRef.current && lyricsContainerRef.current) {
                const container = lyricsContainerRef.current;
                const activeLine = activeLyricRef.current;

                const containerRect = container.getBoundingClientRect();
                const lineRect = activeLine.getBoundingClientRect();

                // Calculate target scroll position (center the active lyric)
                const targetScrollTop = activeLine.offsetTop - (containerRect.height / 2) + (lineRect.height / 2);

                // Simple smooth scroll
                container.scrollTo({
                    top: Math.max(0, targetScrollTop),
                    behavior: 'smooth'
                });

                lastScrolledIndexRef.current = activeLyricIndex;
            }
        }, 75); // Optimized timing

        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [activeLyricIndex, isSynced]);

    // Dragging handlers for mini player
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!miniPlayerRef.current) return;
        
        // Only allow drag from dedicated drag areas
        const target = e.target as HTMLElement;
        
        // For mini mode: only drag from drag handle area
        if (!isFullWidth && !target.closest('.drag-handle-area')) {
            return;
        }
        
        // For full-width mode: only drag from left drag indicator
        if (isFullWidth && !target.closest('.full-width-drag-indicator')) {
            return;
        }
        
        // Mini player dimensions for offset calculation
        const MINI_PLAYER_WIDTH = 300;
        const MINI_PLAYER_HEIGHT = 100;
        
        // If in full-width mode, we need to calculate offset for the new mini player position
        if (isFullWidth) {
            // Set offset to center of mini player so it follows cursor naturally
            const offsetX = MINI_PLAYER_WIDTH / 2;
            const offsetY = MINI_PLAYER_HEIGHT / 2;
            
            setDragOffset({ x: offsetX, y: offsetY });
            setIsFullWidth(false);
            
            // Position mini player centered under cursor
            setMiniPlayerPosition({ 
                x: Math.max(16, Math.min(e.clientX - offsetX, window.innerWidth - MINI_PLAYER_WIDTH - 16)), 
                y: Math.max(32, Math.min(e.clientY - offsetY, window.innerHeight - MINI_PLAYER_HEIGHT - 16))
            });
        } else {
            // Normal mini mode - calculate offset from current position
            const rect = miniPlayerRef.current.getBoundingClientRect();
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
        }
        
        setIsDragging(true);
        
        e.preventDefault();
        e.stopPropagation();
    }, [isFullWidth]);

    // Double-click to reset position
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        setIsFullWidth(false);
        const resetPosition = getDefaultPosition();
        setMiniPlayerPosition(resetPosition);
        try {
            localStorage.setItem(STORAGE_KEY_MINI_PLAYER_POS, JSON.stringify({ 
                ...resetPosition, 
                isFullWidth: false 
            }));
        } catch (error) {
            console.warn('Failed to save reset position:', error);
        }
    }, [getDefaultPosition]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // More precise constraints based on actual mini player dimensions
        const MINI_PLAYER_WIDTH = 300;
        const MINI_PLAYER_HEIGHT = 100;
        const MARGIN = 16;
        
        const constrainedX = Math.max(MARGIN, Math.min(newX, window.innerWidth - MINI_PLAYER_WIDTH - MARGIN));
        const constrainedY = Math.max(MARGIN, Math.min(newY, window.innerHeight - MINI_PLAYER_HEIGHT - MARGIN));
        
        // Simplified snap zone detection - just check if we're near the bottom
        const snapTriggerY = window.innerHeight - 120; // 120px from bottom
        const inSnapZone = constrainedY >= snapTriggerY;
        
        console.log('Drag Y:', constrainedY, 'Snap trigger:', snapTriggerY, 'In zone:', inSnapZone);
        setIsInSnapZone(inSnapZone);
        
        const newPosition = { x: constrainedX, y: constrainedY };
        setMiniPlayerPosition(newPosition);
    }, [isDragging, dragOffset, isInSnapZone]);

    const handleMouseUp = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            
            let newIsFullWidth = isFullWidth;
            let newPosition = miniPlayerPosition;
            
            // Switch to full-width mode if released in snap zone
            if (isInSnapZone) {
                console.log('Switching to full-width mode!');
                newIsFullWidth = true;
                newPosition = { x: 0, y: window.innerHeight - 64 }; // Reduced height for compact design
                setIsFullWidth(true);
                setMiniPlayerPosition(newPosition);
            }
            
            setIsInSnapZone(false);
            
            // Save position to localStorage with the correct state
            try {
                localStorage.setItem(STORAGE_KEY_MINI_PLAYER_POS, JSON.stringify({
                    ...newPosition,
                    isFullWidth: newIsFullWidth
                }));
                console.log('Saved state:', { ...newPosition, isFullWidth: newIsFullWidth });
            } catch (error) {
                console.warn('Failed to save mini player position:', error);
            }
        }
    }, [isDragging, isInSnapZone, miniPlayerPosition, isFullWidth]);

    // Add global mouse event listeners for dragging
    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Reset position on window resize to prevent it going off-screen
    useEffect(() => {
        const handleResize = () => {
            setMiniPlayerPosition(prev => {
                const MINI_PLAYER_WIDTH = 300;
                const MINI_PLAYER_HEIGHT = 100;
                const MARGIN = 16;
                
                const constrainedX = Math.max(MARGIN, Math.min(prev.x, window.innerWidth - MINI_PLAYER_WIDTH - MARGIN));
                const constrainedY = Math.max(MARGIN, Math.min(prev.y, window.innerHeight - MINI_PLAYER_HEIGHT - MARGIN));
                const newPosition = { x: constrainedX, y: constrainedY };
                
                // Only save if position actually changed
                if (newPosition.x !== prev.x || newPosition.y !== prev.y) {
                    try {
                        localStorage.setItem(STORAGE_KEY_MINI_PLAYER_POS, JSON.stringify(newPosition));
                    } catch (error) {
                        console.warn('Failed to save mini player position on resize:', error);
                    }
                }
                
                return newPosition;
            });
        };
        
        if (isOpen) {
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, [isOpen]);

    // Only render when open
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
                        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/20">
                            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
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
                        zIndex: 1
                    }}
                />
            </div>

            {/* Lyrics Container - Animated */}
            <div
                className="absolute right-0 top-0 bottom-0 z-20 flex flex-col justify-center pr-20 py-20 pointer-events-auto fullscreen-lyrics-enter"
                style={{
                    left: `${LYRICS_X_OFFSET}px`,
                    pointerEvents: 'none'
                }}
            >
                {/* Lyrics scroll container */}
                <div
                    ref={lyricsContainerRef}
                    className="lyrics-container max-h-[65vh] space-y-3 px-8 pointer-events-auto w-full"
                >
                        {hasLyrics ? (
                            lyrics.map((lyric, index) => (
                                <LyricLine
                                    key={index}
                                    text={lyric.text}
                                    isActive={isSynced && index === activeLyricIndex}
                                    isPast={isSynced && index < activeLyricIndex}
                                    // If unsynced, render as 'future' (white/50) or specific style?
                                    // Use 'future' style for unsynced for now, or maybe opacity-80.
                                    lineRef={isSynced && index === activeLyricIndex ? activeLyricRef : undefined}
                                />
                            ))
                        ) : (
                            // Show simple message or instrumental
                            <div className="flex flex-col items-center justify-center h-64 opacity-50 space-y-4">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                                </svg>
                                <p className="text-xl font-medium">Instrumental / No Lyrics</p>
                            </div>
                        )}
                    </div>
                </div>

            {/* Snap zone indicator */}
            {isDragging && (
                <div className={`snap-zone-indicator ${isInSnapZone ? 'active' : ''}`} />
            )}

            {/* Mini Player */}
            <div 
                ref={miniPlayerRef}
                className={`${isFullWidth ? 'fixed bottom-0 left-0 right-0' : 'absolute'} z-50 ${isDragging ? 'transition-none' : 'transition-all duration-300 ease-out'}`}
                style={isFullWidth ? {} : {
                    left: `${miniPlayerPosition.x}px`,
                    top: `${miniPlayerPosition.y}px`,
                    userSelect: 'none'
                }}
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
            >
                <div className={`draggable-mini-player-container ${isDragging ? 'dragging' : ''} ${isFullWidth ? 'full-width' : ''}`}>
                    {/* Full-width mode drag indicator */}
                    {isFullWidth && (
                        <div className="full-width-drag-indicator" title="Drag to detach" />
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
});

FullScreenView.displayName = 'FullScreenView';
