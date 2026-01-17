interface DownloadIndicatorProps {
  status?: {
    progress: number;
    status: string;
  };
  isDownloaded: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const DownloadIndicator = ({
  status,
  isDownloaded,
  onClick,
  className = "",
}: DownloadIndicatorProps) => {
  // Show checkmark if:
  // 1. Explicitly downloaded (from library data)
  // 2. Status is "complete"
  // 3. Progress is >= 99% (handles race condition where status reverts but progress stays)
  const shouldShowCheckmark =
    isDownloaded ||
    status?.status === "complete" ||
    (status && status.progress >= 0.99);

  if (shouldShowCheckmark) {
    return (
      <button
        onClick={onClick}
        className={`text-theme-accent hover:text-red-400 transition-colors -mt-1 ${className}`}
        title="Click to remove download"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </button>
    );
  }

  // Show progress circle for downloading or pending with progress > 0
  if (status?.status === "downloading" || status?.status === "pending") {
    return (
      <div
        className={`w-5 h-5 flex items-center justify-center text-theme-accent -mt-1 ${className}`}
        title={`Downloading: ${(status.progress * 100).toFixed(0)}%`}
        onClick={onClick}
      >
        <svg className="w-full h-full -rotate-90" viewBox="0 0 24 24">
          <circle
            className="text-white/10"
            strokeWidth="3"
            stroke="currentColor"
            fill="transparent"
            r="10"
            cx="12"
            cy="12"
          />
          <circle
            className="text-theme-accent transition-all duration-300 ease-out"
            strokeWidth="3"
            strokeDasharray={2 * Math.PI * 10}
            strokeDashoffset={2 * Math.PI * 10 * (1 - status.progress)}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r="10"
            cx="12"
            cy="12"
          />
        </svg>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`text-theme-muted hover:text-theme-primary transition-colors opacity-0 group-hover:opacity-100 -mt-1 ${className}`}
      title="Download"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
    </button>
  );
};
