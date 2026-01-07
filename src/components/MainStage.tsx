import { PlaylistView } from "./PlaylistView";
import { HomeView } from "./HomeView";

export const MainStage = ({ activeTab }: { activeTab: string }) => {
    // If activeTab is a playlist
    if (activeTab.startsWith('playlist:')) {
        const playlistId = activeTab.split(':')[1];
        return <PlaylistView playlistId={playlistId} />;
    }

    // Home View (default)
    return <HomeView />;
};
