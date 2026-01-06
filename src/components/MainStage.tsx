import { PlaylistView } from "./PlaylistView";
import { TidalSearch } from "./TidalSearch";
import { LibraryView } from "./LibraryView";

export const MainStage = ({ activeTab }: { activeTab: string }) => {
    // Search View
    if (activeTab === 'search') {
        return <TidalSearch />;
    }

    // If activeTab is a playlist
    if (activeTab.startsWith('playlist:')) {
        const playlistId = activeTab.split(':')[1];
        return <PlaylistView playlistId={playlistId} />;
    }

    // Library / Home View
    return <LibraryView />;
};
