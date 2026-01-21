import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Track } from "../types";

interface DownloadProgress {
  track_id: string;
  total: number;
  downloaded: number;
  progress: number;
  status: string;
}

interface DownloadComplete {
  track_id: string;
  title: string;
  artist: string;
  album: string;
  path: string;
}

interface DownloadItem {
  trackId: string;
  title: string;
  artist: string;
  progress: number;
  status: "pending" | "downloading" | "complete" | "error";
  error?: string;
}

interface DownloadContextType {
  downloads: Map<string, DownloadItem>;
  downloadPath: string;
  isDownloading: boolean;
  isTrackCompleted: (trackId: string) => boolean;
  downloadTrack: (track: Track) => Promise<void>;
  deleteDownloadedTrack: (
    providerId: string,
    externalId: string,
  ) => Promise<void>;
  setDownloadPath: (path: string) => Promise<void>;
  openDownloadFolder: () => Promise<void>;
  refreshDownloadPath: () => Promise<void>;
}

const DownloadContext = createContext<DownloadContextType | undefined>(
  undefined,
);

export const DownloadProvider = ({ children }: { children: ReactNode }) => {
  const [downloads, setDownloads] = useState<Map<string, DownloadItem>>(
    new Map(),
  );
  const [downloadPath, setDownloadPathState] = useState<string>("");

  // Persistent set of completed track keys - survives state resets
  const completedTracksRef = useRef<Set<string>>(new Set());

  const refreshDownloadPath = useCallback(async () => {
    try {
      const path = await invoke<string>("get_download_path");
      setDownloadPathState(path);
    } catch (e) {
      console.error("Failed to get download path:", e);
    }
  }, []);

  // Initialize download path on mount
  useEffect(() => {
    refreshDownloadPath();
  }, [refreshDownloadPath]);

  // Listen for download events
  useEffect(() => {
    const unlistenProgress = listen<DownloadProgress>(
      "download-progress",
      (event) => {
        const {
          track_id: rawId,
          progress,
          status: backendStatus,
        } = event.payload;
        const track_key = String(rawId);
        // Backend key is usually provider_id:external_id OR just external_id for Tidal legacy?
        // Actually, backend now returns whatever key it uses.
        // For Tidal legacy, it might return number ID.
        // We should normalize handling.
        // But let's assume backend events send the correct ID that matches our map keys if possible.

        setDownloads((prev) => {
          const next = new Map(prev);
          const existing = next.get(track_key);
          if (existing) {
            // Check persistent completed set first
            if (completedTracksRef.current.has(track_key)) {
              return prev;
            }

            // Never downgrade from "complete" status
            if (existing.status === "complete") {
              completedTracksRef.current.add(track_key);
              return prev;
            }

            // Respect backend's explicit status if it says complete
            // Otherwise use progress threshold as failsafe
            const isComplete = backendStatus === "complete" || progress >= 0.99;
            const newStatus = isComplete ? "complete" : "downloading";

            next.set(track_key, {
              ...existing,
              progress: progress,
              status: newStatus,
            });
          } else {
          }
          return next;
        });
      },
    );

    const unlistenComplete = listen<DownloadComplete>(
      "download-complete",
      (event) => {
        const { track_id: rawId } = event.payload;
        const track_key = String(rawId);

        setDownloads((prev) => {
          const next = new Map(prev);
          const existing = next.get(track_key);

          // Add to persistent completed set
          completedTracksRef.current.add(track_key);

          if (existing) {
            next.set(track_key, {
              ...existing,
              progress: 1,
              status: "complete",
            });
          } else {
            console.warn(
              `[DownloadContext] Track ${track_key} completed but not found in map`,
            );
          }
          return next;
        });
      },
    );

    const unlistenError = listen<string>("download-error", (event) => {
      console.error("Download error:", event.payload);
      // Rough matching
      const match = event.payload.match(/track (\S+):/);
      if (match) {
        const trackId = match[1];
        setDownloads((prev) => {
          const next = new Map(prev);
          const existing = next.get(trackId);
          if (existing) {
            next.set(trackId, {
              ...existing,
              status: "error",
              error: event.payload,
            });
          }
          return next;
        });
      }
    });

    return () => {
      unlistenProgress.then((f) => f());
      unlistenComplete.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []);

  const downloadTrack = useCallback(async (track: Track) => {
    // Detect track source and IDs
    let source: string | undefined = (track as any).source;
    let providerId: string | undefined = (track as any).provider_id;
    let externalId: string | undefined = (track as any).external_id;

    // Try to infer source from path if not explicitly set
    if (!providerId && track.path) {
      if (track.path.startsWith("tidal:")) {
        providerId = "tidal";
        externalId = track.path.split(":")[1];
      } else if (track.path.startsWith("subsonic:")) {
        providerId = "subsonic";
        externalId = track.path.split(":")[1];
      } else if (track.path.startsWith("jellyfin:")) {
        providerId = "jellyfin";
        externalId = track.path.split(":")[1];
      } else if (/^\d+$/.test(track.id)) {
        // Numeric ID is likely Tidal
        providerId = "tidal";
        externalId = track.id;
      }
    }

    // Normalize source
    if (source === "TIDAL") providerId = "tidal";
    if (source === "SUBSONIC") providerId = "subsonic";
    if (source === "JELLYFIN") providerId = "jellyfin";

    if (!providerId || !externalId) {
      console.error(
        "Cannot download track: Missing providerId or externalId",
        track,
      );
      return;
    }

    // Create uniform track key (provider:externalId format for all providers)
    const trackKey = `${providerId}:${externalId}`;

    setDownloads((prev) => {
      const next = new Map(prev);
      next.set(trackKey, {
        trackId: trackKey,
        title: track.title,
        artist: track.artist,
        progress: 0,
        status: "pending",
      });
      return next;
    });

    try {
      if (providerId === "tidal") {
        // Use legacy start_download for Tidal
        // We must pass u64
        const numId = parseInt(externalId, 10);
        await invoke("start_download", {
          trackId: numId,
          metadata: {
            title: track.title,
            artist: track.artist || "Unknown Artist",
            album: track.album || "Unknown Album",
            coverUrl: track.cover_image || null,
          },
          quality: localStorage.getItem("sonami-stream-quality") || "LOSSLESS",
        });
      } else {
        // Generic provider download
        await invoke("download_provider_track", {
          providerId,
          externalId,
          metadata: {
            title: track.title,
            artist: track.artist || "Unknown Artist",
            album: track.album || "Unknown Album",
            coverUrl: track.cover_image || null,
          },
          quality: localStorage.getItem("sonami-stream-quality") || "LOSSLESS",
        });
      }

      setDownloads((prev) => {
        const next = new Map(prev);
        const existing = next.get(trackKey);
        if (existing) {
          next.set(trackKey, { ...existing, status: "downloading" });
        }
        return next;
      });
    } catch (e) {
      console.error("Failed to start download:", e);
      setDownloads((prev) => {
        const next = new Map(prev);
        const existing = next.get(trackKey);
        if (existing) {
          next.set(trackKey, {
            ...existing,
            status: "error",
            error: String(e),
          });
        }
        return next;
      });
    }
  }, []);

  const deleteDownloadedTrack = useCallback(
    async (providerId: string, externalId: string) => {
      try {
        await invoke("delete_track_download", { providerId, externalId });
        // Create uniform track key (provider:externalId format for all providers)
        const trackKey = `${providerId}:${externalId}`;

        // Remove from persistent set
        completedTracksRef.current.delete(trackKey);

        // Remove from downloads map
        setDownloads((prev) => {
          const next = new Map(prev);
          next.delete(trackKey);
          return next;
        });
      } catch (e) {
        console.error("Failed to delete downloaded track:", e);
        throw e;
      }
    },
    [],
  );

  const setDownloadPath = useCallback(async (path: string) => {
    try {
      await invoke("set_download_path", { path });
      setDownloadPathState(path);
    } catch (e) {
      console.error("Failed to set download path:", e);
      throw e;
    }
  }, []);

  const openDownloadFolder = useCallback(async () => {
    try {
      await invoke("open_download_folder");
    } catch (e) {
      console.error("Failed to open download folder:", e);
    }
  }, []);

  const isDownloading = Array.from(downloads.values()).some(
    (d) => d.status === "downloading" || d.status === "pending",
  );

  // Direct check on the persistent ref
  const isTrackCompleted = useCallback((trackId: string) => {
    return completedTracksRef.current.has(trackId);
  }, []);

  return (
    <DownloadContext.Provider
      value={{
        downloads,
        downloadPath,
        isDownloading,
        isTrackCompleted,
        downloadTrack,
        deleteDownloadedTrack,
        setDownloadPath,
        openDownloadFolder,
        refreshDownloadPath,
      }}
    >
      {children}
    </DownloadContext.Provider>
  );
};

export const useDownload = () => {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error("useDownload must be used within DownloadProvider");
  }
  return context;
};
