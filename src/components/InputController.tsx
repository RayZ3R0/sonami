import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

/**
 * Headless component that handles global keyboard shortcuts.
 * Render this once at the root level (inside PlayerProvider).
 * It returns null so it doesn't affect layout, but it will consume
 * PlaybackProgressContext and re-render frequently (which is fine since it has no DOM).
 */
export const InputController = () => {
    useKeyboardShortcuts();
    return null;
};
