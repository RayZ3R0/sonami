import React from "react";
import { LibraryAlbum, LibraryArtist } from "../../api/library";

interface AlbumGridProps {
  items: LibraryAlbum[];
}

interface ArtistGridProps {
  items: LibraryArtist[];
}

export const AlbumGrid: React.FC<AlbumGridProps> = ({ items }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {items.map((album) => (
        <div key={album.id} className="group cursor-pointer">
          <div className="aspect-square w-full rounded-lg shadow-lg mb-3 bg-theme-secondary relative overflow-hidden transition-transform group-hover:scale-[1.02]">
            {album.cover_image ? (
              <img
                src={album.cover_image}
                className="w-full h-full object-cover"
                alt={album.title}
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-theme-secondary text-theme-muted">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {/* Play button could go here */}
            </div>
          </div>
          <h3 className="font-semibold truncate text-[15px] text-theme-primary group-hover:underline">
            {album.title}
          </h3>
          <p className="text-sm text-theme-muted truncate">{album.artist}</p>
        </div>
      ))}
    </div>
  );
};

export const ArtistGrid: React.FC<ArtistGridProps> = ({ items }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {items.map((artist) => (
        <div key={artist.id} className="group cursor-pointer text-center">
          <div className="aspect-square w-full rounded-full shadow-lg mb-3 bg-theme-secondary relative overflow-hidden transition-transform group-hover:scale-[1.02] mx-auto">
            {artist.cover_image ? (
              <img
                src={artist.cover_image}
                className="w-full h-full object-cover"
                alt={artist.name}
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-theme-secondary text-theme-muted">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
          </div>
          <h3 className="font-semibold truncate text-[15px] text-theme-primary group-hover:underline">
            {artist.name}
          </h3>
        </div>
      ))}
    </div>
  );
};
