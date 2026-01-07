import { PlaylistView } from "./PlaylistView";
import { HomeView } from "./HomeView";
import { LikedSongsView } from "./LikedSongsView";

export const MainStage = ({ activeTab }: { activeTab: string }) => {
  // If activeTab is a playlist
  if (activeTab.startsWith("playlist:")) {
    const playlistId = activeTab.split(":")[1];
    return <PlaylistView playlistId={playlistId} />;
  }

  // Liked Songs / Favorites
  if (activeTab === "favorites") {
    return <LikedSongsView />;
  }

  // Home View (default)
  return <HomeView />;
};
