import { PlaylistView } from "./PlaylistView";
import { HomeView } from "./HomeView";
import { LikedSongsView } from "./LikedSongsView";

export const MainStage = ({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) => {
  // If activeTab is a playlist
  if (activeTab.startsWith("playlist:")) {
    const playlistId = activeTab.split(":")[1];
    return <PlaylistView playlistId={playlistId} onNavigate={setActiveTab} />;
  }

  // Liked Songs / Favorites
  if (activeTab === "favorites") {
    return <LikedSongsView />;
  }

  // Home View (default)
  return <HomeView />;
};
