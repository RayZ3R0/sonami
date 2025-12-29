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

// Placeholder lyrics - will be replaced with real lyrics system
const PLACEHOLDER_LYRICS = [
    { time: 0, text: "♪ Instrumental ♪" },
    { time: 18, text: "(It starts with one)" },
    { time: 19, text: "One thing, I don't know why" },
    { time: 21, text: "It doesn't even matter how hard you try" },
    { time: 23, text: "Keep that in mind, I designed this rhyme" },
    { time: 26, text: "To explain in due time" },
    { time: 28, text: "All I know" },
    { time: 30, text: "Time is a valuable thing" },
    { time: 32, text: "Watch it fly by as the pendulum swings" },
    { time: 34, text: "Watch it count down to the end of the day" },
    { time: 37, text: "The clock ticks life away" },
    { time: 39, text: "It's so unreal" },
    { time: 41, text: "Didn't look out below" },
    { time: 42, text: "Watch the time go right out the window" },
    { time: 44, text: "Trying to hold on, did-didn't even know" },
    { time: 47, text: "I wasted it all just to watch you go" },
    { time: 49, text: "" },
    { time: 50, text: "I kept everything inside" },
    { time: 52, text: "And even though I tried, it all fell apart" },
    { time: 55, text: "What it meant to me will eventually be" },
    { time: 57, text: "A memory of a time when I tried so hard" },
    { time: 60, text: "" },
    { time: 61, text: "I tried so hard and got so far" },
    { time: 66, text: "But in the end, it doesn't even matter" },
    { time: 71, text: "I had to fall to lose it all" },
    { time: 76, text: "But in the end, it doesn't even matter" },
    { time: 80, text: "" },
    { time: 82, text: "One thing, I don't know why" },
    { time: 84, text: "It doesn't even matter how hard you try" },
    { time: 86, text: "Keep that in mind, I designed this rhyme" },
    { time: 89, text: "To remind myself how I tried so hard" },
    { time: 92, text: "In spite of the way you were mockin' me" },
    { time: 94, text: "Actin' like I was part of your property" },
    { time: 96, text: "Remembering all the times you fought with me" },
    { time: 99, text: "I'm surprised it got so far" },
    { time: 101, text: "Things aren't the way they were before" },
    { time: 104, text: "You wouldn't even recognize me anymore" },
    { time: 106, text: "Not that you knew me back then" },
    { time: 108, text: "But it all comes back to me in the end" },
    { time: 111, text: "" },
    { time: 112, text: "You kept everything inside" },
    { time: 114, text: "And even though I tried, it all fell apart" },
    { time: 117, text: "What it meant to me will eventually be" },
    { time: 119, text: "A memory of a time when I tried so hard" },
    { time: 122, text: "" },
    { time: 123, text: "I tried so hard and got so far" },
    { time: 128, text: "But in the end, it doesn't even matter" },
    { time: 133, text: "I had to fall to lose it all" },
    { time: 138, text: "But in the end, it doesn't even matter" },
    { time: 142, text: "" },
    { time: 144, text: "I've put my trust in you" },
    { time: 149, text: "Pushed as far as I can go" },
    { time: 154, text: "For all this" },
    { time: 157, text: "There's only one thing you should know" },
    { time: 162, text: "" },
    { time: 164, text: "I've put my trust in you" },
    { time: 169, text: "Pushed as far as I can go" },
    { time: 174, text: "For all this" },
    { time: 177, text: "There's only one thing you should know" },
    { time: 182, text: "" },
    { time: 184, text: "I tried so hard and got so far" },
    { time: 189, text: "But in the end, it doesn't even matter" },
    { time: 194, text: "I had to fall to lose it all" },
    { time: 199, text: "But in the end, it doesn't even matter" },
    { time: 203, text: "" },
];

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
                ? 'text-white text-4xl font-bold opacity-100 translate-x-0 lyric-active'
                : isPast
                    ? 'text-white/40 text-2xl font-medium opacity-50 -translate-x-1 lyric-past'
                    : 'text-white/50 text-2xl font-medium opacity-60 lyric-future'
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

    // Calculate which lyric is currently active based on playback time
    const activeLyricIndex = useMemo(() => {
        let activeIdx = 0;
        for (let i = PLACEHOLDER_LYRICS.length - 1; i >= 0; i--) {
            if (currentTime >= PLACEHOLDER_LYRICS[i].time) {
                activeIdx = i;
                break;
            }
        }
        return activeIdx;
    }, [currentTime]);

    // Auto-scroll to active lyric with throttled smooth scrolling
    useEffect(() => {
        // Only scroll when the active lyric index actually changes
        if (activeLyricIndex === lastScrolledIndexRef.current) return;

        // Clear any pending scroll
        if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
        }

        // Throttle scroll updates to prevent jank
        scrollTimeoutRef.current = setTimeout(() => {
            if (activeLyricRef.current && lyricsContainerRef.current) {
                const container = lyricsContainerRef.current;
                const activeLine = activeLyricRef.current;

                const containerRect = container.getBoundingClientRect();
                const lineRect = activeLine.getBoundingClientRect();

                // Calculate target scroll position (center the active lyric)
                const targetScrollTop = activeLine.offsetTop - (containerRect.height / 2) + (lineRect.height / 2);

                // Smooth scroll to target
                startTransition(() => {
                    container.scrollTo({
                        top: Math.max(0, targetScrollTop),
                        behavior: 'smooth'
                    });
                });

                lastScrolledIndexRef.current = activeLyricIndex;
            }
        }, 50); // Small throttle to batch rapid updates

        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [activeLyricIndex]);

    // Only render when open
    if (!isOpen || !currentTrack) return null;

    return (
        <div
            className="fixed inset-0 z-[100] fullscreen-view-container fullscreen-enter"
            role="dialog"
            aria-modal="true"
            aria-label="Full screen player"
        >
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
                <div className="absolute top-6 right-6 z-50 pointer-events-auto fullscreen-close-enter">
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full
                            bg-white/10 hover:bg-white/20
                            flex items-center justify-center transition-all duration-200
                            hover:scale-110 active:scale-95"
                        aria-label="Close full screen view"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Wrapper with visible overflow for glow, inner scroll container */}
                <div className="relative max-h-[65vh] w-full lyrics-wrapper">
                    <div
                        ref={lyricsContainerRef}
                        className="lyrics-container overflow-y-auto overflow-x-visible max-h-[65vh] space-y-3 pl-8 pr-4 pointer-events-auto w-full"
                    >
                        {PLACEHOLDER_LYRICS.map((lyric, index) => (
                            <LyricLine
                                key={index}
                                text={lyric.text}
                                isActive={index === activeLyricIndex}
                                isPast={index < activeLyricIndex}
                                lineRef={index === activeLyricIndex ? activeLyricRef : undefined}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="absolute bottom-8 left-8 z-50">
                <MiniPlayerBar />
            </div>
            {isPlaying && (
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
