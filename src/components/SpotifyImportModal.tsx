import { useState, useEffect, useCallback, useRef } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  SpotifyPlaylistResult,
  VerifiedSpotifyTrack,
  VerificationProgress,
  fetchSpotifyPlaylist,
  verifySpotifyTracks,
  createPlaylistFromSpotify,
  formatDuration,
  isValidSpotifyUrl,
} from "../api/spotify";
import { usePlayer } from "../context/PlayerContext";
import { useSpotifyImport } from "../context/SpotifyImportContext";

type ImportPhase =
  | "input"
  | "fetching"
  | "verifying"
  | "review"
  | "importing"
  | "complete"
  | "error";

interface SpotifyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPlaylistId?: string;
}

export const SpotifyImportModal = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  existingPlaylistId: _existingPlaylistId,
}: SpotifyImportModalProps) => {
  const { refreshPlaylists } = usePlayer();
  const spotifyImport = useSpotifyImport();

  // Use context modal state, OR prop state for backward compatibility
  const isOpen = spotifyImport.isModalOpen || propIsOpen;

  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [playlistNameInput, setPlaylistNameInput] = useState("");
  const [playlistDescription, setPlaylistDescription] = useState("");

  const [phase, setPhase] = useState<ImportPhase>("input");
  const [error, setError] = useState<string | null>(null);

  const [, setPlaylistResult] = useState<SpotifyPlaylistResult | null>(null);
  const [verifiedTracks, setVerifiedTracks] = useState<VerifiedSpotifyTrack[]>(
    [],
  );
  const [progress, setProgress] = useState<VerificationProgress | null>(null);

  const [selectedTracks, setSelectedTracks] = useState<Set<number>>(new Set());

  const [importResult, setImportResult] = useState<{
    added: number;
    skipped: number;
    errors?: string[];
  } | null>(null);

  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Sync local state from context when modal opens after being minimized
  useEffect(() => {
    if (isOpen && spotifyImport.isImporting) {
      // Restore state from context when reopening a minimized import
      setPhase(spotifyImport.phase);
      setProgress(spotifyImport.progress);
      setVerifiedTracks(spotifyImport.verifiedTracks);
      setSelectedTracks(spotifyImport.selectedTracks);
      setPlaylistNameInput(spotifyImport.playlistName);
      setError(spotifyImport.error);
      setImportResult(spotifyImport.importResult);
    }
  }, [isOpen, spotifyImport.isImporting]);

  // Listen for verification progress events
  useEffect(() => {
    if (!isOpen && !spotifyImport.isMinimized) return;

    const setupListener = async () => {
      unlistenRef.current = await listen<VerificationProgress>(
        "spotify-import-progress",
        (event) => {
          setProgress(event.payload);
          spotifyImport.updateProgress(event.payload);
        },
      );
    };

    setupListener();

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, [isOpen, spotifyImport]);

  // Reset state when modal closes (but not if minimized)
  useEffect(() => {
    if (!isOpen && !spotifyImport.isMinimized && !spotifyImport.isImporting) {
      const timer = setTimeout(() => {
        setPhase("input");
        setSpotifyUrl("");
        setPlaylistNameInput("");
        setPlaylistDescription("");
        setError(null);
        setPlaylistResult(null);
        setVerifiedTracks([]);
        setProgress(null);
        setSelectedTracks(new Set());
        setImportResult(null);
        spotifyImport.reset();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, spotifyImport]);

  const handleFetchPlaylist = useCallback(async () => {
    if (!spotifyUrl.trim()) return;

    // Check if another import is in progress
    if (!spotifyImport.canStartNewImport) {
      setError(
        "Another import is already in progress. Please wait for it to complete.",
      );
      return;
    }

    setPhase("fetching");
    spotifyImport.setPhase("fetching");
    spotifyImport.openModal();
    setError(null);

    try {
      const result = await fetchSpotifyPlaylist(spotifyUrl.trim());
      setPlaylistResult(result);

      if (!playlistNameInput) {
        setPlaylistNameInput(result.info.name);
        spotifyImport.setPlaylistName(result.info.name);
      }
      if (!playlistDescription && result.info.description) {
        setPlaylistDescription(result.info.description);
      }

      setPhase("verifying");
      spotifyImport.setPhase("verifying");

      const verified = await verifySpotifyTracks(result.tracks);
      setVerifiedTracks(verified);
      spotifyImport.setVerifiedTracks(verified);

      const foundIndices = new Set<number>();
      verified.forEach((t, i) => {
        if (t.found) foundIndices.add(i);
      });
      setSelectedTracks(foundIndices);
      spotifyImport.setSelectedTracks(foundIndices);

      setPhase("review");
      spotifyImport.setPhase("review");
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      spotifyImport.setError(errorMsg);
      setPhase("error");
    }
  }, [spotifyUrl, playlistNameInput, playlistDescription, spotifyImport]);

  const handleImport = useCallback(async () => {
    if (selectedTracks.size === 0) return;

    setPhase("importing");
    spotifyImport.setPhase("importing");
    setError(null);

    try {
      const tracksToImport = verifiedTracks.filter((_, i) =>
        selectedTracks.has(i),
      );

      const result = await createPlaylistFromSpotify(
        playlistNameInput || "Spotify Import",
        playlistDescription || undefined,
        tracksToImport,
      );

      const importRes = {
        added: result.tracks_added,
        skipped: result.tracks_skipped,
        errors: result.errors,
      };

      setImportResult(importRes);
      spotifyImport.setImportResult(importRes);

      await refreshPlaylists();
      setPhase("complete");
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(errorMsg);
      spotifyImport.setError(errorMsg);
      setPhase("error");
    }
  }, [
    selectedTracks,
    verifiedTracks,
    playlistNameInput,
    playlistDescription,
    refreshPlaylists,
    spotifyImport,
  ]);

  const handleToggleTrack = (index: number) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      spotifyImport.setSelectedTracks(next);
      return next;
    });
  };

  const handleSelectAll = () => {
    const allFound = new Set<number>();
    verifiedTracks.forEach((t, i) => {
      if (t.found) allFound.add(i);
    });
    setSelectedTracks(allFound);
    spotifyImport.setSelectedTracks(allFound);
  };

  const handleSelectNone = () => {
    setSelectedTracks(new Set());
    spotifyImport.setSelectedTracks(new Set());
  };

  const isUrlValid = isValidSpotifyUrl(spotifyUrl);
  const foundCount = verifiedTracks.filter((t) => t.found).length;
  const notFoundCount = verifiedTracks.length - foundCount;

  // Determine if we're in an active import phase
  const isActivePhase =
    phase === "fetching" || phase === "verifying" || phase === "importing";

  const handleClose = () => {
    if (isActivePhase) {
      // Minimize instead of close during active phases
      spotifyImport.setPlaylistName(playlistNameInput || "Spotify Import");
      spotifyImport.minimize();
    } else {
      spotifyImport.closeModal();
    }
    propOnClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-theme-secondary rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-theme-primary pt-[3px]">
                Import from Spotify
              </h2>
              <p className="text-sm text-theme-secondary">
                {phase === "input" && "Paste a Spotify playlist URL to import"}
                {phase === "fetching" && "Fetching playlist..."}
                {phase === "verifying" && "Verifying tracks on Tidal..."}
                {phase === "review" &&
                  `${foundCount} of ${verifiedTracks.length} tracks available`}
                {phase === "importing" && "Adding tracks to playlist..."}
                {phase === "complete" && "Import complete!"}
                {phase === "error" && "Something went wrong"}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="text-theme-muted hover:text-theme-primary transition-colors p-2 rounded-lg hover:bg-theme-surface group relative"
            title={isActivePhase ? "Minimize to background" : "Close"}
          >
            {isActivePhase ? (
              // Minimize icon during active phase
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14" />
              </svg>
            ) : (
              // Close icon for other phases
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Input Phase */}
          {phase === "input" && (
            <div className="space-y-6">
              {/* Check if another import is running */}
              {!spotifyImport.canStartNewImport && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <svg
                    className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-red-500">
                      Import in Progress
                    </p>
                    <p className="text-sm text-red-500/80 mt-1">
                      Another Spotify import is already running. Please wait for
                      it to complete before starting a new one.
                    </p>
                  </div>
                </div>
              )}

              {/* Warning Banner */}
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <svg
                  className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-500">
                    This may take a while
                  </p>
                  <p className="text-sm text-amber-500/80 mt-1">
                    Each track will be verified against Tidal's catalog. Large
                    playlists may take several minutes to process. You can
                    minimize this window and it will continue in the background.
                  </p>
                </div>
              </div>

              {/* URL Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-theme-secondary uppercase tracking-wider">
                  Spotify Playlist URL
                </label>
                <input
                  type="text"
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  placeholder="https://open.spotify.com/playlist/..."
                  className="w-full px-4 pt-[14px] pb-[10px] bg-theme-surface border border-transparent rounded-xl text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-green-500/40 transition-all"
                  autoFocus
                  disabled={!spotifyImport.canStartNewImport}
                />
                {spotifyUrl && !isUrlValid && (
                  <p className="text-sm text-red-400">
                    Please enter a valid Spotify playlist URL
                  </p>
                )}
              </div>

              {/* Playlist Name */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-theme-secondary uppercase tracking-wider">
                  Playlist Name
                </label>
                <input
                  type="text"
                  value={playlistNameInput}
                  onChange={(e) => setPlaylistNameInput(e.target.value)}
                  placeholder="Will use Spotify playlist name if empty"
                  className="w-full px-4 pt-[14px] pb-[10px] bg-theme-surface border border-transparent rounded-xl text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-green-500/40 transition-all"
                  disabled={!spotifyImport.canStartNewImport}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-theme-secondary uppercase tracking-wider">
                  Description (Optional)
                </label>
                <textarea
                  value={playlistDescription}
                  onChange={(e) => setPlaylistDescription(e.target.value)}
                  placeholder="Add an optional description..."
                  className="w-full px-4 py-3 bg-theme-surface border border-transparent rounded-xl text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-green-500/40 transition-all resize-none h-20"
                  disabled={!spotifyImport.canStartNewImport}
                />
              </div>
            </div>
          )}

          {/* Fetching Phase */}
          {phase === "fetching" && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full border-4 border-green-500/20 border-t-green-500 animate-spin" />
              <p className="mt-6 text-theme-secondary">
                Fetching playlist from Spotify...
              </p>
              <p className="mt-2 text-sm text-theme-muted">
                You can minimize this window - import will continue in
                background
              </p>
            </div>
          )}

          {/* Verifying Phase */}
          {phase === "verifying" && progress && (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full border-4 border-green-500/20 border-t-green-500 animate-spin" />
                <p className="mt-6 text-theme-primary font-medium">
                  Verifying track {progress.current} of {progress.total}
                </p>
                <p className="text-sm text-theme-secondary mt-2 truncate max-w-md text-center">
                  {progress.current_track}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-2 bg-theme-surface-active rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-theme-accent transition-all duration-300"
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-theme-secondary">
                  <span>
                    {Math.round((progress.current / progress.total) * 100)}%
                    complete
                  </span>
                  <span>{progress.found_count} tracks found so far</span>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-center justify-center gap-2 text-sm text-theme-muted mt-12">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 15v.01M12 9v2" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
                <span className="pt-[4.5px]">
                  You can minimize this window - import will continue
                </span>
              </div>
            </div>
          )}

          {/* Review Phase */}
          {phase === "review" && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium pt-[5px]">
                    {foundCount} found
                  </span>
                  {notFoundCount > 0 && (
                    <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium pt-[5px]">
                      {notFoundCount} not found
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 text-xs font-medium text-theme-secondary hover:text-theme-primary hover:bg-theme-surface rounded-lg transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleSelectNone}
                    className="px-3 py-1.5 text-xs font-medium text-theme-secondary hover:text-theme-primary hover:bg-theme-surface rounded-lg transition-colors"
                  >
                    Select None
                  </button>
                </div>
              </div>

              {/* Track List */}
              <div className="rounded-xl overflow-hidden bg-theme-surface">
                <div className="max-h-80 overflow-y-auto themed-scrollbar">
                  {verifiedTracks.map((track, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 border-b border-white/5 last:border-b-0 ${
                        track.found
                          ? "hover:bg-theme-surface-hover cursor-pointer"
                          : "opacity-50"
                      }`}
                      onClick={() => track.found && handleToggleTrack(index)}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                          selectedTracks.has(index)
                            ? "bg-theme-accent border-theme-accent"
                            : track.found
                              ? "border-white/10 group-hover:border-white/20"
                              : "border-white/5"
                        }`}
                      >
                        {selectedTracks.has(index) && (
                          <svg
                            className="w-3 h-3 text-white"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Cover */}
                      {track.cover_url ? (
                        <img
                          src={track.cover_url}
                          alt=""
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-theme-surface flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-theme-muted"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                          </svg>
                        </div>
                      )}

                      {/* Track Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-theme-primary truncate">
                          {track.spotify.title}
                        </p>
                        <p className="text-xs text-theme-secondary truncate">
                          {track.spotify.artist}
                          {track.spotify.album && ` • ${track.spotify.album}`}
                        </p>
                      </div>

                      {/* Duration */}
                      <span className="text-xs text-theme-muted flex-shrink-0 mt-1">
                        {formatDuration(track.spotify.duration_ms)}
                      </span>

                      {/* Status */}
                      <div className="flex-shrink-0">
                        {track.found ? (
                          <div className="flex items-center gap-1">
                            <svg
                              className="w-4 h-4 text-green-500"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                            {track.used_romanization && (
                              <span
                                className="text-xs text-theme-muted"
                                title="Found via romanization"
                              >
                                🗾
                              </span>
                            )}
                          </div>
                        ) : (
                          <svg
                            className="w-4 h-4 text-red-500"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Importing Phase */}
          {phase === "importing" && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full border-4 border-green-500/20 border-t-green-500 animate-spin" />
              <p className="mt-6 text-theme-secondary">
                Adding tracks to your library...
              </p>
              <p className="mt-2 text-sm text-theme-muted">
                You can minimize this window - import will continue in
                background
              </p>
            </div>
          )}

          {/* Complete Phase */}
          {phase === "complete" && importResult && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-green-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-theme-primary">
                Import Complete!
              </h3>
              <p className="mt-2 text-theme-secondary">
                Successfully added {importResult.added} tracks to "
                {playlistNameInput}"
              </p>
              {importResult.skipped > 0 && (
                <p className="text-sm text-theme-muted mt-1">
                  {importResult.skipped} tracks were skipped (not found on
                  Tidal)
                </p>
              )}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg max-w-md">
                  <p className="text-sm text-red-400 font-medium mb-2">
                    Some tracks had errors:
                  </p>
                  <ul className="text-xs text-red-400/80 space-y-1 max-h-24 overflow-y-auto">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>...and {importResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Error Phase */}
          {phase === "error" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-red-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-theme-primary">
                Something went wrong
              </h3>
              <p className="mt-2 text-theme-secondary text-center max-w-md">
                {error || "An unexpected error occurred"}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3 flex-shrink-0 bg-theme-secondary">
          {phase === "input" && (
            <>
              <button
                onClick={handleClose}
                className="px-5 py-2.5 pt-[11px] rounded-xl text-sm font-semibold text-theme-secondary hover:text-theme-primary hover:bg-theme-surface transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleFetchPlaylist}
                disabled={!isUrlValid || !spotifyImport.canStartNewImport}
                className="px-6 py-2.5 pt-[12.5px] rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-500/20 transition-all hover:scale-105 active:scale-95"
              >
                Fetch Playlist
              </button>
            </>
          )}

          {(phase === "fetching" ||
            phase === "verifying" ||
            phase === "importing") && (
            <button
              onClick={handleClose}
              className="px-5 py-2.5 pt-[11px] rounded-xl text-sm font-semibold text-theme-secondary hover:text-theme-primary hover:bg-theme-surface transition-all flex items-center gap-2"
            >
              {/* <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14" />
              </svg> */}
              <span className="pt-[2.6px]">Minimize to Background</span>
            </button>
          )}

          {phase === "review" && (
            <>
              <button
                onClick={() => setPhase("input")}
                className="px-5 py-2.5 pt-[12.5px] rounded-xl text-sm font-semibold text-theme-secondary hover:text-theme-primary hover:bg-theme-surface transition-all"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={selectedTracks.size === 0}
                className="px-6 py-2.5 pt-[11px] rounded-xl text-sm font-semibold bg-theme-accent hover:brightness-110 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all hover:scale-105 active:scale-95"
              >
                Import {selectedTracks.size} Tracks
              </button>
            </>
          )}

          {(phase === "complete" || phase === "error") && (
            <button
              onClick={handleClose}
              className="px-6 py-2.5 pt-[12.5px] rounded-xl text-sm font-semibold bg-theme-accent hover:brightness-110 text-white shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
