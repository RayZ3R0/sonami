import { useEffect, useCallback, memo, useMemo, useState } from 'react';
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
const LyricLine = memo(({ text, isActive, isPast }: { text: string; isActive: boolean; isPast: boolean }) => (
    <p
        className={`
            transition-all duration-500 ease-out leading-relaxed
            ${isActive
                ? 'text-white text-4xl font-bold opacity-100 translate-x-0'
                : isPast
                    ? 'text-white/40 text-2xl font-medium opacity-50 -translate-x-1'
                    : 'text-white/50 text-2xl font-medium opacity-60'
            }
            ${text === '' ? 'h-8' : 'py-1'}
        `}
    >
        {isActive && text ? (
            <span className="inline-block">
                {text.split(' ').map((word, i) => (
                    <span key={i} className="inline-block mr-3">
                        <span className="text-white">{word.slice(0, Math.ceil(word.length * 0.6))}</span>
                        <span className="text-white/60">{word.slice(Math.ceil(word.length * 0.6))}</span>
                    </span>
                ))}
            </span>
        ) : (
            text || '\u00A0'
        )}
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

    // Handle ESC key to close
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';

            // Trigger color extraction if already loaded
            if (currentTrack?.cover_image) {
                extractColors(currentTrack.cover_image);
            }
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown, currentTrack]);

    const extractColors = (imageUrl: string) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = imageUrl;

        img.onload = () => {
            try {
                const colorThief = new ColorThief();
                // Get 10 colors for a much wider pool to pick from
                const palette = colorThief.getPalette(img, 10);

                if (palette && palette.length >= 2) {
                    // Helper to get brightness (perceived luminance)
                    const getLuminance = (rgb: number[]) => (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]);

                    // Find the darkest color in the palette for deep contrast
                    const darkestColor = [...palette].sort((a, b) => getLuminance(a) - getLuminance(b))[0];

                    // Pick distinct colors from the range to ensure variety
                    // 0 = Dominant
                    // 4 = Mid-range distinct
                    // 9 (or last) = Least dominant / accent
                    const c1 = palette[0];
                    const c2 = palette[4] || palette[1];
                    const c3 = palette[8] || palette[2];
                    const cDark = darkestColor || [0, 0, 0];

                    // Shadow Layer: Uses the darkest extracted color for a deep, grounded shadow
                    const shadowStyle = {
                        background: `rgb(${cDark[0]}, ${cDark[1]}, ${cDark[2]})`
                    };

                    // Solid Layer: "Liquid" Mesh Gradient with high variance
                    // We mix the Dominant, Distant, and Darkest colors
                    const solidStyle = {
                        background: `
                            radial-gradient(at 0% 0%, rgba(${c2[0]},${c2[1]},${c2[2]},1) 0px, transparent 50%),
                            radial-gradient(at 100% 0%, rgba(${cDark[0]},${cDark[1]},${cDark[2]},1) 0px, transparent 50%),
                            radial-gradient(at 100% 100%, rgba(${c3[0]},${c3[1]},${c3[2]},1) 0px, transparent 50%),
                            radial-gradient(at 0% 100%, rgba(${c1[0]},${c1[1]},${c1[2]},1) 0px, transparent 50%),
                            linear-gradient(to right, rgba(${cDark[0]},${cDark[1]},${cDark[2]},1), rgba(${c1[0]},${c1[1]},${c1[2]},1))
                        `
                    };

                    setLayerStyles({ solid: solidStyle, shadow: shadowStyle });
                }
            } catch (e) {
                console.error("Color extraction error:", e);
                setLayerStyles({ solid: {}, shadow: {} });
            }
        };
    };

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

    if (!isOpen || !currentTrack) return null;

    return (
        <div
            className={`
                fixed inset-0 z-[100]
                fullscreen-view-container
                ${isOpen ? 'fullscreen-view-enter' : 'fullscreen-view-exit'}
            `}
            role="dialog"
            aria-modal="true"
            aria-label="Full screen player"
        >
            {/* Main Background Image - Single Instance */}
            {/* We apply the dynamic gradient here as the base background */}
            <div
                className="absolute inset-0 z-0 flex items-center justify-start bg-[#0a0a0f] transition-all duration-1000 ease-in-out"
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

            {/* Right Panel Overlay - Contains the Dual-Layer Curve Effect */}
            {/* We use a container for the mask so it doesn't clip the lyrics if they are outside */}
            <div
                className="absolute right-0 top-0 bottom-0 fullscreen-acrylic-panel z-10 pointer-events-none"
                style={{ width: `${GRADIENT_WIDTH_PERCENT}%` }}
            >
                {/* Layer 1: The Shadow/Blur Layer (Underneath) */}
                <div
                    className="absolute inset-0 transition-all duration-1000 ease-in-out"
                    style={{
                        ...layerStyles.shadow,
                        filter: 'blur(30px) brightness(0.6)', // Increased blur for better shadow effect
                        transform: 'scale(1.02)', // Slightly larger to peek out
                        zIndex: 0
                    }}
                />

                {/* Layer 2: The Solid Layer (Top) */}
                <div
                    className="absolute inset-0 transition-all duration-1000 ease-in-out"
                    style={{
                        ...layerStyles.solid,
                        zIndex: 1
                    }}
                />
            </div>

            {/* Lyrics Container - SEPARATED from the mask and absolutely positioned */}
            {/* pointer-events-auto to allow scrolling interaction */}
            <div
                className="absolute right-0 top-0 bottom-0 z-20 flex flex-col justify-center pr-20 py-20 pointer-events-auto"
                style={{
                    left: `${LYRICS_X_OFFSET}px`, // Start container at the offset
                    pointerEvents: 'none' // Let clicks pass through empty areas
                }}
            >
                <div className="absolute top-6 right-6 z-50 pointer-events-auto">
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

                {/* Added pl-8 to prevent clipping from negative transforms */}
                <div className="lyrics-container overflow-y-auto max-h-[65vh] space-y-3 pl-8 pr-4 pointer-events-auto w-full">
                    {PLACEHOLDER_LYRICS.map((lyric, index) => (
                        <LyricLine
                            key={index}
                            text={lyric.text}
                            isActive={index === activeLyricIndex}
                            isPast={index < activeLyricIndex}
                        />
                    ))}
                </div>

                {/* <div className="mt-8 text-white/30 text-sm flex items-center gap-2 pointer-events-auto">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Lyrics
                </div> */}
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
