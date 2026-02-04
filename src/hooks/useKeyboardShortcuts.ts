import { useEffect } from "react";
import { usePlayer, usePlaybackProgress } from "../context/PlayerContext";

export const useKeyboardShortcuts = () => {
  const {
    togglePlay,
    nextTrack,
    prevTrack,
    volume,
    setVolume,
    seek,
    toggleShuffle,
    toggleRepeat,
    currentTrack,
    isQueueOpen,
    setIsQueueOpen,
  } = usePlayer();

  const { currentTime, duration } = usePlaybackProgress();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;

        case "ArrowRight":
          if (e.shiftKey) {
            // Skip to next track
            nextTrack();
          } else if (currentTrack) {
            // Seek forward 5 seconds
            e.preventDefault();
            const newTime = Math.min(currentTime + 5, duration);
            seek(newTime);
          }
          break;

        case "ArrowLeft":
          if (e.shiftKey) {
            // Skip to previous track
            prevTrack();
          } else if (currentTrack) {
            // Seek backward 5 seconds
            e.preventDefault();
            const newTime = Math.max(currentTime - 5, 0);
            seek(newTime);
          }
          break;

        case "ArrowUp":
          e.preventDefault();
          setVolume(Math.min(volume + 0.1, 1));
          break;

        case "ArrowDown":
          e.preventDefault();
          setVolume(Math.max(volume - 0.1, 0));
          break;

        case "KeyM":
          // Mute/unmute
          setVolume(volume > 0 ? 0 : 1);
          break;

        case "KeyS":
          // Toggle shuffle
          if (!e.ctrlKey && !e.metaKey) {
            toggleShuffle();
          }
          break;

        case "KeyR":
          // Toggle repeat
          if (!e.ctrlKey && !e.metaKey) {
            toggleRepeat();
          }
          break;

        case "KeyQ":
          // Toggle queue sidebar
          if (!e.ctrlKey && !e.metaKey) {
            setIsQueueOpen(!isQueueOpen);
          }
          break;

        case "Digit0":
        case "Numpad0":
          if (currentTrack) {
            seek(0);
          }
          break;

        // Number keys 1-9 for percentage seeking
        case "Digit1":
        case "Digit2":
        case "Digit3":
        case "Digit4":
        case "Digit5":
        case "Digit6":
        case "Digit7":
        case "Digit8":
        case "Digit9":
          if (currentTrack && !e.ctrlKey && !e.metaKey) {
            const num = parseInt(e.code.replace("Digit", ""));
            seek((num / 10) * duration);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    togglePlay,
    nextTrack,
    prevTrack,
    volume,
    setVolume,
    seek,
    currentTime,
    duration,
    toggleShuffle,
    toggleRepeat,
    currentTrack,
    isQueueOpen,
    setIsQueueOpen,
  ]);
};
