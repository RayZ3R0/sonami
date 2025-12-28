import { AppLayout } from "./components/Layout/AppLayout";
import "./styles.css";

import { PlayerProvider } from "./context/PlayerContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./components/Toast";
import { InputController } from "./components/InputController";

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <PlayerProvider>
          <InputController />
          <AppLayout />
        </PlayerProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
