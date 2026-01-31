
import { usePlayer } from "../../context/PlayerContext";

interface MobileLibraryProps {
    onNavigate: (tab: string) => void;
}

export const MobileLibrary = ({ onNavigate }: MobileLibraryProps) => {
    const { playlists } = usePlayer();

    return (
        <div className="flex flex-col h-full w-full overflow-y-auto px-4 pb-24 pt-4">
            <h1 className="text-3xl font-bold text-white mb-6">Library</h1>

            {/* Fixed Items */}
            <div className="space-y-2 mb-8">
                <button
                    onClick={() => onNavigate("favorites")}
                    className="w-full flex items-center p-4 bg-theme-surface/50 hover:bg-theme-surface rounded-xl transition-all active:scale-[0.98] group"
                >
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center mr-4 shadow-lg group-hover:shadow-purple-500/20 transition-shadow">
                        <svg
                            className="w-6 h-6 text-white"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="font-bold text-lg text-theme-primary">
                            Liked Songs
                        </span>
                        <span className="text-sm text-theme-muted">Auto-generated</span>
                    </div>
                </button>
            </div>

            {/* Playlists */}
            <div>
                <h2 className="text-xl font-bold text-theme-primary mb-4 px-2">
                    Playlists
                </h2>

                {playlists.length === 0 ? (
                    <div className="text-center py-10 text-theme-muted">
                        No playlists found. Create one on desktop!
                    </div>
                ) : (
                    <div className="space-y-2">
                        {playlists.map((playlist) => (
                            <button
                                key={playlist.id}
                                onClick={() => onNavigate(`playlist:${playlist.id}`)}
                                className="w-full flex items-center p-3 hover:bg-theme-surface/30 rounded-lg transition-colors"
                            >
                                <div className="w-12 h-12 rounded bg-theme-surface-active flex items-center justify-center mr-4">
                                    <svg
                                        className="w-6 h-6 text-theme-muted"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                    </svg>
                                </div>
                                <div className="flex flex-col items-start min-w-0">
                                    <span className="font-medium text-theme-primary truncate w-full text-left">
                                        {playlist.title}
                                    </span>
                                    <span className="text-xs text-theme-muted">
                                        Playlist
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
