import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Track } from "../types";

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
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
    const [tracks, setTracks] = useState<Track[]>([]);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const [volume, setVolumeState] = useState(1.0);

    // Time Tracking & Auto-Advance
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isPlaying) {
            interval = setInterval(() => {
                setCurrentTime(prev => {
                    if (prev >= duration && duration > 0) {
                        return duration;
                    }
                    return prev + 0.1;
                });
            }, 100);
        }
        return () => clearInterval(interval);
    }, [isPlaying, duration]);

    // Separate effect for Auto-Advance
    useEffect(() => {
        if (currentTime >= duration && duration > 0 && isPlaying) {
            nextTrack();
        }
    }, [currentTime, duration, isPlaying]);

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
            await invoke("play_track", { path: track.path });
            await invoke("set_volume", { volume });
            setCurrentTrack(track);
            setIsPlaying(true);
            setCurrentTime(0);
            setDuration(track.duration);
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
            setCurrentTime(time);
            await invoke("seek_track", { position: time });
        } catch (e) {
            console.error("Failed to seek:", e);
        }
    }

    const setVolume = async (vol: number) => {
        setVolumeState(vol);
        try {
            await invoke("set_volume", { volume: vol });
        } catch (e) {
            console.error("Failed to set volume:", e);
        }
    }

    const nextTrack = async () => {
        if (!currentTrack || tracks.length === 0) return;
        const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
        const nextIndex = (currentIndex + 1) % tracks.length;
        await playTrack(tracks[nextIndex]);
    };

    const prevTrack = async () => {
        if (!currentTrack || tracks.length === 0) return;
        const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
        const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
        await playTrack(tracks[prevIndex]);
    };

    return (
        <PlayerContext.Provider value={{
            tracks, currentTrack, isPlaying, currentTime, duration, volume,
            importMusic, playTrack, togglePlay, seek, setVolume, nextTrack, prevTrack
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
