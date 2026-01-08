import { useEffect, useRef, useState, useCallback, memo } from "react";
import { Spring, Spline } from "../utils/Spring";

export interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsData {
  synced: boolean;
  lines: LyricLine[];
  source: string;
}

interface SyncedLyricsProps {
  lyrics: LyricsData | null;
  currentTime: number;
  isPlaying: boolean;
}

// Timing offset to sync lyrics better (negative = lyrics appear earlier)
const LYRICS_TIMING_OFFSET = -0.3;

interface LineAnimationState {
  scale: Spring;
  yOffset: Spring;
  opacity: Spring;
  glow: Spring;
  lastState: "past" | "active" | "future";
}

// Smoother animation curves for better visual experience
const SCALE_CURVE = new Spline(
  [0, 0.5, 1],
  [0.95, 1.0, 1.0]
);

const Y_OFFSET_CURVE = new Spline(
  [0, 0.5, 1],
  [0.01, 0, 0]
);

const OPACITY_CURVE = new Spline(
  [0, 0.3, 1],
  [0.35, 0.7, 1.0]
);

const GLOW_CURVE = new Spline(
  [0, 0.5, 1],
  [0, 0.6, 1.0]
);

// Smoother spring config to prevent jitter
const SMOOTH_CONFIG = {
  stiffness: 150,
  damping: 28,
  mass: 1,
  precision: 0.001
};

