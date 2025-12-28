import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useToast } from "../components/Toast";

// Event payloads from backend
interface AudioError {
    code: string;
    title: string;
    message: string;
}

interface DeviceChanged {
    device_name: string;
}

/**
 * Hook that listens to audio events from the backend and displays toast notifications
 */
export const useAudioEvents = () => {
    const { addToast } = useToast();

    useEffect(() => {
        // Listen for audio errors
        const unlistenError = listen<AudioError>("audio-error", (event) => {
            const { title, message, code } = event.payload;
            console.error(`[Audio Error] ${code}: ${title} - ${message}`);

            addToast({
                type: "error",
                title,
                message,
                duration: code === "NO_DEVICE" ? 0 : 6000, // Persistent for no device
            });
        });

        // Listen for device changes
        const unlistenDevice = listen<DeviceChanged>("device-changed", (event) => {
            const { device_name } = event.payload;
            console.log(`[Audio] Device changed to: ${device_name}`);

            addToast({
                type: "info",
                title: "Audio Device Changed",
                message: `Now playing through: ${device_name}`,
                duration: 3000,
            });
        });

        // Listen for track ended (optional - could show "Up next" notification)
        const unlistenTrackEnded = listen("track-ended", () => {
            // Silent - track change notification is handled by PlayerContext
        });

        return () => {
            unlistenError.then((f) => f());
            unlistenDevice.then((f) => f());
            unlistenTrackEnded.then((f) => f());
        };
    }, [addToast]);
};
