import { useState } from "react";
import { Modal } from "./Modal";
import { usePlayer } from "../context/PlayerContext";
import { SpotifyImportModal } from "./SpotifyImportModal";

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreatePlaylistModal = ({
  isOpen,
  onClose,
}: CreatePlaylistModalProps) => {
  const { createPlaylist } = usePlayer();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSpotifyImport, setShowSpotifyImport] = useState(false);

  // Reset form when opening
  if (!isOpen && (name || description)) {
    setName("");
    setDescription("");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      setIsLoading(true);
      try {
        await createPlaylist(name.trim(), description.trim());
        setName("");
        setDescription("");
        onClose();
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSpotifyImportClose = () => {
    setShowSpotifyImport(false);
    onClose();
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="New Playlist">
        <div className="relative">
          {/* Decorative background element */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 relative z-10"
          >
            <div className="flex gap-4">
              {/* Placeholder Cover Art */}
              <div className="w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-white/5 flex items-center justify-center flex-shrink-0 shadow-inner">
                <svg
                  className="w-10 h-10 text-white/20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>

              <div className="flex-1 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-white/60 uppercase tracking-wider pl-1">
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="My Playlist #1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 pt-[14px] pb-[10px] bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:bg-white/10 focus:border-indigo-500/50 transition-all font-medium"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-white/60 uppercase tracking-wider pl-1">
                Description
              </label>
              <textarea
                placeholder="Add an optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:bg-white/10 focus:border-indigo-500/50 transition-all min-h-[80px] resize-none text-sm leading-relaxed"
              />
            </div>

            {/* Import from Spotify Option */}
            <div className="border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setShowSpotifyImport(true)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-green-600/20 to-green-500/10 border border-green-500/30 rounded-xl hover:bg-green-500/20 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-white"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-white group-hover:text-green-400 transition-colors pt-[3px]">
                    Import from Spotify
                  </p>
                  <p className="text-xs text-white/50">
                    Import an existing Spotify playlist
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-white/40 group-hover:text-green-400 group-hover:translate-x-1 transition-all"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isLoading}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
              >
                {isLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Spotify Import Modal */}
      <SpotifyImportModal
        isOpen={showSpotifyImport}
        onClose={handleSpotifyImportClose}
      />
    </>
  );
};
