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
  undefined,
);

export const DownloadProvider = ({ children }: { children: ReactNode }) => {
  const [downloads, setDownloads] = useState<Map<string, DownloadItem>>(
    new Map(),
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
        const {
          track_id: rawId,
          progress,
          status: backendStatus,
        } = event.payload;
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
      },
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
            console.warn(
              `[DownloadContext] Track ${track_id} completed but not found in map`,
            );
          }
          return next;
        });
      },
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

  const downloadTrack = useCallback(async (track: Track) => {
    // Detect track source
    let source: string | undefined = (track as any).source;
    let providerId: string | undefined = (track as any).provider_id;
    let externalId: string | undefined = (track as any).external_id;
    let tidalId: number | undefined = (track as any).tidal_id;

    // Try to infer source from path if not explicitly set
    if (!source && track.path) {
      if (track.path.startsWith("tidal:")) {
        source = "TIDAL";
        const pathId = parseInt(track.path.split(":")[1], 10);
        if (!isNaN(pathId) && pathId > 0) {
          tidalId = pathId;
        }
      } else if (track.path.startsWith("subsonic:")) {
        source = "SUBSONIC";
        providerId = "subsonic";
        externalId = track.path.split(":")[1];
      } else if (track.path.startsWith("jellyfin:")) {
        source = "JELLYFIN";
        providerId = "jellyfin";
        externalId = track.path.split(":")[1];
      } else if (/^[a-f0-9-]{36}$/i.test(track.id)) {
        // UUID-style ID likely from Subsonic/Jellyfin
        // Check from provider_id if available
        if (providerId) {
          source = providerId.toUpperCase();
          externalId = externalId || track.id;
        }
      } else if (/^\d+$/.test(track.id)) {
        // Numeric ID is likely Tidal
        source = "TIDAL";
        tidalId = parseInt(track.id, 10);
      }
    }

    // For Tidal tracks with provider_id but no tidal_id, try external_id
    if ((source === "TIDAL" || providerId === "tidal") && !tidalId && externalId) {
      const parsedId = parseInt(externalId, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        tidalId = parsedId;
        source = "TIDAL";
      }
    }

    // For Tidal tracks, use the existing download command
    if (source === "TIDAL" || tidalId) {
      if (!tidalId) {
        console.error("Cannot download track: No valid Tidal ID found", track);
        return;
      }

      const trackKey = tidalId.toString();

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
      return;
    }

    // For Subsonic/Jellyfin tracks, use the provider download command
    if ((source === "SUBSONIC" || source === "JELLYFIN") && externalId) {
      const trackKey = `${source.toLowerCase()}:${externalId}`;
      providerId = providerId || source.toLowerCase();

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

        setDownloads((prev) => {
          const next = new Map(prev);
          const existing = next.get(trackKey);
          if (existing) {
            next.set(trackKey, { ...existing, status: "downloading" });
          }
          return next;
        });
      } catch (e) {
        console.error("Failed to start provider download:", e);
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
      return;
    }

    // Local tracks don't need downloading
    if (source === "LOCAL" || (!source && track.path && !track.path.includes(":"))) {
      console.log("Track is already local, no download needed:", track.title);
      return;
    }

    console.error("Cannot download track: Unknown source or missing ID", track);
  }, []);

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