export const SyncedLyrics = memo(({ lyrics, currentTime, isPlaying }: SyncedLyricsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [animationStates, setAnimationStates] = useState<Map<number, LineAnimationState>>(new Map());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(performance.now());
  const lastScrollTargetRef = useRef<number>(-1);
  const scrollSpring = useRef(new Spring(0, { stiffness: 120, damping: 30, mass: 1, precision: 0.5 }));

  // Initialize animation states for each line
  useEffect(() => {
    if (!lyrics?.lines) return;

    const newStates = new Map<number, LineAnimationState>();
    lyrics.lines.forEach((_, index) => {
      newStates.set(index, {
        scale: new Spring(0.95, SMOOTH_CONFIG),
        yOffset: new Spring(0.01, SMOOTH_CONFIG),
        opacity: new Spring(0.35, SMOOTH_CONFIG),
        glow: new Spring(0, SMOOTH_CONFIG),
        lastState: "future",
      });
    });
    setAnimationStates(newStates);
  }, [lyrics]);

  // Get the state of a line relative to current time
  const getLineState = useCallback((lineIndex: number): "past" | "active" | "future" => {
    if (!lyrics?.lines || !lyrics.synced) return "future";

    const line = lyrics.lines[lineIndex];
    const nextLine = lyrics.lines[lineIndex + 1];
    const adjustedTime = currentTime + LYRICS_TIMING_OFFSET;

    if (adjustedTime < line.time) {
      return "future";
    } else if (nextLine && adjustedTime >= nextLine.time) {
      return "past";
    } else {
      return "active";
    }
  }, [lyrics, currentTime]);

  // Calculate animation progress for active line
  const getProgress = useCallback((lineIndex: number): number => {
    if (!lyrics?.lines || !lyrics.synced) return 0;

    const line = lyrics.lines[lineIndex];
    const nextLine = lyrics.lines[lineIndex + 1];
    const adjustedTime = currentTime + LYRICS_TIMING_OFFSET;

    if (!nextLine) return 1;

    const duration = nextLine.time - line.time;
    const elapsed = adjustedTime - line.time;
    return Math.max(0, Math.min(1, elapsed / duration));
  }, [lyrics, currentTime]);

  // Smooth scroll to active line with spring physics
  const scrollToActiveLine = useCallback((activeIndex: number, deltaTime: number) => {
    if (!containerRef.current) return;

    const lineElement = lineRefs.current.get(activeIndex);
    if (!lineElement) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const lineRect = lineElement.getBoundingClientRect();

    // Calculate target scroll position (center the active line)
    const targetScroll = lineRect.top - containerRect.top + container.scrollTop - containerRect.height / 2 + lineRect.height / 2;

    // Only update spring goal if target changed significantly
    if (lastScrollTargetRef.current !== activeIndex) {
      scrollSpring.current.setGoal(targetScroll);
      lastScrollTargetRef.current = activeIndex;
    }

    // Step the spring and apply
    const currentScroll = scrollSpring.current.step(deltaTime);
    container.scrollTop = currentScroll;
  }, []);

  // Animation loop
  useEffect(() => {
    if (!lyrics?.lines) return;

    const animate = () => {
      const now = performance.now();
      const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 0.05); // Cap at 50ms to prevent large jumps
      lastTimeRef.current = now;

      let activeIndex = -1;

      lyrics.lines.forEach((_, index) => {
        const state = getLineState(index);
        const animState = animationStates.get(index);
        if (!animState) return;

        const lineElement = lineRefs.current.get(index);
        if (!lineElement) return;

        // Detect state changes
        const stateChanged = animState.lastState !== state;
        if (stateChanged) {
          animState.lastState = state;
        }

        let targetScale: number;
        let targetYOffset: number;
        let targetOpacity: number;
        let targetGlow: number;
        let useInstantTransition = false;

        if (state === "active") {
          activeIndex = index;
          const progress = getProgress(index);
          
          targetScale = SCALE_CURVE.at(progress);
          targetYOffset = Y_OFFSET_CURVE.at(progress);
          targetOpacity = OPACITY_CURVE.at(progress);
          targetGlow = GLOW_CURVE.at(progress);
        } else if (state === "past") {
          targetScale = 0.92;
          targetYOffset = 0;
          targetOpacity = 0.3;
          targetGlow = 0;
          // Instant transition when becoming past to prevent flickering
          useInstantTransition = stateChanged;
        } else {
          targetScale = 0.95;
          targetYOffset = 0.01;
          targetOpacity = 0.35;
          targetGlow = 0;
        }

        // Update spring goals
        animState.scale.setGoal(targetScale, useInstantTransition);
        animState.yOffset.setGoal(targetYOffset, useInstantTransition);
        animState.opacity.setGoal(targetOpacity, useInstantTransition);
        animState.glow.setGoal(targetGlow, useInstantTransition);

        // Only step animations if playing
        if (isPlaying) {
          // Step animations
          const currentScale = animState.scale.step(deltaTime);
          const currentYOffset = animState.yOffset.step(deltaTime);
          const currentOpacity = animState.opacity.step(deltaTime);
          const currentGlow = animState.glow.step(deltaTime);

          // Apply styles with CSS transforms for hardware acceleration
          lineElement.style.transform = `translateY(${currentYOffset * 12}px) scale(${currentScale})`;
          lineElement.style.opacity = `${currentOpacity}`;
          
          // Apply glow effect
          const glowIntensity = currentGlow * 100;
          const blurRadius = 4 + (currentGlow * 16);
          lineElement.style.textShadow = `0 0 ${blurRadius}px rgba(255, 255, 255, ${glowIntensity}%)`;
        }
        
        // Add active class for additional styling
        if (state === "active") {
          lineElement.classList.add("active");
        } else {
          lineElement.classList.remove("active");
        }
      });

      // Auto-scroll to active line with spring physics
      if (activeIndex >= 0) {
        scrollToActiveLine(activeIndex, deltaTime);
      }

      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [lyrics, isPlaying, currentTime, animationStates, getLineState, getProgress, scrollToActiveLine]);

  if (!lyrics) {
    return (
      <div className="flex flex-col items-center justify-center h-full opacity-50">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="mb-4 text-white/30"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        <p className="text-xl font-medium text-white/60">No lyrics available</p>
        <p className="text-sm text-white/40 mt-2">Lyrics will appear here when available</p>
      </div>
    );
  }

  if (!lyrics.synced) {
    // Static lyrics display
    return (
      <div 
        ref={containerRef}
        className="h-full overflow-y-auto px-8 py-20 lyrics-container"
      >
        <div className="max-w-3xl mx-auto space-y-6">
          {lyrics.lines.map((line, index) => (
            <div
              key={index}
              className="text-2xl font-medium text-white/80 leading-relaxed animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {line.text}
            </div>
          ))}
        </div>
        {lyrics.source && (
          <div className="text-center mt-12 text-sm text-white/30">
            Lyrics from {lyrics.source}
          </div>
        )}
      </div>
    );
  }

  // Synced lyrics display
  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto lyrics-container scroll-smooth"
      style={{
        scrollBehavior: "smooth",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255, 255, 255, 0.2) transparent",
        paddingLeft: "4rem",
        paddingRight: "4rem",
        paddingTop: "3rem",
        paddingBottom: "3rem",
      }}
    >
      <div className="max-w-3xl mx-auto">
        {/* Top spacer for centering - reduced for upward positioning */}
        <div className="h-[30vh]" />
        
        {lyrics.lines.map((line, index) => (
          <div
            key={index}
            ref={(el) => {
              if (el) lineRefs.current.set(index, el);
              else lineRefs.current.delete(index);
            }}
            className="lyric-line my-8 text-4xl font-bold text-white transition-all duration-300 ease-out will-change-transform"
            style={{
              transformOrigin: "center center",
              lineHeight: "1.4",
              letterSpacing: "-0.02em",
            }}
          >
            {line.text || "♪"}
          </div>
        ))}
        
        {/* Bottom spacer for centering - reduced for upward positioning */}
        <div className="h-[30vh]" />
        
        {lyrics.source && (
          <div className="text-center py-8 text-sm text-white/30">
            Lyrics from {lyrics.source}
          </div>
        )}
      </div>
    </div>
  );
});

SyncedLyrics.displayName = "SyncedLyrics";
