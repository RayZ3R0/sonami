import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Track, Playlist } from "../types";

interface PlaybackInfo {
    position: number;
    duration: number;
    is_playing: boolean;
}

export type RepeatMode = "off" | "all" | "one";

interface PlayerContextType {
    tracks: Track[];
    currentTrack: Track | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    shuffle: boolean;
    repeatMode: RepeatMode;
    queue: Track[];
    playlists: Playlist[];
    isQueueOpen: boolean;
    setIsQueueOpen: (open: boolean) => void;
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
    createPlaylist: (name: string) => Promise<void>;
    deletePlaylist: (id: string) => Promise<void>;
    renamePlaylist: (id: string, newName: string) => Promise<void>;
    addToPlaylist: (playlistId: string, track: Track) => Promise<void>;
    removeFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
    refreshPlaylists: () => Promise<void>;

    crossfadeEnabled: boolean;
    crossfadeDuration: number;
    setCrossfade: (enabled: boolean, duration: number) => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// Storage keys for persistence
const STORAGE_KEYS = {
    TRACKS: "sonami-library-tracks",
    VOLUME: "sonami-volume",
    SHUFFLE: "sonami-shuffle",
    REPEAT: "sonami-repeat",
    CROSSFADE_ENABLED: "sonami-crossfade-enabled",
    CROSSFADE_DURATION: "sonami-crossfade-duration",
};

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
    const [tracks, setTracks] = useState<Track[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.TRACKS);
        return saved ? JSON.parse(saved) : [];
    });
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
    const [crossfadeEnabled, setCrossfadeEnabled] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.CROSSFADE_ENABLED);
        return saved !== "false";
    });
    const [crossfadeDuration, setCrossfadeDurationState] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEYS.CROSSFADE_DURATION);
        return saved ? parseInt(saved) : 5000;
    });

    const isSeeking = useRef(false);


    // Persist tracks to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(tracks));
    }, [tracks]);

    // Persist settings
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
        localStorage.setItem(STORAGE_KEYS.CROSSFADE_ENABLED, crossfadeEnabled.toString());
        localStorage.setItem(STORAGE_KEYS.CROSSFADE_DURATION, crossfadeDuration.toString());
    }, [crossfadeEnabled, crossfadeDuration]);

    useEffect(() => {
        let animationId: number;
        let lastPollTime = 0;
        const POLL_INTERVAL = 100;

        const pollPlaybackInfo = async (timestamp: number) => {
            if (timestamp - lastPollTime >= POLL_INTERVAL) {
                lastPollTime = timestamp;

                try {
                    const info = await invoke<PlaybackInfo>("get_playback_info");
                    setCurrentTime(info.position);
                    setDuration(info.duration);
                    setIsPlaying(info.is_playing);

                } catch (e) {
                }
            }

            animationId = requestAnimationFrame(pollPlaybackInfo);
        };

        animationId = requestAnimationFrame(pollPlaybackInfo);

        const unlisten = listen<Track>("track-changed", (event) => {
            console.log("Track changed event:", event.payload);
            setCurrentTrack(event.payload);
            setDuration(event.payload.duration);
            setCurrentTime(0);
        });

        return () => {
            cancelAnimationFrame(animationId);
            unlisten.then(f => f());
        };
    }, []);

    // Initial sync
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
                        await invoke("set_crossfade_duration", { durationMs: crossfadeDuration });
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


    // Playlist Methods [NEW]
    const refreshPlaylists = async () => {
        try {
            const list = await invoke<Playlist[]>("get_playlists");
            setPlaylists(list);
        } catch (e) {
            console.error("Failed to fetch playlists:", e);
        }
    };

    const createPlaylist = async (name: string) => {
        try {
            // Optimistic update done in refresh? Or just wait.
            // Wait for backend to return the new playlist
            const newPlaylist = await invoke<Playlist>("create_playlist", { name });
            setPlaylists(prev => [...prev, newPlaylist]);
        } catch (e) {
            console.error("Failed to create playlist:", e);
        }
    };

    const deletePlaylist = async (id: string) => {
        try {
            await invoke("delete_playlist", { id });
            setPlaylists(prev => prev.filter(p => p.id !== id));
        } catch (e) {
            console.error("Failed to delete playlist:", e);
        }
    };

    const renamePlaylist = async (id: string, newName: string) => {
        try {
            await invoke("rename_playlist", { id, newName });
            refreshPlaylists();
        } catch (e) {
            console.error("Failed to rename playlist:", e);
        }
    };

    const addToPlaylist = async (playlistId: string, track: Track) => {
        try {
            await invoke("add_to_playlist", { playlistId, track });
            // Ideally backend returns updated playlist, or we re-fetch
            refreshPlaylists();
        } catch (e) {
            console.error("Failed to add to playlist:", e);
        }
    };

    const removeFromPlaylist = async (playlistId: string, trackId: string) => {
        try {
            await invoke("remove_from_playlist", { playlistId, trackId });
            refreshPlaylists();
        } catch (e) {
            console.error("Failed to remove from playlist:", e);
        }
    };


    const importMusic = async () => {
        try {
            const newTracks = await invoke<Track[]>("import_music");
            if (newTracks && newTracks.length > 0) {
                // Deduplicate by path
                setTracks(prev => {
                    const existingPaths = new Set(prev.map(t => t.path));
                    const uniqueNew = newTracks.filter(t => !existingPaths.has(t.path));
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
                // Deduplicate by path
                setTracks(prev => {
                    const existingPaths = new Set(prev.map(t => t.path));
                    const uniqueNew = newTracks.filter(t => !existingPaths.has(t.path));
                    return [...prev, ...uniqueNew];
                });
            }
        } catch (e) {
            console.error("Failed to import folder:", e);
        }
    };

    const playTrack = async (track: Track, contextQueue?: Track[]) => {
        try {
            // Optimistic update
            setCurrentTrack(track);
            setCurrentTime(0);
            setIsPlaying(true);

            // If a specific context queue is provided (e.g. from playlist), use it.
            // Otherwise, default to the full library 'tracks'.
            const queueToSet = contextQueue && contextQueue.length > 0 ? contextQueue : tracks;

            // Update backend queue
            await invoke("set_queue", { tracks: queueToSet });

            // Also update frontend queue state to match
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
                // If no track loaded, verify?
                await invoke("resume_track");
            }
            setIsPlaying(!isPlaying);
        } catch (e) {
            console.error("Failed to toggle playback:", e);
        }
    };

    const seek = async (time: number) => {
        try {
            isSeeking.current = true;
            setCurrentTime(time);
            await invoke("seek_track", { position: time });
            setTimeout(() => {
                isSeeking.current = false;
            }, 100);
        } catch (e) {
            console.error("Failed to seek:", e);
            isSeeking.current = false;
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
            // The polling/event listener will update UI
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
        const nextMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
        setRepeatMode(nextMode); // Optimistic
        try {
            await invoke("set_repeat_mode", { mode: nextMode });
        } catch (e) {
            console.error("Failed to toggle repeat:", e);
        }
    };

    const addToQueue = async (track: Track) => {
        try {
            await invoke("add_to_queue", { track });
            setQueue(prev => [...prev, track]); // Optimistic
        } catch (e) {
            console.error("Failed to add to queue:", e);
        }
    };

    const removeFromQueue = (trackId: string) => {
        // Backend command missing for removing specific item?
        // TODO: Implement remove_from_queue in backend
        setQueue(prev => prev.filter(t => t.id !== trackId));
    };

    const clearQueue = async () => {
        try {
            await invoke("clear_queue");
            setQueue([]);
        } catch (e) {
            console.error("Failed to clear queue:", e);
        }
    };

    const clearLibrary = () => {
        setTracks([]);
        setCurrentTrack(null);
        setQueue([]);
        localStorage.removeItem(STORAGE_KEYS.TRACKS);
        // Also clear backend queue?
        invoke("set_queue", { tracks: [] });
    };

    const queueNextTrack = async (track: Track) => {
        // Deprecated or alias to addToQueue?
        // Let's alias to addToQueue for now
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

    return (
        <PlayerContext.Provider value={{
            tracks, currentTrack, isPlaying, currentTime, duration, volume,
            shuffle, repeatMode, queue, playlists, isQueueOpen, setIsQueueOpen,
            importMusic, importFolder, playTrack, togglePlay, seek, setVolume,
            nextTrack, prevTrack, toggleShuffle, toggleRepeat,
            queueNextTrack, addToQueue, removeFromQueue, clearQueue, clearLibrary,

            createPlaylist, deletePlaylist, renamePlaylist, addToPlaylist, removeFromPlaylist, refreshPlaylists,
            crossfadeEnabled, crossfadeDuration, setCrossfade
        }}>
            {children}
        </PlayerContext.Provider>
    );
};

export const usePlayer = () => {
    const context = useContext(PlayerContext);
    if (!context) throw new Error("usePlayer must be used within PlayerProvider");
    return context;
};

