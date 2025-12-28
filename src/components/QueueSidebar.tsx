import { usePlayer } from "../context/PlayerContext";
import { Track } from "../types";

const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const ChevronRightIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
    </svg>
);

const RemoveIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

const QueueTrackItem = ({ 
    track, 
    index, 
    onPlay, 
    onRemove,
    isCurrent 
}: { 
    track: Track; 
    index: number; 
    onPlay: () => void;
    onRemove?: () => void;
    isCurrent?: boolean;
}) => (
    <div 
        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
            isCurrent 
                ? 'bg-theme-surface-active' 
                : 'hover:bg-theme-surface-hover'
        }`}
        onClick={onPlay}
    >
        <span className="w-6 text-xs text-theme-muted text-center flex-shrink-0">
            {isCurrent ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-theme-accent mx-auto">
                    <path d="M8 5v14l11-7z" />
                </svg>
            ) : (
                index + 1
            )}
        </span>
        
        <div className="w-10 h-10 rounded-md bg-theme-secondary overflow-hidden flex-shrink-0">
            {track.cover_image ? (
                <img src={track.cover_image} alt={track.title} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-theme-muted">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                </div>
            )}
        </div>
        
        <div className="flex-1 min-w-0">
            <p className={`text-sm truncate ${isCurrent ? 'text-theme-accent font-medium' : 'text-theme-primary'}`}>
                {track.title}
            </p>
            <p className="text-xs text-theme-muted truncate">{track.artist}</p>
        </div>
        
        <span className="text-xs text-theme-muted flex-shrink-0">{formatDuration(track.duration)}</span>
        
        {onRemove && (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                className="p-1 rounded-md text-theme-muted hover:text-theme-error hover:bg-theme-surface-hover transition-colors flex-shrink-0"
            >
                <RemoveIcon />
            </button>
        )}
    </div>
);

export const QueueSidebar = () => {
    const { queue, tracks, currentTrack, playTrack, removeFromQueue, clearQueue, isQueueOpen, setIsQueueOpen } = usePlayer();

    // Get upcoming tracks from the library (excluding current)
    const currentIndex = currentTrack ? tracks.findIndex(t => t.id === currentTrack.id) : -1;
    const upcomingLibraryTracks = currentIndex >= 0 
        ? tracks.slice(currentIndex + 1, currentIndex + 20) 
        : [];

    return (
        <div 
            className={`h-full flex-shrink-0 bg-theme-sidebar border-l border-theme transition-all duration-300 ease-in-out overflow-hidden ${
                isQueueOpen ? 'w-80' : 'w-0'
            }`}
        >
            <div className="w-80 h-full flex flex-col">
                {/* Header */}
                <div className="px-4 py-4 border-b border-theme flex items-center justify-between flex-shrink-0">
                    <h3 className="font-semibold text-theme-primary">Queue</h3>
                    <div className="flex items-center gap-2">
                        {queue.length > 0 && (
                            <button
                                onClick={clearQueue}
                                className="text-xs text-theme-muted hover:text-theme-primary transition-colors"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            onClick={() => setIsQueueOpen(false)}
                            className="p-1 rounded-md text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors"
                            title="Close queue"
                        >
                            <ChevronRightIcon />
                        </button>
                    </div>
                </div>
                
                {/* Content */}
                <div className="overflow-y-auto flex-1 py-2 pb-32">
                    {/* Now Playing */}
                    {currentTrack && (
                        <div className="px-3 mb-4">
                            <h4 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2 px-1">
                                Now Playing
                            </h4>
                            <QueueTrackItem
                                track={currentTrack}
                                index={0}
                                onPlay={() => {}}
                                isCurrent
                            />
                        </div>
                    )}
                    
                    {/* Manual Queue */}
                    {queue.length > 0 && (
                        <div className="px-3 mb-4">
                            <h4 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2 px-1">
                                Next in Queue
                            </h4>
                            {queue.map((track, index) => (
                                <QueueTrackItem
                                    key={`queue-${track.id}`}
                                    track={track}
                                    index={index}
                                    onPlay={() => playTrack(track)}
                                    onRemove={() => removeFromQueue(track.id)}
                                />
                            ))}
                        </div>
                    )}
                    
                    {/* Upcoming from Library */}
                    {upcomingLibraryTracks.length > 0 && (
                        <div className="px-3">
                            <h4 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-2 px-1">
                                Up Next
                            </h4>
                            {upcomingLibraryTracks.map((track, index) => (
                                <QueueTrackItem
                                    key={`upcoming-${track.id}`}
                                    track={track}
                                    index={index}
                                    onPlay={() => playTrack(track)}
                                />
                            ))}
                        </div>
                    )}
                    
                    {/* Empty State */}
                    {!currentTrack && queue.length === 0 && (
                        <div className="px-4 py-8 text-center">
                            <p className="text-theme-muted text-sm">No tracks in queue</p>
                            <p className="text-theme-muted text-xs mt-1">Play a song to get started</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
