import { useRef } from "react";
import { UnifiedTrack } from "../../api/library";
import { ImageWithFallback } from "./ImageWithFallback";

interface TrackCarouselProps {
  title: string;
  tracks: UnifiedTrack[];
  onPlay: (track: UnifiedTrack) => void;
  onContextMenu: (e: React.MouseEvent, track: UnifiedTrack) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

export const TrackCarousel = ({
  title,
  tracks,
  onPlay,
  onContextMenu,
  currentTrackId,
  isPlaying,
}: TrackCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 mb-8">
      {/* Header with Title and Navigation */}
      <div className="flex items-center justify-between px-6 md:px-8">
        <h2 className="text-2xl font-bold text-theme-primary tracking-tight">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleScroll("left")}
            className="w-8 h-8 rounded-full bg-theme-surface hover:bg-theme-secondary text-theme-primary flex items-center justify-center transition-colors shadow-sm ring-1 ring-white/5"
            aria-label="Scroll left"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={() => handleScroll("right")}
            className="w-8 h-8 rounded-full bg-theme-surface hover:bg-theme-secondary text-theme-primary flex items-center justify-center transition-colors shadow-sm ring-1 ring-white/5"
            aria-label="Scroll right"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable List */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto gap-6 scroll-smooth scrollbar-hide snap-xSnap-mandatory px-6 md:px-8 pb-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {tracks.map((track) => {
          const isCurrent = currentTrackId === track.id;
          const isTrackPlaying = isCurrent && isPlaying;

          return (
            <div
              key={track.id}
              className="flex-none w-[180px] md:w-[200px] lg:w-[220px] snap-start group cursor-pointer"
              onClick={() => onPlay(track)}
              onContextMenu={(e) => onContextMenu(e, track)}
            >
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-1 mb-3 bg-theme-surface">
                <ImageWithFallback
                  src={track.cover_image}
                  alt={track.title}
                  className="w-full h-full object-cover"
                  iconType="music"
                />

                {/* Overlay */}
                <div
                  className={`absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center ${isTrackPlaying ? "bg-black/40" : "opacity-0 group-hover:opacity-100"}`}
                >
                  <div
                    className={`w-12 h-12 rounded-full bg-theme-accent text-white flex items-center justify-center shadow-2xl transform transition-all duration-300 ${isTrackPlaying ? "scale-100" : "translate-y-4 group-hover:translate-y-0 group-hover:scale-100"}`}
                  >
                    {isTrackPlaying ? (
                      <div className="flex items-end gap-[3px] h-4 mb-1">
                        <span className="w-[3px] bg-white rounded-full animate-music-bar-1 h-3" />
                        <span className="w-[3px] bg-white rounded-full animate-music-bar-2 h-4" />
                        <span className="w-[3px] bg-white rounded-full animate-music-bar-3 h-2" />
                      </div>
                    ) : (
                      <svg
                        className="w-6 h-6 ml-1"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-1">
                <h3
                  className={`font-semibold truncate text-base mb-1 transition-colors ${isCurrent ? "text-theme-accent" : "text-theme-primary group-hover:text-white"}`}
                >
                  {track.title}
                </h3>
                <p className="text-sm text-theme-muted truncate group-hover:text-theme-secondary transition-colors">
                  {track.artist}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
