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
  deleteDownloadedTrack: (tidalId: number) => Promise<void>;
  setDownloadPath: (path: string) => Promise<void>;
  openDownloadFolder: () => Promise<void>;
  refreshDownloadPath: () => Promise<void>;
}

const DownloadContext = createContext<DownloadContextType | undefined>(
  undefined
);

export const DownloadProvider = ({ children }: { children: ReactNode }) => {
  const [downloads, setDownloads] = useState<Map<string, DownloadItem>>(
    new Map()
  );
  const [downloadPath, setDownloadPathState] = useState<string>("");

  // Persistent set of completed track IDs - survives state resets
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
        const { track_id: rawId, progress, status: backendStatus } = event.payload;
        const track_id = String(rawId);
        // Backend sends progress as 0.0-1.0 (e.g., 0.5 = 50%)

        setDownloads((prev) => {
          const next = new Map(prev);
          const existing = next.get(track_id);
          if (existing) {
            // Check persistent completed set first
            if (completedTracksRef.current.has(track_id)) {
              return prev;
            }

            // Never downgrade from "complete" status
            if (existing.status === "complete") {
              completedTracksRef.current.add(track_id);
              return prev;
            }

            // Respect backend's explicit status if it says complete
            // Otherwise use progress threshold as failsafe
            const isComplete = backendStatus === "complete" || progress >= 0.99;
            const newStatus = isComplete ? "complete" : "downloading";



            next.set(track_id, {
              ...existing,
              progress: progress,
              status: newStatus,
            });
          } else {

          }
          return next;
        });
      }
    );

    const unlistenComplete = listen<DownloadComplete>(
      "download-complete",
      (event) => {
        const { track_id: rawId } = event.payload;
        const track_id = String(rawId);


        setDownloads((prev) => {
          const next = new Map(prev);
          const existing = next.get(track_id);

          // Add to persistent completed set
          completedTracksRef.current.add(track_id);

          if (existing) {
            next.set(track_id, {
              ...existing,
              progress: 1,
              status: "complete",
            });
          } else {
            console.warn(`[DownloadContext] Track ${track_id} completed but not found in map`);
          }
          return next;
        });
      }
    );

    const unlistenError = listen<string>("download-error", (event) => {
      console.error("Download error:", event.payload);
      const match = event.payload.match(/track (\d+):/);
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

  const downloadTrack = useCallback(
    async (track: Track) => {
      let tidalId: number | undefined;

      // Try to find Tidal ID from various sources
      // 1. Check for tidal_id property (UnifiedTrack)
      if ("tidal_id" in track && (track as any).tidal_id) {
        tidalId = (track as any).tidal_id;
      }
      // 2. Check path for tidal: prefix
      else if (track.path && track.path.startsWith("tidal:")) {
        const parts = track.path.split(":");
        if (parts.length > 1) {
          tidalId = parseInt(parts[1], 10);
        }
      }
      // 3. Check if ID itself is numeric
      else if (/^\d+$/.test(track.id)) {
        tidalId = parseInt(track.id, 10);
      }
      // 4. If source is TIDAL but no ID found yet, log error
      else if ("source" in track && (track as any).source === "TIDAL") {
        console.warn("Tidal track found but no ID:", track);
      }

      if (!tidalId || isNaN(tidalId)) {
        console.error("Cannot download track: No valid Tidal ID found", track);
        return;
      }

      const trackKey = tidalId.toString();

      // Add to downloads map
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
        await invoke("start_download", {
          trackId: tidalId,
          metadata: {
            title: track.title,
            artist: track.artist || "Unknown Artist",
            album: track.album || "Unknown Album",
            coverUrl: track.cover_image || null,
          },
          quality: localStorage.getItem("sonami-stream-quality") || "LOSSLESS",
        });

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
    },
    []
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
    (d) => d.status === "downloading" || d.status === "pending"
  );

  // Direct check on the persistent ref
  const isTrackCompleted = useCallback((trackId: string) => {
    return completedTracksRef.current.has(trackId);
  }, []);

  const deleteDownloadedTrack = useCallback(async (tidalId: number) => {
    try {
      await invoke("delete_downloaded_track", { tidalId });
      // Remove from completed tracks ref
      completedTracksRef.current.delete(String(tidalId));
      // Remove from downloads map
      setDownloads((prev) => {
        const next = new Map(prev);
        next.delete(String(tidalId));
        return next;
      });
    } catch (e) {
      console.error("Failed to delete downloaded track:", e);
      throw e;
    }
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
