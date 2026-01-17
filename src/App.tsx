import { AppLayout } from "./components/Layout/AppLayout";
import "./styles.css";

import { PlayerProvider } from "./context/PlayerContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DownloadProvider } from "./context/DownloadContext";
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
              <InputController />
              <AppLayout />
            </DownloadProvider>
          </PlayerProvider>
        </ContextMenuProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
