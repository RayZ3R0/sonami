import { useState } from "react";
import { usePlayer } from "../context/PlayerContext";
import { Settings, SettingsButton } from "./Settings";

const Icon = ({ d }: { d: string }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
    </svg>
);

const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
    </svg>
);

export const Sidebar = () => {
    const { importMusic } = usePlayer();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const NavItem = ({ icon, label, active = false }: { icon: string; label: string; active?: boolean }) => (
        <div className={`nav-item ${active ? "nav-item-active" : "nav-item-default"}`}>
            <Icon d={icon} />
            <span className="text-[13px] font-medium">{label}</span>
        </div>
    );

    return (
        <>
            <div
                className="flex flex-col h-full z-20 relative py-4 px-4"
                style={{ width: "var(--sidebar-w)", background: "transparent" }}
            >
                {/* Discover Section */}
                <div className="mb-6">
                    <h3 className="section-header">
                        Discover
                    </h3>
                    <nav className="flex flex-col gap-0.5">
                        <NavItem icon="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" label="Listen Now" active />
                        <NavItem icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" label="Browse" />
                    </nav>
                </div>

                {/* Library Section */}
                <div className="mb-6">
                    <h3 className="section-header">
                        Library
                    </h3>
                    <nav className="flex flex-col gap-0.5">
                        <NavItem icon="M9 18V5l12-2v13" label="Songs" />
                        <NavItem icon="M11 5L6 9H2v6h4l5 4V5z" label="Artists" />
                        <NavItem icon="M20.2 7.8l-7.7 7.7-4-4-5.7 5.7" label="Albums" />
                    </nav>
                </div>

                <div className="divider" />

                {/* Playlists Section */}
                <div className="mt-6 flex-1 overflow-hidden flex flex-col">
                    <h3 className="section-header">
                        Playlists
                    </h3>
                    <div className="flex flex-col gap-0.5 overflow-y-auto no-scrollbar flex-1">
                        {["Late Night Jazz", "Gym Phonk", "Deep Focus", "Rust Ace", "Dreamscapes"].map(pl => (
                            <div 
                                key={pl} 
                                className="px-3 py-2 text-[13px] text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover rounded-lg transition-all duration-200 cursor-pointer"
                            >
                                {pl}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 mt-auto flex flex-col gap-2">
                    {/* Add Music Button */}
                    <button
                        onClick={importMusic}
                        className="w-full btn-primary"
                    >
                        <PlusIcon />
                        <span className="leading-none translate-y-[1.5px]">Add Music</span>
                    </button>
                    
                    {/* Settings Row */}
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs text-theme-muted">Preferences</span>
                        <SettingsButton onClick={() => setIsSettingsOpen(true)} />
                    </div>
                </div>
            </div>
            
            {/* Settings Panel */}
            <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </>
    );
};