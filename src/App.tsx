import { AppLayout } from "./components/Layout/AppLayout";
import "./styles.css";

import { PlayerProvider } from "./context/PlayerContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DownloadProvider } from "./context/DownloadContext";
import { SpotifyImportProvider } from "./context/SpotifyImportContext";
import { ToastProvider } from "./components/Toast";
import { InputController } from "./components/InputController";
import { ContextMenuProvider } from "./context/ContextMenuContext";

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ContextMenuProvider>
          <PlayerProvider>
            <DownloadProvider>
              <SpotifyImportProvider>
                <InputController />
                <AppLayout />
              </SpotifyImportProvider>
            </DownloadProvider>
          </PlayerProvider>
        </ContextMenuProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;

