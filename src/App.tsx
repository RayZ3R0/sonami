import { AppLayout } from "./components/Layout/AppLayout";
import "./styles.css";

import { PlayerProvider } from "./context/PlayerContext";
import { ThemeProvider } from "./context/ThemeContext";

function App() {
  return (
    <ThemeProvider>
      <PlayerProvider>
        <AppLayout />
      </PlayerProvider>
    </ThemeProvider>
  );
}

export default App;
