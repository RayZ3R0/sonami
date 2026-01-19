import { useState, useEffect } from "react";
import { AppLayout } from "./components/Layout/AppLayout";
import { WelcomePage } from "./components/WelcomePage";
import { libraryHasData } from "./api/library";
import "./styles.css";

import { PlayerProvider } from "./context/PlayerContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DownloadProvider } from "./context/DownloadContext";
import { SpotifyImportProvider } from "./context/SpotifyImportContext";
import { ToastProvider } from "./components/Toast";
import { InputController } from "./components/InputController";
import { ContextMenuProvider } from "./context/ContextMenuContext";

function App() {
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

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
                {showOnboarding ? (
                  <WelcomePage onComplete={() => setShowOnboarding(false)} />
                ) : (
                  <AppLayout />
                )}
              </SpotifyImportProvider>
            </DownloadProvider>
          </PlayerProvider>
        </ContextMenuProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
