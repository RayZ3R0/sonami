import { useState, useEffect } from "react";
import { DesktopLayout } from "./layouts/desktop/DesktopLayout";
import { MobileLayout } from "./layouts/mobile/MobileLayout";
import { WelcomePage } from "./components/WelcomePage";
import {
  UpdateNotificationModal,
  useUpdateNotification,
} from "./components/UpdateNotificationModal";
import { libraryHasData } from "./api/library";
import "./styles.css";

import { PlayerProvider } from "./context/PlayerContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DownloadProvider } from "./context/DownloadContext";
import { SpotifyImportProvider } from "./context/SpotifyImportContext";
import { ToastProvider } from "./components/Toast";
import { InputController } from "./components/InputController";
import { ContextMenuProvider } from "./context/ContextMenuContext";
import { useIsMobile } from "./hooks/useIsMobile";
import { usePlayer } from "./context/PlayerContext";

function App() {
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const checkOnboarding = async () => {
      const isComplete = localStorage.getItem("onboarding_complete");

      if (isComplete === "true") {
        setCheckingOnboarding(false);
        return;
      }

      // Check if we have existing data (migration handling)
      try {
        const hasData = await libraryHasData();
        if (hasData) {
          // If we have data, mark as complete implicitly
          localStorage.setItem("onboarding_complete", "true");
          setCheckingOnboarding(false);
        } else {
          // New user
          setShowOnboarding(true);
          setCheckingOnboarding(false);
        }
      } catch (e) {
        console.error("Failed to check library data", e);
        // Fallback to safe default
        setCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, []);

  if (checkingOnboarding) {
    return null; // Or a splash screen
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <ContextMenuProvider>
          <PlayerProvider>
            <DownloadProvider>
              <SpotifyImportProvider>
                <InputController />
                <UpdateNotificationWrapper />
                {showOnboarding ? (
                  <WelcomePage onComplete={() => setShowOnboarding(false)} />
                ) : isMobile ? (
                  <MobileLayout />
                ) : (
                  <DesktopLayout />
                )}
              </SpotifyImportProvider>
            </DownloadProvider>
          </PlayerProvider>
        </ContextMenuProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

// Wrapper component to use the update notification hook inside ThemeProvider
function UpdateNotificationWrapper() {
  const { shouldShow, dismiss } = useUpdateNotification();
  const { openSettings } = usePlayer();

  if (!shouldShow) return null;

  return <UpdateNotificationModal onClose={dismiss} onOpenSettings={() => openSettings("services")} />;
}

export default App;
