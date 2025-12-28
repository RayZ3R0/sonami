import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
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
    const pendingTrackLoad = useRef<string | null>(null);
    const lastTrackId = useRef<string | null>(null);
    const shuffledIndices = useRef<number[]>([]);

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
        // Regenerate shuffle order when toggle changes
        if (shuffle && tracks.length > 0) {
            shuffledIndices.current = generateShuffleOrder(tracks.length);
        }
    }, [shuffle, tracks.length]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.REPEAT, repeatMode);
    }, [repeatMode]);

    // Generate a shuffled order of indices
    const generateShuffleOrder = (length: number): number[] => {
        const indices = Array.from({ length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        return indices;
    };

    // Get the next track index based on shuffle mode
    const getNextTrackIndex = useCallback((currentIndex: number, direction: 1 | -1 = 1): number => {
        if (tracks.length === 0) return -1;
        
        if (shuffle) {
            const shufflePos = shuffledIndices.current.indexOf(currentIndex);
            const nextShufflePos = (shufflePos + direction + shuffledIndices.current.length) % shuffledIndices.current.length;
            return shuffledIndices.current[nextShufflePos];
        }
        
        return (currentIndex + direction + tracks.length) % tracks.length;
    }, [shuffle, tracks.length]);

    // Sync playback state
    useEffect(() => {
        let animationId: number;
        let lastPollTime = 0;
        const POLL_INTERVAL = 50;

        const pollPlaybackInfo = async (timestamp: number) => {
            if (timestamp - lastPollTime >= POLL_INTERVAL) {
                lastPollTime = timestamp;

                try {
                    const info = await invoke<PlaybackInfo>("get_playback_info");


                    setIsPlaying(info.is_playing);

                    // Handle track seek/reset sync
                    if (pendingTrackLoad.current !== null) {
                        // Backend has loaded the new track when position is near 0
                        if (info.position < 1.0) {
                            pendingTrackLoad.current = null;
                            setCurrentTime(info.position);
                        }
                        // Otherwise keep showing 0 until backend catches up
                    } else if (!isSeeking.current) {
                        // Normal position update
                        setCurrentTime(info.position);
                    }

                    // Update duration if it changed (new track)
                    if (info.duration > 0) {
                        setDuration(info.duration);
                    }

                    // Check if track ended and we need to advance
                    if (!info.is_playing && currentTrack && info.position >= info.duration - 0.1 && info.duration > 0) {
                        handleTrackEnd();
                    }
                } catch (e) {
                    // Ignore polling errors silently
                }
            }

            animationId = requestAnimationFrame(pollPlaybackInfo);
        };

        animationId = requestAnimationFrame(pollPlaybackInfo);
        return () => cancelAnimationFrame(animationId);
    }, [currentTrack]);


    const handleTrackEnd = useCallback(async () => {
        if (!currentTrack || tracks.length === 0) return;

        // Handle repeat one mode
        if (repeatMode === "one") {
            await seek(0);
            await invoke("resume_track");
            setIsPlaying(true);
            return;
        }

        // Check if there are tracks in the manual queue
        if (queue.length > 0) {
            const nextTrack = queue[0];
            setQueue(prev => prev.slice(1));
            await playTrack(nextTrack);
            return;
        }

        const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
        const nextIndex = getNextTrackIndex(currentIndex, 1);

        // Check if we've reached the end (in non-shuffle mode)
        const isLastTrack = !shuffle && currentIndex >= tracks.length - 1;

        if (isLastTrack && repeatMode === "off") {
            // End of playlist, stop
            setIsPlaying(false);
        } else {
            // Play next track (or loop back if repeat all)
            await playTrack(tracks[nextIndex]);
        }
    }, [currentTrack, tracks, repeatMode, shuffle, queue, getNextTrackIndex]);

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
            // Optimistic update until backend confirms
            pendingTrackLoad.current = track.id;
            setCurrentTime(0);
            setDuration(track.duration);
            setCurrentTrack(track);

            await invoke("play_track", { path: track.path });
            await invoke("set_volume", { volume });
            setIsPlaying(true);
            lastTrackId.current = track.id;

            // Gapless queue
            const currentIndex = tracks.findIndex(t => t.id === track.id);
            if (currentIndex >= 0 && currentIndex < tracks.length - 1) {
                const nextTrack = tracks[currentIndex + 1];
                await invoke("queue_next_track", { path: nextTrack.path });
            }
        } catch (e) {
            console.error("Failed to play track:", e);
        }
    };

    const togglePlay = async () => {
        if (!currentTrack) return;

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
        if (!currentTrack) return;
        try {
            isSeeking.current = true;
            setCurrentTime(time); // Optimistic update
            await invoke("seek_track", { position: time });
            // Small delay before allowing position updates again
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
        if (!currentTrack || tracks.length === 0) return;
        
        // Check queue first
        if (queue.length > 0) {
            const nextFromQueue = queue[0];
            setQueue(prev => prev.slice(1));
            await playTrack(nextFromQueue);
            return;
        }
        
        const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
        const nextIndex = getNextTrackIndex(currentIndex, 1);
        await playTrack(tracks[nextIndex]);
    };

    const prevTrack = async () => {
        if (!currentTrack || tracks.length === 0) return;

        // If we're more than 3 seconds in, restart current track
        if (currentTime > 3) {
            await seek(0);
            return;
        }

        const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
        const prevIndex = getNextTrackIndex(currentIndex, -1);
        await playTrack(tracks[prevIndex]);
    };

    const toggleShuffle = () => {
        setShuffle(prev => !prev);
    };

    const toggleRepeat = () => {
        setRepeatMode(prev => {
            if (prev === "off") return "all";
            if (prev === "all") return "one";
            return "off";
        });
    };

    const addToQueue = (track: Track) => {
        setQueue(prev => [...prev, track]);
    };

    const removeFromQueue = (trackId: string) => {
        setQueue(prev => prev.filter(t => t.id !== trackId));
    };

    const clearQueue = () => {
        setQueue([]);
    };

    const clearLibrary = () => {
        setTracks([]);
        setCurrentTrack(null);
        setQueue([]);
        localStorage.removeItem(STORAGE_KEYS.TRACKS);
    };

    const queueNextTrack = async (track: Track) => {
        try {
            await invoke("queue_next_track", { path: track.path });
        } catch (e) {
            console.error("Failed to queue next track:", e);
        }
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
