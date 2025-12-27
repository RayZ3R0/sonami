import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Track } from "../types";

interface PlaybackInfo {
    position: number;
    duration: number;
    is_playing: boolean;
}

interface PlayerContextType {
    tracks: Track[];
    currentTrack: Track | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    importMusic: () => Promise<void>;
    playTrack: (track: Track) => Promise<void>;
    togglePlay: () => Promise<void>;
    seek: (time: number) => Promise<void>;
    setVolume: (vol: number) => Promise<void>;
    nextTrack: () => Promise<void>;
    prevTrack: () => Promise<void>;
    queueNextTrack: (track: Track) => Promise<void>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolumeState] = useState(1.0);
    
    // Track if we're seeking to avoid position jumps
    const isSeeking = useRef(false);
    const pendingTrackLoad = useRef<string | null>(null);
    const lastTrackId = useRef<string | null>(null);

    // Poll playback info from backend (sample-accurate position)
    useEffect(() => {
        let animationId: number;
        let lastPollTime = 0;
        const POLL_INTERVAL = 50; // Poll every 50ms for smooth updates

        const pollPlaybackInfo = async (timestamp: number) => {
            if (timestamp - lastPollTime >= POLL_INTERVAL) {
                lastPollTime = timestamp;
                
                try {
                    const info = await invoke<PlaybackInfo>("get_playback_info");
                    
                    // Update playing state from backend
                    setIsPlaying(info.is_playing);
                    
                    // If we're waiting for a track to load, check if backend reset position
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
                        // Track finished, auto-advance
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

    // Handle track ending - auto advance to next
    const handleTrackEnd = useCallback(async () => {
        if (!currentTrack || tracks.length === 0) return;
        
        const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
        if (currentIndex < tracks.length - 1) {
            // There's a next track
            const nextIndex = currentIndex + 1;
            await playTrack(tracks[nextIndex]);
        } else {
            // End of playlist
            setIsPlaying(false);
        }
    }, [currentTrack, tracks]);

    const importMusic = async () => {
        try {
            const newTracks = await invoke<Track[]>("import_music");
            if (newTracks && newTracks.length > 0) {
                setTracks(prev => [...prev, ...newTracks]);
            }
        } catch (e) {
            console.error("Failed to import music:", e);
        }
    };

    const playTrack = async (track: Track) => {
        try {
            // Mark that we're loading a new track - polling will show 0 until backend confirms
            pendingTrackLoad.current = track.id;
            setCurrentTime(0);
            setDuration(track.duration);
            setCurrentTrack(track);
            
            await invoke("play_track", { path: track.path });
            await invoke("set_volume", { volume });
            setIsPlaying(true);
            lastTrackId.current = track.id;
            
            // Queue next track for gapless playback
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
        const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
        const nextIndex = (currentIndex + 1) % tracks.length;
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
        const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
        await playTrack(tracks[prevIndex]);
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
            importMusic, playTrack, togglePlay, seek, setVolume, nextTrack, prevTrack, queueNextTrack
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
