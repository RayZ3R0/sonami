import { PlaylistView } from "./PlaylistView";
import { HomeView } from "./HomeView";
import { LikedSongsView } from "./LikedSongsView";
import { SearchPage } from "./SearchPage";
import { AlbumPage } from "./AlbumPage";
import { ArtistPage } from "./ArtistPage";

export const MainStage = ({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) => {
  if (activeTab.startsWith("playlist:")) {
    const playlistId = activeTab.split(":")[1];
    return <PlaylistView playlistId={playlistId} onNavigate={setActiveTab} />;
  }

  if (activeTab === "favorites") {
    return <LikedSongsView />;
  }

  if (activeTab === "search" || activeTab.startsWith("search:")) {
    const queryMatch = activeTab.match(/^search:(.*)$/);
    const initialQuery = queryMatch ? queryMatch[1] : "";
    return <SearchPage initialQuery={initialQuery} onNavigate={setActiveTab} />;
  }

  if (activeTab.startsWith("album:")) {
    const albumId = activeTab.replace("album:", "");
    return <AlbumPage albumId={albumId} onNavigate={setActiveTab} />;
  }

  if (activeTab.startsWith("artist:")) {
    const artistId = activeTab.replace("artist:", "");
    return <ArtistPage artistId={artistId} onNavigate={setActiveTab} />;
  }

  return <HomeView />;
};
