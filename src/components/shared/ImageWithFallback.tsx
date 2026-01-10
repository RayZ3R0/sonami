import { useState } from "react";

interface ImageWithFallbackProps {
  src?: string | null;
  alt: string;
  className?: string;
  iconType?: "music" | "album" | "artist" | "playlist";
}

export const ImageWithFallback = ({
  src,
  alt,
  className = "",
  iconType = "music",
}: ImageWithFallbackProps) => {
  const [error, setError] = useState(false);

  const icons = {
    music: (
      <svg
        className="w-1/3 h-1/3 opacity-40 text-theme-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
    ),
    album: (
      <svg
        className="w-1/3 h-1/3 opacity-40 text-theme-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
        <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
      </svg>
    ),
    artist: (
      <svg
        className="w-1/3 h-1/3 opacity-40 text-theme-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
        />
        <circle cx="12" cy="7" r="4" strokeWidth={1.5} />
      </svg>
    ),
    playlist: (
      <svg
        className="w-1/3 h-1/3 opacity-40 text-theme-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
    ),
  };

  if (!src || error) {
    return (
      <div
        className={`bg-gradient-to-br from-theme-secondary to-theme-tertiary flex items-center justify-center ${className}`}
      >
        {icons[iconType] || icons.music}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className={`object-cover bg-theme-secondary ${className}`}
      loading="lazy"
    />
  );
};
