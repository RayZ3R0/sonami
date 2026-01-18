import { useSpotifyImport } from "../context/SpotifyImportContext";
import { usePlayer } from "../context/PlayerContext";

export const SpotifyImportIndicator = () => {
    const { isImporting, isMinimized, phase, progress, playlistName, maximize } =
        useSpotifyImport();
    const { isQueueOpen, isSettingsOpen, playerBarStyle } = usePlayer();

    
    const isActivePhase = phase === "fetching" || phase === "verifying" || phase === "importing";
    const isReviewPhase = phase === "review";
    const shouldShow = isMinimized && (isImporting || isActivePhase || isReviewPhase);

    if (!shouldShow) return null;

    const progressPercent = progress
        ? Math.round((progress.current / progress.total) * 100)
        : 0;

    const getStatusText = () => {
        switch (phase) {
            case "fetching":
                return "Fetching...";
            case "verifying":
                return `${progressPercent}%`;
            case "importing":
                return "Importing...";
            case "review":
                return "Ready";
            default:
                return "";
        }
    };

    
    
    let rightPosition = "24px";
    if (isSettingsOpen) {
        rightPosition = "525px"; 
    } else if (isQueueOpen) {
        rightPosition = "340px"; 
    }

    
    
    let bottomPosition = "24px";
    if (isSettingsOpen) {
        bottomPosition = "120px"; 
    } else if (playerBarStyle === "classic") {
        bottomPosition = "120px"; 
    }

    return (
        <button
            onClick={maximize}
            className={`
        fixed z-[100] flex items-center justify-center
        transition-all duration-300 ease-out
        animate-spotify-indicator-enter
        group
      `}
            style={{
                bottom: bottomPosition,
                right: rightPosition,
                width: "56px",
                height: "56px",
            }}
            title={isReviewPhase ? `Ready to import: ${playlistName}` : `Importing: ${playlistName}`}
        >
            {/* Background circle with gradient */}
            <div
                className={`
          absolute inset-0 rounded-full
          ${isReviewPhase
                        ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30"
                        : "bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/30"
                    }
          transition-transform duration-200
          group-hover:scale-110
          ${isActivePhase ? "animate-spotify-indicator-pulse" : ""}
        `}
            />

            {/* Progress ring - for verifying phase */}
            {phase === "verifying" && progress && (
                <svg
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox="0 0 56 56"
                >
                    {/* Background track */}
                    <circle
                        cx="28"
                        cy="28"
                        r="25"
                        fill="none"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="3"
                    />
                    {/* Progress arc */}
                    <circle
                        cx="28"
                        cy="28"
                        r="25"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 25}`}
                        strokeDashoffset={`${2 * Math.PI * 25 * (1 - progressPercent / 100)}`}
                        className="transition-all duration-300"
                    />
                </svg>
            )}

            {/* Complete ring for review phase */}
            {isReviewPhase && (
                <svg
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox="0 0 56 56"
                >
                    <circle
                        cx="28"
                        cy="28"
                        r="25"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                </svg>
            )}

            {/* Icon or status */}
            <div className="relative z-10 flex items-center justify-center">
                {phase === "verifying" ? (
                    <span className="text-white text-xs font-bold pl-[2px] pt-[2px]">
                        {getStatusText()}
                    </span>
                ) : isReviewPhase ? (
                    
                    <svg
                        className="w-6 h-6 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    <div className="relative">
                        <svg
                            className="w-6 h-6 text-white"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                        {/* Spinning indicator for fetching/importing */}
                        {(phase === "fetching" || phase === "importing") && (
                            <div className="absolute -inset-1 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                    </div>
                )}
            </div>

            {/* Tooltip on hover */}
            <div
                className={`
          absolute bottom-full mb-2 left-1/2 -translate-x-1/2
          px-3 py-1.5 rounded-lg
          bg-theme-surface text-theme-primary text-xs font-medium
          whitespace-nowrap shadow-lg
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          pointer-events-none
        `}
            >
                <span className="pt-[2px]">{isReviewPhase ? "Ready to import" : playlistName || "Spotify Import"}</span>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-theme-surface" />
            </div>
        </button>
    );
};
