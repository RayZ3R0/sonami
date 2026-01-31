
interface BottomNavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const HomeIcon = ({ active }: { active: boolean }) => (
    <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? "0" : "2"}
        className="w-6 h-6 mb-1"
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
);

const LibraryIcon = ({ active }: { active: boolean }) => (
    <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? "0" : "2"}
        className="w-6 h-6 mb-1"
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
);

const SearchIcon = ({ active }: { active: boolean }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2" // Search usually stays outlined or gets thicker
        className={`w-6 h-6 mb-1 ${active ? "stroke-[3px]" : "stroke-2"}`}
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

export const BottomNav = ({ activeTab, setActiveTab }: BottomNavProps) => {
    return (
        <div className="flex items-center justify-around h-[80px] bg-[#0a0a0f]/95 backdrop-blur-lg border-t border-white/5 safe-area-bottom">
            <button
                onClick={() => setActiveTab("home")}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 w-16 ${activeTab === "home"
                    ? "text-theme-accent scale-105"
                    : "text-theme-muted hover:text-white"
                    }`}
            >
                <HomeIcon active={activeTab === "home"} />
                <span className="text-[10px] font-medium tracking-wide">
                    Home
                </span>
            </button>

            <button
                onClick={() => setActiveTab("library")}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 w-16 ${activeTab === "library" || activeTab.startsWith("playlist:") || activeTab === "favorites"
                    ? "text-theme-accent scale-105"
                    : "text-theme-muted hover:text-white"
                    }`}
            >
                <LibraryIcon active={activeTab === "library" || activeTab.startsWith("playlist:") || activeTab === "favorites"} />
                <span className="text-[10px] font-medium tracking-wide">
                    Library
                </span>
            </button>

            <button
                onClick={() => setActiveTab("search")}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 w-16 ${activeTab === "search" || activeTab.startsWith("search:")
                    ? "text-theme-accent scale-105"
                    : "text-theme-muted hover:text-white"
                    }`}
            >
                <SearchIcon active={activeTab === "search" || activeTab.startsWith("search:")} />
                <span className="text-[10px] font-medium tracking-wide">
                    Search
                </span>
            </button>
        </div>
    );
};
