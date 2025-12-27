import { AppLayout } from "./components/Layout/AppLayout";
import "./styles.css";

import { PlayerProvider } from "./context/PlayerContext";

function App() {
  return (
    <PlayerProvider>
      <AppLayout />
    </PlayerProvider>
  );
}

export default App;
