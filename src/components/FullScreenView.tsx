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
    { time: 5, text: "Loading lyrics..." },
    { time: 10, text: "Of my soul" },
    { time: 15, text: "Suffering, I've been low," },
    { time: 20, text: "then I seen your halo" },
    { time: 25, text: "" },
    { time: 30, text: "Oh, oh-oh, oh" },
    { time: 35, text: "" },
    { time: 40, text: "Falling, angels call my name" },
    { time: 45, text: "But the things you say" },
    { time: 50, text: "Keep me holding on" },
    { time: 55, text: "" },
    { time: 60, text: "Where do we go from here?" },
    { time: 65, text: "The path is never clear" },
    { time: 70, text: "But I know you're near" },
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
                // Get 5 colors for a richer mix
                const palette = colorThief.getPalette(img, 5);

                if (palette && palette.length >= 2) {
                    const c1 = palette[0];
                    const c2 = palette[1] || c1;
                    const c3 = palette[2] || c1;
                    const c4 = palette[3] || c2;
                    const c5 = palette[4] || c3;

                    // Shadow Layer: deeply blurred dominant color
                    const shadowStyle = {
                        background: `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`
                    };

                    // Solid Layer: "Liquid" Mesh Gradient
                    // Mix multiple radial gradients to create a complex, organic look
                    const solidStyle = {
                        background: `
                            radial-gradient(at 0% 0%, rgba(${c2[0]},${c2[1]},${c2[2]},1) 0px, transparent 50%),
                            radial-gradient(at 100% 0%, rgba(${c3[0]},${c3[1]},${c3[2]},1) 0px, transparent 50%),
                            radial-gradient(at 100% 100%, rgba(${c4[0]},${c4[1]},${c4[2]},1) 0px, transparent 50%),
                            radial-gradient(at 0% 100%, rgba(${c5[0]},${c5[1]},${c5[2]},1) 0px, transparent 50%),
                            linear-gradient(to right, rgba(${c1[0]},${c1[1]},${c1[2]},1), rgba(${c2[0]},${c2[1]},${c2[2]},1))
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
            <div className="absolute inset-0 z-0 flex items-center justify-start bg-[#0a0a0f]">
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
