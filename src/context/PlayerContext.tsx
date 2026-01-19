import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
  useMemo,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Track, Playlist } from "../types";
import { UnifiedTrack } from "../api/library";
import { recordPlay } from "../api/history";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "../hooks/queries";

interface PlaybackInfo {
  position: number;
  duration: number;
  is_playing: boolean;
}

export interface PlaybackQuality {
  path: string;
  source: "LOCAL" | "STREAM";
  quality: string;
}

export interface PlaybackQuality {
  path: string;
  source: "LOCAL" | "STREAM";
  quality: string;
}

export type RepeatMode = "off" | "all" | "one";

interface PlaybackProgressContextType {
  currentTime: number;
  duration: number;
}
export const PlaybackProgressContext =
  createContext<PlaybackProgressContextType>({ currentTime: 0, duration: 0 });

interface PlayerContextType {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;

  volume: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  queue: Track[];
  playlists: Playlist[];
  isQueueOpen: boolean;
  setIsQueueOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  importMusic: () => Promise<void>;
  importFolder: () => Promise<void>;
  playTrack: (track: Track, contextQueue?: Track[]) => Promise<void>;
  togglePlay: () => Promise<void>;
  seek: (time: number) => Promise<void>;
  setVolume: (vol: number) => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  queueNextTrack: (track: Track) => Promise<void>;
  addToQueue: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  clearLibrary: () => void;
  createPlaylist: (name: string, description?: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  renamePlaylist: (id: string, newName: string) => Promise<void>;
  addToPlaylist: (playlistId: string, track: Track) => Promise<void>;
  removeFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  refreshPlaylists: () => Promise<void>;

  crossfadeEnabled: boolean;
  crossfadeDuration: number;
  setCrossfade: (enabled: boolean, duration: number) => Promise<void>;

  playerBarStyle: "floating" | "classic";
  setPlayerBarStyle: (style: "floating" | "classic") => void;

  streamQuality: "LOSSLESS" | "HIGH" | "LOW";
  setStreamQuality: (quality: "LOSSLESS" | "HIGH" | "LOW") => void;

  // Audio processing settings
  loudnessNormalization: boolean;
  setLoudnessNormalization: (enabled: boolean) => Promise<void>;

  // Discord Rich Presence
  discordRpcEnabled: boolean;
  setDiscordRpcEnabled: (enabled: boolean) => Promise<void>;

  // Lyrics Provider
  lyricsProvider: "netease" | "lrclib";
  setLyricsProvider: (provider: "netease" | "lrclib") => void;

  preferHighQualityStream: boolean;
  setPreferHighQualityStream: (enabled: boolean) => void;

  searchProviderOrder: string[];
  setSearchProviderOrder: (order: string[]) => void;

  favorites: Set<string>;
  toggleFavorite: (track: Track) => Promise<void>;
  refreshFavorites: () => Promise<void>;

  /** Incremented when playlist/favorites data changes - watch this to trigger re-fetches */
  dataVersion: number;

  playbackQuality: PlaybackQuality | null;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const STORAGE_KEYS = {
  VOLUME: "sonami-volume",
  SHUFFLE: "sonami-shuffle",
  REPEAT: "sonami-repeat",
  CROSSFADE_ENABLED: "sonami-crossfade-enabled",
  CROSSFADE_DURATION: "sonami-crossfade-duration",
  PLAYER_BAR_STYLE: "sonami-player-bar-style",
  STREAM_QUALITY: "sonami-stream-quality",
  LOUDNESS_NORMALIZATION: "sonami-loudness-normalization",
  DISCORD_RPC: "sonami-discord-rpc",
  LYRICS_PROVIDER: "sonami-lyrics-provider",
  PREFER_HIGH_QUALITY_STREAM: "sonami-prefer-high-quality-stream",
  SEARCH_PROVIDER_ORDER: "sonami-search-provider-order",
};

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VOLUME);
    return saved ? parseFloat(saved) : 1.0;
  });
  const [shuffle, setShuffle] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SHUFFLE);
    return saved === "true";
  });
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REPEAT);
    return (saved as RepeatMode) || "off";
  });
  const [queue, setQueue] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [crossfadeEnabled, setCrossfadeEnabled] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CROSSFADE_ENABLED);
    return saved !== "false";
  });
  const [crossfadeDuration, setCrossfadeDurationState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CROSSFADE_DURATION);
    return saved ? parseInt(saved) : 5000;
  });
  const [playerBarStyle, setPlayerBarStyleState] = useState<
    "floating" | "classic"
  >(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PLAYER_BAR_STYLE);
    return saved === "classic" || saved === "floating" ? saved : "classic";
  });

  const [playbackQuality, setPlaybackQuality] =
    useState<PlaybackQuality | null>(null);

  const [streamQuality, setStreamQualityState] = useState<
    "LOSSLESS" | "HIGH" | "LOW"
  >(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.STREAM_QUALITY);
    if (saved === "LOSSLESS" || saved === "HIGH" || saved === "LOW") {
      return saved;
    }
    return "LOSSLESS";
  });

  // Loudness normalization setting
  const [loudnessNormalization, setLoudnessNormalizationState] = useState(
    () => {
      const saved = localStorage.getItem(STORAGE_KEYS.LOUDNESS_NORMALIZATION);
      return saved === "true";
    },
  );

  // Discord Rich Presence setting
  const [discordRpcEnabled, setDiscordRpcEnabledState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DISCORD_RPC);
    return saved === "true";
  });

  const [lyricsProvider, setLyricsProviderState] = useState<
    "netease" | "lrclib"
  >(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LYRICS_PROVIDER);
    return saved === "lrclib" ? "lrclib" : "netease";
  });

  const [preferHighQualityStream, setPreferHighQualityStreamState] = useState(
    () => {
      const saved = localStorage.getItem(
        STORAGE_KEYS.PREFER_HIGH_QUALITY_STREAM,
      );
      return saved === "true";
    },
  );

  const DEFAULT_PROVIDER_ORDER = ["local", "tidal", "subsonic", "jellyfin"];
  const [searchProviderOrder, setSearchProviderOrderState] = useState<string[]>(
    () => {
      const saved = localStorage.getItem(STORAGE_KEYS.SEARCH_PROVIDER_ORDER);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        } catch { }
      }
      return DEFAULT_PROVIDER_ORDER;
    },
  );

  const setSearchProviderOrder = (order: string[]) => {
    setSearchProviderOrderState(order);
    localStorage.setItem(STORAGE_KEYS.SEARCH_PROVIDER_ORDER, JSON.stringify(order));
  };

  const seekTarget = useRef<{ time: number; timestamp: number } | null>(null);

  // Data version counter - incremented when playlist/favorites data changes
  const [dataVersion, setDataVersion] = useState(0);
  const bumpDataVersion = () => setDataVersion((v) => v + 1);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOLUME, volume.toString());
  }, [volume]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHUFFLE, shuffle.toString());
  }, [shuffle]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.REPEAT, repeatMode);
  }, [repeatMode]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.CROSSFADE_ENABLED,
      crossfadeEnabled.toString(),
    );
    localStorage.setItem(
      STORAGE_KEYS.CROSSFADE_DURATION,
      crossfadeDuration.toString(),
    );
  }, [crossfadeEnabled, crossfadeDuration]);

  const currentTrackRef = useRef<Track | null>(null);
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const lastRecordedToken = useRef<string | null>(null);
  const recordingThreshold = 30; // seconds

  useEffect(() => {
    let animationId: number;
    let lastPollTime = 0;
    const POLL_INTERVAL = 100;

    const pollPlaybackInfo = async (timestamp: number) => {
      if (timestamp - lastPollTime >= POLL_INTERVAL) {
        lastPollTime = timestamp;

        try {
          const info = await invoke<PlaybackInfo>("get_playback_info");

          if (seekTarget.current) {
            const diff = Math.abs(info.position - seekTarget.current.time);
            const elapsed = Date.now() - seekTarget.current.timestamp;

            if (diff < 0.5 || elapsed > 2000) {
              seekTarget.current = null;
              setCurrentTime(info.position);
            }
          } else {
            setCurrentTime(info.position);
          }

          setDuration(info.duration);
          setIsPlaying(info.is_playing);

          // Recording Logic
          const track = currentTrackRef.current;
          if (
            track &&
            info.is_playing &&
            info.position > recordingThreshold &&
            lastRecordedToken.current !== track.id
          ) {
            lastRecordedToken.current = track.id;
            recordPlay(track.id)
              .then(() => {
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.history });
              })
              .catch((e) => console.error(e));
            bumpDataVersion();
          }
        } catch (e) { }
      }

      animationId = requestAnimationFrame(pollPlaybackInfo);
    };

    animationId = requestAnimationFrame(pollPlaybackInfo);

    const unlisten = listen<Track>("track-changed", (event) => {
      console.log("Track changed event:", event.payload);
      setCurrentTrack(event.payload);
      // Update ref immediately for the loop
      currentTrackRef.current = event.payload;

      setDuration(event.payload.duration);
      setCurrentTime(0);
      seekTarget.current = null;
      lastRecordedToken.current = null; // Reset recording for new track
    });

    const unlistenQuality = listen<PlaybackQuality>(
      "playback-quality-changed",
      (event) => {
        console.log("Playback quality changed:", event.payload);
        setPlaybackQuality(event.payload);
      },
    );

    return () => {
      cancelAnimationFrame(animationId);
      unlisten.then((f) => f());
      unlistenQuality.then((f) => f());
    };
  }, []); // Run once, depend on refs

  useEffect(() => {
    const syncState = async () => {
      try {
        const track = await invoke<Track | null>("get_current_track");
        if (track) setCurrentTrack(track);

        const q = await invoke<Track[]>("get_queue");
        if (q.length > 0 && tracks.length === 0) {
          setTracks(q);
        }

        const s = await invoke<boolean>("get_shuffle_mode");
        setShuffle(s);

        const r = await invoke<RepeatMode>("get_repeat_mode");
        setRepeatMode(r);

        const cfDuration = await invoke<number>("get_crossfade_duration");
        if (crossfadeEnabled) {
          if (cfDuration !== crossfadeDuration) {
            await invoke("set_crossfade_duration", {
              durationMs: crossfadeDuration,
            });
          }
        } else {
          if (cfDuration !== 0) {
            await invoke("set_crossfade_duration", { durationMs: 0 });
          }
        }

        refreshPlaylists();
      } catch (e) {
        console.error("Failed to sync state:", e);
      }
    };
    syncState();
  }, []);

  const refreshPlaylists = async () => {
    try {
      const list = await invoke<Playlist[]>("get_playlists");
      setPlaylists(list);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.playlists });
    } catch (e) {
      console.error("Failed to fetch playlists:", e);
    }
  };

  const createPlaylist = async (name: string, description?: string) => {
    try {
      const newPlaylist = await invoke<Playlist>("create_playlist", {
        name,
        description,
      });
      setPlaylists((prev) => [...prev, newPlaylist]);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.playlists });
    } catch (e) {
      console.error("Failed to create playlist:", e);
    }
  };

  const deletePlaylist = async (id: string) => {
    try {
      await invoke("delete_playlist", { id });
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.playlists });
    } catch (e) {
      console.error("Failed to delete playlist:", e);
    }
  };

  const renamePlaylist = async (id: string, newName: string) => {
    try {
      await invoke("rename_playlist", { id, newName });
      await refreshPlaylists();
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.playlists });
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.playlist(id),
      });
    } catch (e) {
      console.error("Failed to rename playlist:", e);
    }
  };

  const addToPlaylist = async (playlistId: string, track: Track) => {
    try {
      await invoke("add_to_playlist", { playlistId, track });
      await refreshPlaylists();
      bumpDataVersion(); // Trigger reactive updates in views
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.playlists });
    } catch (e) {
      console.error("Failed to add to playlist:", e);
    }
  };

  const removeFromPlaylist = async (playlistId: string, trackId: string) => {
    try {
      await invoke("remove_from_playlist", { playlistId, trackId });
      await refreshPlaylists();
      bumpDataVersion(); // Trigger reactive updates in views
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.playlists });
    } catch (e) {
      console.error("Failed to remove from playlist:", e);
    }
  };

  const importMusic = async () => {
    try {
      const newTracks = await invoke<Track[]>("import_music");
      if (newTracks && newTracks.length > 0) {
        setTracks((prev) => {
          const existingPaths = new Set(prev.map((t) => t.path));
          const uniqueNew = newTracks.filter((t) => !existingPaths.has(t.path));
          return [...prev, ...uniqueNew];
        });
      }
    } catch (e) {
      console.error("Failed to import music:", e);
    }
  };

  const importFolder = async () => {
    try {
      const newTracks = await invoke<Track[]>("import_folder");
      if (newTracks && newTracks.length > 0) {
        setTracks((prev) => {
          const existingPaths = new Set(prev.map((t) => t.path));
          const uniqueNew = newTracks.filter((t) => !existingPaths.has(t.path));
          return [...prev, ...uniqueNew];
        });
      }
    } catch (e) {
      console.error("Failed to import folder:", e);
    }
  };

  const playTrack = async (track: Track, contextQueue?: Track[]) => {
    try {
      setCurrentTrack(track);
      setCurrentTime(0);
      setIsPlaying(true);
      seekTarget.current = null;

      const queueToSet =
        contextQueue && contextQueue.length > 0 ? contextQueue : tracks;

      await invoke("set_queue", { tracks: queueToSet });

      setQueue(queueToSet);

      await invoke("play_track", { path: track.path });
    } catch (e) {
      console.error("Failed to play track:", e);
    }
  };

  const togglePlay = async () => {
    try {
      if (isPlaying) {
        await invoke("pause_track");
      } else {
        await invoke("resume_track");
      }
      setIsPlaying(!isPlaying);
    } catch (e) {
      console.error("Failed to toggle playback:", e);
    }
  };

  const seek = async (time: number) => {
    try {
      seekTarget.current = { time, timestamp: Date.now() };
      setCurrentTime(time);
      await invoke("seek_track", { position: time });
    } catch (e) {
      console.error("Failed to seek:", e);
      seekTarget.current = null;
    }
  };

  const setVolume = async (vol: number) => {
    setVolumeState(vol);
    try {
      await invoke("set_volume", { volume: vol });
    } catch (e) {
      console.error("Failed to set volume:", e);
    }
  };

  const nextTrack = async () => {
    try {
      await invoke("next_track");
    } catch (e) {
      console.error("Failed to skip next:", e);
    }
  };

  const prevTrack = async () => {
    try {
      await invoke("prev_track");
    } catch (e) {
      console.error("Failed to skip prev:", e);
    }
  };

  const toggleShuffle = async () => {
    try {
      const newState = await invoke<boolean>("toggle_shuffle");
      setShuffle(newState);
    } catch (e) {
      console.error("Failed to toggle shuffle:", e);
    }
  };

  const toggleRepeat = async () => {
    const nextMode =
      repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
    setRepeatMode(nextMode);
    try {
      await invoke("set_repeat_mode", { mode: nextMode });
    } catch (e) {
      console.error("Failed to toggle repeat:", e);
    }
  };

  const addToQueue = async (track: Track) => {
    try {
      await invoke("add_to_queue", { track });
      setQueue((prev) => [...prev, track]);
    } catch (e) {
      console.error("Failed to add to queue:", e);
    }
  };

  const removeFromQueue = (trackId: string) => {
    setQueue((prev) => prev.filter((t) => t.id !== trackId));
  };

  const clearQueue = async () => {
    try {
      await invoke("clear_queue");
      setQueue([]);
    } catch (e) {
      console.error("Failed to clear queue:", e);
    }
  };

  const clearLibrary = async () => {
    setTracks([]);
    setCurrentTrack(null);
    setQueue([]);
    await invoke("set_queue", { tracks: [] });
  };

  const queueNextTrack = async (track: Track) => {
    addToQueue(track);
  };

  const setCrossfade = async (enabled: boolean, duration: number) => {
    setCrossfadeEnabled(enabled);
    setCrossfadeDurationState(duration);

    try {
      const targetDuration = enabled ? duration : 0;
      await invoke("set_crossfade_duration", { durationMs: targetDuration });
    } catch (e) {
      console.error("Failed to set crossfade:", e);
    }
  };

  const setPlayerBarStyle = (style: "floating" | "classic") => {
    setPlayerBarStyleState(style);
    localStorage.setItem(STORAGE_KEYS.PLAYER_BAR_STYLE, style);
  };

  const setStreamQuality = async (quality: "LOSSLESS" | "HIGH" | "LOW") => {
    setStreamQualityState(quality);
    localStorage.setItem(STORAGE_KEYS.STREAM_QUALITY, quality);
    try {
      await invoke("set_tidal_config", {
        quality,
        preferHighQualityStream: preferHighQualityStream,
      });
    } catch (e) {
      console.error("Failed to sync stream quality:", e);
    }
  };

  const setLoudnessNormalization = async (enabled: boolean) => {
    setLoudnessNormalizationState(enabled);
    localStorage.setItem(
      STORAGE_KEYS.LOUDNESS_NORMALIZATION,
      enabled.toString(),
    );
    try {
      await invoke("set_loudness_normalization", { enabled });
    } catch (e) {
      console.error("Failed to set loudness normalization:", e);
    }
  };

  const setDiscordRpcEnabled = async (enabled: boolean) => {
    setDiscordRpcEnabledState(enabled);
    localStorage.setItem(STORAGE_KEYS.DISCORD_RPC, enabled.toString());
    try {
      await invoke("set_discord_rpc_enabled", { enabled });
    } catch (e) {
      console.error("Failed to set Discord RPC:", e);
    }
  };

  const setLyricsProvider = (provider: "netease" | "lrclib") => {
    setLyricsProviderState(provider);
    localStorage.setItem(STORAGE_KEYS.LYRICS_PROVIDER, provider);
  };

  const setPreferHighQualityStream = async (enabled: boolean) => {
    setPreferHighQualityStreamState(enabled);
    localStorage.setItem(
      STORAGE_KEYS.PREFER_HIGH_QUALITY_STREAM,
      enabled.toString(),
    );
    try {
      await invoke("set_tidal_config", {
        quality: streamQuality,
        preferHighQualityStream: enabled,
      });
    } catch (e) {
      console.error("Failed to sync prefer high quality:", e);
    }
  };

  // Sync settings with backend on load
  useEffect(() => {
    const syncSettings = async () => {
      try {
        // Sync loudness normalization
        await invoke("set_loudness_normalization", {
          enabled: loudnessNormalization,
        });
        // Sync Discord RPC
        await invoke("set_discord_rpc_enabled", { enabled: discordRpcEnabled });
        // Sync Tidal Config
        await invoke("set_tidal_config", {
          quality: streamQuality,
          preferHighQualityStream: preferHighQualityStream,
        });
      } catch (e) {
        console.error("Failed to sync settings:", e);
      }
    };
    syncSettings();

    const unlistenDownloadComplete = listen("download-complete", () => {
      console.log("Download complete, refreshing library data...");
      refreshPlaylists();
      refreshFavorites();
      // If we had a way to refresh the current playlist details specifically, we'd do it here too.
      // But bumping dataVersion should signal views to refetch if they depend on it.
      bumpDataVersion();
    });

    return () => {
      unlistenDownloadComplete.then((f) => f());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Refresh favorites - can be called by views
  const refreshFavorites = async () => {
    try {
      const favs = await invoke<UnifiedTrack[]>("get_favorites");
      const newSet = new Set<string>();
      favs.forEach((t) => {
        newSet.add(t.id);
        if (t.provider_id && t.external_id) {
          newSet.add(`${t.provider_id}:${t.external_id}`);
        }
      });
      setFavorites(newSet);
      bumpDataVersion();
    } catch (e) {
      console.error("Failed to refresh favorites:", e);
    }
  };

  // Sync favorites on load
  useEffect(() => {
    refreshFavorites();
  }, []);

  const toggleFavorite = async (track: Track) => {
    const t = track as UnifiedTrack;
    const id = track.id;
    // Construct composite ID if applicable
    const compositeId =
      t.provider_id && t.external_id
        ? `${t.provider_id}:${t.external_id}`
        : null;

    const isFav = favorites.has(id) || (compositeId && favorites.has(compositeId));

    try {
      if (isFav) {
        await invoke("remove_favorite", { track: t });
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(id);
          if (compositeId) next.delete(compositeId);
          return next;
        });
      } else {
        await invoke("add_favorite", { track: t });
        setFavorites((prev) => {
          const next = new Set(prev);
          next.add(id);
          if (compositeId) next.add(compositeId);
          return next;
        });
      }
      bumpDataVersion(); // Trigger reactive updates
      // Optionally refresh to get real IDs if valid import happened
      // refreshFavorites();
    } catch (e) {
      console.error("Failed to toggle favorite:", e);
    }
  };

  const playerValue = useMemo(
    () => ({
      tracks,
      currentTrack,
      isPlaying,
      volume,
      shuffle,
      repeatMode,
      queue,
      playlists,
      isQueueOpen,
      setIsQueueOpen,
      isSettingsOpen,
      setIsSettingsOpen,
      importMusic,
      importFolder,
      playTrack,
      togglePlay,
      seek,
      setVolume,
      nextTrack,
      prevTrack,
      toggleShuffle,
      toggleRepeat,
      queueNextTrack,
      addToQueue,
      removeFromQueue,
      clearQueue,
      clearLibrary,
      createPlaylist,
      deletePlaylist,
      renamePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      refreshPlaylists,
      crossfadeEnabled,
      crossfadeDuration,
      setCrossfade,
      playerBarStyle,
      setPlayerBarStyle,
      streamQuality,
      setStreamQuality,
      loudnessNormalization,
      setLoudnessNormalization,
      discordRpcEnabled,
      setDiscordRpcEnabled,
      lyricsProvider,
      setLyricsProvider,
      preferHighQualityStream,
      setPreferHighQualityStream,
      searchProviderOrder,
      setSearchProviderOrder,
      favorites,
      toggleFavorite,
      refreshFavorites,
      dataVersion,
      playbackQuality,
    }),
    [
      tracks,
      currentTrack,
      isPlaying,
      volume,
      shuffle,
      repeatMode,
      queue,
      playlists,
      isQueueOpen,
      isSettingsOpen,
      crossfadeEnabled,
      crossfadeDuration,
      playerBarStyle,
      streamQuality,
      loudnessNormalization,
      discordRpcEnabled,
      lyricsProvider,
      preferHighQualityStream,
      searchProviderOrder,
      favorites,
      dataVersion,
      playbackQuality,
    ],
  );

  const playbackValue = useMemo(
    () => ({
      currentTime,
      duration,
    }),
    [currentTime, duration],
  );

  return (
    <PlayerContext.Provider value={playerValue}>
      <PlaybackProgressContext.Provider value={playbackValue}>
        {children}
      </PlaybackProgressContext.Provider>
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
};

export const usePlaybackProgress = () => {
  return useContext(PlaybackProgressContext);
};
