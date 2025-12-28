import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Track } from "../types";

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
    isQueueOpen: boolean;
    setIsQueueOpen: (open: boolean) => void;
    importMusic: () => Promise<void>;
    importFolder: () => Promise<void>;
    playTrack: (track: Track) => Promise<void>;
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
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// Storage keys for persistence
const STORAGE_KEYS = {
    TRACKS: "sonami-library-tracks",
    VOLUME: "sonami-volume",
    SHUFFLE: "sonami-shuffle",
    REPEAT: "sonami-repeat",
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
    const [isQueueOpen, setIsQueueOpen] = useState(false);

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



    // Sync playback state
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

                    // Sync current track if we don't have one or if backend changed without event (safety)
                    // Actually event listener is better, but polling safety is good.
                    // Let's rely on polling for position/status and event for track change.

                    // Also sync shuffle/repeat occasionally?
                    // For now, assume frontend state is truthy via user action, or sync on mount.
                } catch (e) {
                    // Ignore polling errors silently
                }
            }

            animationId = requestAnimationFrame(pollPlaybackInfo);
        };

        animationId = requestAnimationFrame(pollPlaybackInfo);

        // Listen for track changes from backend (auto-advance)
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
                // We treat get_queue as the library tracks in this context?
                // The backend Queue.tracks is the main list.
                // The frontend 'tracks' is the Library.
                // We should keep them in sync.
                if (q.length > 0 && tracks.length === 0) {
                    setTracks(q); // Sync from backend if empty
                }

                const s = await invoke<boolean>("get_shuffle_mode");
                setShuffle(s);

                const r = await invoke<RepeatMode>("get_repeat_mode");
                setRepeatMode(r);
            } catch (e) {
                console.error("Failed to sync state:", e);
            }
        };
        syncState();
    }, []);



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

    const playTrack = async (track: Track) => {
        try {
            // Optimistic update
            setCurrentTrack(track);
            setCurrentTime(0);
            setIsPlaying(true);

            // Ensure backend queue has our library
            // Note: In a real app we might not want to resend 10k tracks every time.
            // But for now, we ensure consistency.
            // Check if we need to update queue?
            // Let's assume 'tracks' is the source of truth for the queue.
            await invoke("set_queue", { tracks });

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

    return (
        <PlayerContext.Provider value={{
            tracks, currentTrack, isPlaying, currentTime, duration, volume,
            shuffle, repeatMode, queue, isQueueOpen, setIsQueueOpen,
            importMusic, importFolder, playTrack, togglePlay, seek, setVolume,
            nextTrack, prevTrack, toggleShuffle, toggleRepeat,
            queueNextTrack, addToQueue, removeFromQueue, clearQueue, clearLibrary
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
