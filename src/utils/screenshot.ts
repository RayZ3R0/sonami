import {
    getScreenshotableWindows,
    getWindowScreenshot,
} from "tauri-plugin-screenshots-api";

export interface ScreenshotResult {
    path: string;
    success: boolean;
    error?: string;
}

/**
 * Capture a screenshot of the Sonami application window.
 * Uses native window capture via xcap for high-quality output.
 * @returns Promise with the path to the saved screenshot
 */
export async function captureAppScreenshot(): Promise<ScreenshotResult> {
    try {
        const windows = await getScreenshotableWindows();

        // Find the Sonami window by title
        const sonamiWindow = windows.find(
            (w: { title: string; appName?: string }) =>
                w.title.toLowerCase().includes("sonami") ||
                w.appName?.toLowerCase().includes("sonami")
        );

        if (!sonamiWindow) {
            // Fallback: use the first available window if Sonami not found by name
            if (windows.length === 0) {
                return {
                    path: "",
                    success: false,
                    error: "No windows available to capture",
                };
            }
            console.warn(
                "Sonami window not found by name, using first available window"
            );
        }

        const targetWindow = sonamiWindow || windows[0];

        // Capture the window screenshot
        const screenshotPath = await getWindowScreenshot(targetWindow.id);

        return {
            path: screenshotPath,
            success: true,
        };
    } catch (error) {
        return {
            path: "",
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
