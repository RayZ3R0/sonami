import { usePlayer } from "../context/PlayerContext";

export const MainStage = () => {
    const { tracks, playTrack } = usePlayer();

    return (
        <div className="flex-1 h-full overflow-y-auto relative no-scrollbar pb-40">
            {/* Background Ambient Glow */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#1a1a20] to-transparent pointer-events-none -z-10" />

            <div className="p-8 pt-6">
                <h1 className="text-4xl font-bold mb-8 tracking-tight">Listen Now</h1>

                {tracks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 opacity-50 border-2 border-dashed border-white/10 rounded-2xl">
                        <p className="text-xl font-bold mb-2">Your Library is Empty</p>
                        <p className="text-sm">Click "Import Music" in the sidebar to add FLAC/MP3s.</p>
                    </div>
                ) : (
                    <div>
                        <h2 className="text-xl font-bold text-white/90 mb-4">Your Library</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                            {tracks.map(track => (
                                <div key={track.id} className="group cursor-pointer" onClick={() => playTrack(track)}>
                                    <div className="aspect-square w-full rounded-lg shadow-lg mb-3 bg-zinc-800 relative overflow-hidden group-hover:scale-[1.02] transition-transform">
                                        {track.cover_image ? (
                                            <img src={track.cover_image} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 text-white/20">
                                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                                            </div>
                                        )}

                                        {/* Play Overlay */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-all">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className="font-semibold truncate text-[15px]">{track.title}</h3>
                                    <p className="text-sm text-gray-500 truncate">{track.artist}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
