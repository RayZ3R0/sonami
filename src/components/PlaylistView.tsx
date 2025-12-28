import { usePlayer } from "../context/PlayerContext";
import { useState } from "react";


interface PlaylistViewProps {
    playlistId: string;
}

export const PlaylistView = ({ playlistId }: PlaylistViewProps) => {
    const { playlists, playTrack, currentTrack, removeFromPlaylist, deletePlaylist, renamePlaylist } = usePlayer();

    // Find the current playlist
    const playlist = playlists.find(p => p.id === playlistId);

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");

    if (!playlist) {
        return (
            <div className="flex-1 flex items-center justify-center text-theme-muted">
                Playlist not found or deleted.
            </div>
        );
    }

    const handleRename = () => {
        if (editName.trim()) {
            renamePlaylist(playlist.id, editName.trim());
        }
        setIsEditing(false);
    };

    const startEdit = () => {
        setEditName(playlist.name);
        setIsEditing(true);
    };

    const handleDelete = () => {
        if (confirm(`Are you sure you want to delete "${playlist.name}"?`)) {
            deletePlaylist(playlist.id);
            // Parent MainStage/Sidebar should handle navigation change ideally, 
            // but Sidebar activeTab might need reset if current tab deleted.
        }
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex-1 h-full overflow-y-auto relative no-scrollbar pb-40">
            <div className="absolute top-0 left-0 w-full h-[400px] gradient-top pointer-events-none -z-10 opacity-60" />

            <div className="p-8 pt-10">
                <div className="flex items-end gap-6 mb-8">
                    <div className="w-48 h-48 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-2xl flex items-center justify-center text-white/20">
                        <svg className="w-20 h-20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18V5l12-2v13" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold uppercase tracking-wider text-white/80">Playlist</span>
                        {isEditing ? (
                            <input
                                className="block w-full text-5xl font-black text-theme-primary bg-transparent border-b border-theme-primary/20 focus:border-theme-primary focus:outline-none mb-4"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={handleRename}
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                autoFocus
                            />
                        ) : (
                            <h1
                                className="text-5xl font-black text-theme-primary mb-4 truncate cursor-pointer hover:underline decoration-2 underline-offset-4 decoration-white/20"
                                onClick={startEdit}
                                title="Click to rename"
                            >
                                {playlist.name}
                            </h1>
                        )}
                        <div className="flex items-center gap-2 text-sm text-theme-muted">
                            <span className="font-semibold text-white">{playlist.tracks.length} tracks</span>
                            <span>•</span>
                            <button onClick={handleDelete} className="hover:text-theme-error transition-colors">
                                Delete Playlist
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col">
                    {/* Header Row */}
                    <div className="grid grid-cols-[16px_1fr_1fr_48px] gap-4 px-4 py-2 border-b border-white/5 text-xs text-theme-muted uppercase tracking-wider mb-2">
                        <span>#</span>
                        <span>Title</span>
                        <span>Album</span>
                        <span className="text-right">Time</span>
                    </div>

                    {playlist.tracks.length === 0 ? (
                        <div className="py-10 text-center text-theme-muted text-sm">
                            This playlist is empty. Right-click songs in your library to add them here.
                        </div>
                    ) : (
                        playlist.tracks.map((track, index) => {
                            const isPlaying = currentTrack?.id === track.id;
                            return (
                                <div
                                    key={`${track.id}-${index}`}
                                    className={`grid grid-cols-[16px_1fr_1fr_48px] gap-4 px-4 py-2.5 rounded-md group hover:bg-white/5 transition-colors items-center text-sm cursor-default ${isPlaying ? 'text-theme-accent' : 'text-theme-secondary'}`}
                                    onDoubleClick={() => playTrack(track, playlist.tracks)}
                                    // Add context menu for removing later
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        if (confirm(`Remove "${track.title}" from playlist?`)) {
                                            removeFromPlaylist(playlist.id, track.id);
                                        }
                                    }}
                                >
                                    <div className="opacity-60 group-hover:opacity-100 w-4 text-center">
                                        {isPlaying ? (
                                            <span className="animate-pulse">▶</span>
                                        ) : (
                                            <>
                                                <span className="group-hover:hidden">{index + 1}</span>
                                                <button
                                                    className="hidden group-hover:block w-4 text-theme-primary"
                                                    onClick={() => playTrack(track, playlist.tracks)}
                                                >
                                                    ▶
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 min-w-0">
                                        {track.cover_image && (
                                            <img src={track.cover_image} className="w-8 h-8 rounded object-cover shadow-sm hidden md:block" alt="" />
                                        )}
                                        <div className="flex flex-col min-w-0">
                                            <span className={`font-medium truncate ${isPlaying ? 'text-theme-accent' : 'text-theme-primary'}`}>{track.title}</span>
                                            <span className="text-xs text-theme-muted truncate md:hidden">{track.artist}</span>
                                        </div>
                                    </div>
                                    <div className="truncate text-theme-muted hidden md:block">{track.album}</div>
                                    <div className="text-right text-theme-muted font-variant-numeric tabular-nums">{formatDuration(track.duration)}</div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
