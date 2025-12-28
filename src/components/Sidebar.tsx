import { useState } from "react";
import { usePlayer } from "../context/PlayerContext";
import { Settings, SettingsButton } from "./Settings";
import { CreatePlaylistModal } from "./CreatePlaylistModal";

// Unified icon wrapper - guarantees consistent sizing and alignment
const Icon = ({ children }: { children: React.ReactNode }) => (
    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        {children}
    </span>
);

// All icons use identical viewBox and size
const icons = {
    home: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    ),
    search: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
        </svg>
    ),
    library: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
    ),
    heart: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
    ),
    clock: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    ),
    plus: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M12 5v14M5 12h14" />
        </svg>
    ),
    folder: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
    ),
    trash: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    ),
    plusSmall: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M12 5v14M5 12h14" />
        </svg>
    ),
    music: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-white/90">
            <path d="M9 18V5l12-2v13" />
        </svg>
    ),
};

export const Sidebar = ({
    activeTab,
    setActiveTab
}: {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}) => {
    const { importMusic, importFolder, tracks, clearLibrary, playlists } = usePlayer();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);

    // ====== MANUAL TEXT OFFSET ======
    const textOffsetY = '2.1px';  // positive = down, negative = up
    const playlistPlusOffsetY = '-4.6px';  // offset for playlist + icon
    const playlistTextOffsetY = '2px';  // offset for playlist names
    const buttonTextOffsetY = '1.6px';  // offset for File/Folder button texts
    // ==============================================================================

    const NavButton = ({
        id,
        icon,
        label
    }: {
        id: string;
        icon: React.ReactNode;
        label: string;
    }) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive
                        ? 'bg-theme-accent text-theme-inverse'
                        : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover'
                    }`}
            >
                <Icon>{icon}</Icon>
                <span className="text-[13px] font-medium" style={{ transform: `translateY(${textOffsetY})` }}>{label}</span>
            </button>
        );
    };

    const QuickAccessButton = ({
        id,
        icon,
        label
    }: {
        id: string;
        icon: React.ReactNode;
        label: string;
    }) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-200 ${isActive
                        ? 'bg-theme-surface-active text-theme-primary'
                        : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover'
                    }`}
            >
                <Icon>{icon}</Icon>
                <span className="text-[13px]" style={{ transform: `translateY(${textOffsetY})` }}>{label}</span>
            </button>
        );
    };

    return (
        <>
            <div
                className="flex flex-col h-full z-20 relative py-4 px-3 flex-shrink-0"
                style={{ width: "var(--sidebar-w)", background: "transparent" }}
            >
                {/* Main Navigation */}
                <nav className="flex flex-col gap-1 mb-6">
                    <NavButton id="home" icon={icons.home} label="Home" />
                    <NavButton id="search" icon={icons.search} label="Search" />
                    <NavButton id="library" icon={icons.library} label="Your Library" />
                </nav>

                {/* Quick Access */}
                <div className="mb-6">
                    <div className="flex items-center justify-between px-3 mb-2">
                        <span className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider">Quick Access</span>
                    </div>
                    <nav className="flex flex-col gap-0.5">
                        <QuickAccessButton id="favorites" icon={icons.heart} label="Liked Songs" />
                        <QuickAccessButton id="recent" icon={icons.clock} label="Recently Played" />
                    </nav>
                </div>

                {/* Playlists */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <div className="flex items-center justify-between px-3 mb-2 overflow-visible">
                        <span className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider">Playlists</span>
                        <button
                            className="w-6 h-6 flex items-center justify-center rounded-md text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors"
                            style={{ transform: `translateY(${playlistPlusOffsetY})` }}
                            onClick={() => setIsCreatePlaylistOpen(true)}
                        >
                            {icons.plusSmall}
                        </button>
                    </div>
                    <div className="flex flex-col gap-0.5 overflow-y-auto no-scrollbar flex-1 pr-1">
                        {playlists.map((pl) => (
                            <button
                                key={pl.id}
                                onClick={() => setActiveTab(`playlist:${pl.id}`)}
                                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-all duration-200 ${activeTab === `playlist:${pl.id}`
                                        ? 'bg-theme-surface-active text-theme-primary'
                                        : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover'
                                    }`}
                            >
                                <span className={`w-8 h-8 rounded-md bg-theme-surface flex items-center justify-center flex-shrink-0 shadow-sm text-theme-muted`}>
                                    {icons.music}
                                </span>
                                <span className="text-[13px] truncate" style={{ transform: `translateY(${playlistTextOffsetY})` }}>{pl.name}</span>
                            </button>
                        ))}
                        {playlists.length === 0 && (
                            <div className="px-3 py-4 text-center">
                                <p className="text-xs text-theme-muted mb-2">No playlists yet</p>
                                <button
                                    onClick={() => setIsCreatePlaylistOpen(true)}
                                    className="text-xs text-theme-accent hover:underline"
                                >
                                    Create one
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 mt-auto flex flex-col gap-2">
                    {/* Import Buttons Row */}
                    <div className="flex gap-2">
                        <button
                            onClick={importMusic}
                            className="flex-1 btn-primary"
                            title="Add single file"
                        >
                            {icons.plus}
                            <span className="leading-none" style={{ transform: `translateY(${buttonTextOffsetY})` }}>File</span>
                        </button>
                        <button
                            onClick={importFolder}
                            className="flex-1 btn-primary"
                            title="Add folder"
                        >
                            {icons.folder}
                            <span className="leading-none" style={{ transform: `translateY(${buttonTextOffsetY})` }}>Folder</span>
                        </button>
                    </div>

                    {/* Settings Row */}
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs text-theme-muted">Preferences</span>
                        <div className="flex items-center gap-2">
                            {tracks.length > 0 && (
                                <button
                                    onClick={clearLibrary}
                                    className="p-1.5 rounded-md text-theme-muted hover:text-theme-error hover:bg-theme-surface-hover transition-colors"
                                    title="Clear library"
                                >
                                    {icons.trash}
                                </button>
                            )}
                            <SettingsButton onClick={() => setIsSettingsOpen(true)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Panel */}
            <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            {/* Create Playlist Modal */}
            <CreatePlaylistModal isOpen={isCreatePlaylistOpen} onClose={() => setIsCreatePlaylistOpen(false)} />
        </>
    );
};