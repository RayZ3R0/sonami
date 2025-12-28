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
    const trackEndHandled = useRef(false);  // Prevent duplicate track end handling
    const lastPositionRef = useRef(0);  // Track last position for detecting position reset
    const shufflePositionRef = useRef(0);   // Track position in shuffle order
    const handleTrackEndRef = useRef<(() => Promise<void>) | null>(null);  // Ref to avoid stale closures

    // Refs to track current state for handleTrackEnd (avoids stale closures)
    const tracksRef = useRef(tracks);
    const currentTrackRef = useRef(currentTrack);
    const repeatModeRef = useRef(repeatMode);
    const queueRef = useRef(queue);
    const shuffleRef = useRef(shuffle);

    // Keep refs in sync with state
    useEffect(() => { tracksRef.current = tracks; }, [tracks]);
    useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
    useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);
    useEffect(() => { queueRef.current = queue; }, [queue]);
    useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);

    // Persist tracks to localStorage and update shuffle if needed
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(tracks));
        // Regenerate shuffle order when tracks change and shuffle is on
        if (shuffle && tracks.length > 0 && shuffledIndices.current.length !== tracks.length) {
            shuffledIndices.current = generateShuffleOrder(tracks.length);
            shufflePositionRef.current = 0;
        }
    }, [tracks, shuffle]);

    // Persist settings
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.VOLUME, volume.toString());
    }, [volume]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.SHUFFLE, shuffle.toString());
        // Regenerate shuffle order when toggling shuffle ON
        if (shuffle && tracks.length > 0) {
            const newOrder = generateShuffleOrder(tracks.length);
            shuffledIndices.current = newOrder;
            // If we have a current track, put it at the start of shuffle order
            if (currentTrack) {
                const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
                if (currentIndex >= 0) {
                    // Remove current index from its position and put at start
                    const filtered = newOrder.filter(i => i !== currentIndex);
                    shuffledIndices.current = [currentIndex, ...filtered];
                    shufflePositionRef.current = 0;
                }
            }
        }
    }, [shuffle]);

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
    // Returns: { index: number, isEndOfList: boolean }
    const getNextTrackIndex = useCallback((currentIndex: number, direction: 1 | -1 = 1): { index: number; isEndOfList: boolean } => {
        if (tracks.length === 0) return { index: -1, isEndOfList: true };

        if (shuffle) {
            // Find current position in shuffle order
            let shufflePos = shuffledIndices.current.indexOf(currentIndex);
            if (shufflePos === -1) shufflePos = shufflePositionRef.current;

            const nextShufflePos = shufflePos + direction;

            // Check if we've reached end/start of shuffle order
            if (nextShufflePos >= shuffledIndices.current.length) {
                // End of shuffle - wrap to start
                shufflePositionRef.current = 0;
                return { index: shuffledIndices.current[0], isEndOfList: true };
            } else if (nextShufflePos < 0) {
                // Start of shuffle - wrap to end
                shufflePositionRef.current = shuffledIndices.current.length - 1;
                return { index: shuffledIndices.current[shuffledIndices.current.length - 1], isEndOfList: false };
            }

            shufflePositionRef.current = nextShufflePos;
            return { index: shuffledIndices.current[nextShufflePos], isEndOfList: false };
        }

        // Normal sequential mode
        const nextIndex = currentIndex + direction;
        if (nextIndex >= tracks.length) {
            return { index: 0, isEndOfList: true };
        } else if (nextIndex < 0) {
            return { index: tracks.length - 1, isEndOfList: false };
        }
        return { index: nextIndex, isEndOfList: false };
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

                    const prevPosition = lastPositionRef.current;
                    lastPositionRef.current = info.position;

                    // Handle track load sync - when position resets to near 0, track is loaded
                    if (pendingTrackLoad.current !== null) {
                        if (info.position < 1.0) {
                            pendingTrackLoad.current = null;
                            trackEndHandled.current = false;  // Reset for new track
                            setCurrentTime(info.position);
                            setIsPlaying(info.is_playing);
                        }
                        // Otherwise keep showing 0 until backend catches up
                    } else if (!isSeeking.current) {
                        setCurrentTime(info.position);
                        setIsPlaying(info.is_playing);
                    }

                    // Update duration if it changed (new track)
                    if (info.duration > 0) {
                        setDuration(info.duration);
                    }

                    // INDUSTRY STANDARD TRACK END DETECTION:
                    // The backend sets is_playing=false when the decoder hits EOF.
                    // We detect track-end when:
                    // 1. Backend says not playing (!info.is_playing)
                    // 2. Position was near the end (prevPosition was > 80% of duration)
                    // 3. We haven't already handled this track end
                    // 4. No pending track load (not in the middle of loading a new track)
                    const wasNearEnd = prevPosition > 0 && info.duration > 0 && prevPosition >= info.duration * 0.8;
                    const backendStopped = !info.is_playing;
                    const shouldTriggerEnd = backendStopped && wasNearEnd && !trackEndHandled.current && pendingTrackLoad.current === null;

                    if (currentTrack && shouldTriggerEnd) {
                        console.log('[TrackEnd] Detected:', {
                            prevPosition,
                            duration: info.duration,
                            repeatMode: repeatModeRef.current,
                        });
                        trackEndHandled.current = true;
                        // Use setTimeout to break out of the poll cycle
                        setTimeout(() => {
                            handleTrackEndRef.current?.();
                        }, 0);
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

    // Helper to play a track (used by handleTrackEnd to avoid circular deps)
    const playTrackById = async (trackId: string) => {
        const track = tracksRef.current.find(t => t.id === trackId);
        if (!track) return;

        try {
            pendingTrackLoad.current = track.id;
            setCurrentTime(0);
            setDuration(track.duration);
            setCurrentTrack(track);

            await invoke("play_track", { path: track.path });
            await invoke("set_volume", { volume });
            setIsPlaying(true);
            lastTrackId.current = track.id;
        } catch (e) {
            console.error("Failed to play track:", e);
        }
    };

    // Get next track index using refs (for handleTrackEnd)
    const getNextTrackIndexFromRefs = (currentIndex: number, direction: 1 | -1 = 1): { index: number; isEndOfList: boolean } => {
        const trackCount = tracksRef.current.length;
        if (trackCount === 0) return { index: -1, isEndOfList: true };

        if (shuffleRef.current) {
            let shufflePos = shuffledIndices.current.indexOf(currentIndex);
            if (shufflePos === -1) shufflePos = shufflePositionRef.current;

            const nextShufflePos = shufflePos + direction;

            if (nextShufflePos >= shuffledIndices.current.length) {
                shufflePositionRef.current = 0;
                return { index: shuffledIndices.current[0], isEndOfList: true };
            } else if (nextShufflePos < 0) {
                shufflePositionRef.current = shuffledIndices.current.length - 1;
                return { index: shuffledIndices.current[shuffledIndices.current.length - 1], isEndOfList: false };
            }

            shufflePositionRef.current = nextShufflePos;
            return { index: shuffledIndices.current[nextShufflePos], isEndOfList: false };
        }

        const nextIndex = currentIndex + direction;
        if (nextIndex >= trackCount) {
            return { index: 0, isEndOfList: true };
        } else if (nextIndex < 0) {
            return { index: trackCount - 1, isEndOfList: false };
        }
        return { index: nextIndex, isEndOfList: false };
    };

    const handleTrackEnd = async () => {
        const tracks = tracksRef.current;
        const currentTrack = currentTrackRef.current;
        const repeatMode = repeatModeRef.current;
        const queue = queueRef.current;

        console.log('[handleTrackEnd] Called with:', {
            repeatMode,
            tracksCount: tracks.length,
            hasCurrentTrack: !!currentTrack,
            queueLength: queue.length,
        });

        if (!currentTrack || tracks.length === 0) {
            console.log('[handleTrackEnd] Early return - no track or empty tracks');
            return;
        }

        // Handle repeat one mode - RELOAD the track from scratch
        // IMPORTANT: At EOF, the backend decoder is destroyed, so seek won't work.
        // Industry standard (Spotify, VLC, etc.) is to reload the track.
        if (repeatMode === "one") {
            console.log('[handleTrackEnd] Repeat ONE - reloading track:', currentTrack.title);
            try {
                pendingTrackLoad.current = currentTrack.id;
                setCurrentTime(0);
                await invoke("play_track", { path: currentTrack.path });
                setIsPlaying(true);
                console.log('[handleTrackEnd] Repeat ONE - track reloaded');
            } catch (e) {
                console.error("Failed to repeat track:", e);
                trackEndHandled.current = false;
            }
            return;
        }

        // Check if there are tracks in the manual queue
        if (queue.length > 0) {
            console.log('[handleTrackEnd] Playing from queue');
            const nextFromQueue = queue[0];
            setQueue(prev => prev.slice(1));
            await playTrackById(nextFromQueue.id);
            return;
        }

        const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
        const { index: nextIndex, isEndOfList } = getNextTrackIndexFromRefs(currentIndex, 1);

        console.log('[handleTrackEnd] Navigation:', {
            currentIndex,
            nextIndex,
            isEndOfList,
            repeatMode,
        });

        // Handle end of playlist
        if (isEndOfList && repeatMode === "off") {
            // End of playlist with no repeat - stop playback
            console.log('[handleTrackEnd] End of playlist, repeat OFF - stopping');
            setIsPlaying(false);
            return;
        }

        // Play next track (loops if repeat all, or continues shuffle order)
        if (nextIndex >= 0 && nextIndex < tracks.length) {
            console.log('[handleTrackEnd] Playing next track:', tracks[nextIndex].title);
            await playTrackById(tracks[nextIndex].id);
        } else {
            console.log('[handleTrackEnd] Invalid next index:', nextIndex);
        }
    };

    // Keep the ref updated with latest handleTrackEnd
    useEffect(() => {
        handleTrackEndRef.current = handleTrackEnd;
    });

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
            // Use existing queue or calculate next track based on shuffle/repeat
            if (queue.length > 0) {
                await invoke("queue_next_track", { path: queue[0].path });
            } else {
                const currentIndex = tracks.findIndex(t => t.id === track.id);
                // Use getNextTrackIndex to respect shuffle/repeat logic
                // Pass direction 1, and we don't care about isEndOfList here usually, 
                // but we should check if valid index returned.
                // NOTE: We need to access the LATEST shuffle state. 
                // Since this is async/closure, 'shuffle' var might be stale if not careful, 
                // but playTrack is recreated on render or we use refs.
                // getNextTrackIndex uses refs internally so it should be fine? 
                // Wait, getNextTrackIndex uses 'shuffle' from closure scope or 'shuffle.current'? 
                // It uses [shuffle, tracks.length] dependency.

                // Better to use the ref-based helper we created for handleTrackEnd to be safe?
                // yes, getNextTrackIndexFromRefs

                const { index: nextIndex } = getNextTrackIndexFromRefs(currentIndex, 1);

                if (nextIndex >= 0 && nextIndex < tracks.length) {
                    // Don't queue if it's the same track unless repeat is one?
                    // Actually if repeat=one, we DO want to queue it for gapless loop.
                    await invoke("queue_next_track", { path: tracks[nextIndex].path });
                }
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
        const { index: nextIndex } = getNextTrackIndex(currentIndex, 1);
        if (nextIndex >= 0 && nextIndex < tracks.length) {
            await playTrack(tracks[nextIndex]);
        }
    };

    const prevTrack = async () => {
        if (!currentTrack || tracks.length === 0) return;

        // If we're more than 3 seconds in, restart current track (Spotify behavior)
        if (currentTime > 3) {
            await seek(0);
            return;
        }

        const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
        const { index: prevIndex } = getNextTrackIndex(currentIndex, -1);
        if (prevIndex >= 0 && prevIndex < tracks.length) {
            await playTrack(tracks[prevIndex]);
        }
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
