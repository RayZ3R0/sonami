import { usePlayer } from "../context/PlayerContext";

// Using simplified SVG icons with cleaner lines (Apple style)
const Icon = ({ d }: { d: string }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
);

export const Sidebar = () => {
    const { importMusic } = usePlayer();
    const sectionClass = "mb-8";
    const headerClass = "px-6 mb-3 text-xs font-bold text-gray-500 uppercase tracking-widest";
    const itemClass = "h-10 px-6 flex items-center gap-4 text-gray-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer border-l-2 border-transparent hover:border-white";
    const activeItemClass = "h-10 px-6 flex items-center gap-4 text-white bg-white/10 border-l-2 border-[#fa586a] font-medium";

    return (
        <div
            className="flex flex-col h-full z-20 relative pt-4"
            style={{ width: "var(--sidebar-w)", background: "transparent" }}
        >
            <div className={sectionClass}>
                <div className={headerClass}>Discover</div>
                <div className={activeItemClass}>
                    <Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <span>Listen Now</span>
                </div>
                <div className={itemClass}>
                    <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    <span>Browse</span>
                </div>
            </div>

            <div className={sectionClass}>
                <div className={headerClass}>Library</div>
                <div className={itemClass}>
                    <Icon d="M9 18V5l12-2v13" />
                    <span>Songs</span>
                </div>
                <div className={itemClass}>
                    <Icon d="M11 5L6 9H2v6h4l5 4V5z" /> {/* Placeholder for Artist/Mic */}
                    <span>Artists</span>
                </div>
                <div className={itemClass}>
                    <Icon d="M20.2 7.8l-7.7 7.7-4-4-5.7 5.7" />
                    <span>Albums</span>
                </div>
            </div>

            <div className="mx-6 border-t border-white/5 my-4" />

            <div className="px-6 pb-4 flex-1 overflow-hidden flex flex-col">
                <span className={headerClass.replace("px-6", "")}>Playlists</span>
                <div className="mt-4 flex flex-col gap-3 overflow-y-auto no-scrollbar mask-linear-fade flex-1">
                    {["Late Night Jazz", "Gym Phonk", "Deep Focus", "Rust Ace", "Dreamscapes"].map(pl => (
                        <div key={pl} className="text-sm text-gray-400 hover:text-white transition-colors cursor-pointer">
                            {pl}
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Section */}
            <div className="p-6 mt-auto">
                <button
                    onClick={importMusic}
                    className="w-full h-12 border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 text-sm font-medium rounded-xl flex items-center justify-center gap-3 transition-all group backdrop-blur-sm shadow-sm"
                >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors text-white/70 group-hover:text-white pb-[1px]">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                    </div>
                    <span className="text-white/80 group-hover:text-white tracking-wide pt-[1px]">Add Music</span>
                </button>
            </div>
        </div>
    );
};
