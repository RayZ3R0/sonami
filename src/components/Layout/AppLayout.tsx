import { Sidebar } from "../Sidebar";
import { PlayerBar } from "../PlayerBar";
import { TitleBar } from "../TitleBar";
import { MainStage } from "../MainStage";
import { QueueSidebar } from "../QueueSidebar";
import { SearchPalette } from "../SearchPalette";
import { useAudioEvents } from "../../hooks/useAudioEvents";
import { useState, useEffect, useCallback } from "react";

export const AppLayout = () => {
    useAudioEvents();

    const [activeTab, setActiveTab] = useState('home');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Global keyboard shortcut for search (Cmd/Ctrl + K)
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Cmd+K or Ctrl+K to open search
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            setIsSearchOpen(true);
        }
        // Also support "/" to open search when not in an input
        if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
            e.preventDefault();
            setIsSearchOpen(true);
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const openSearch = useCallback(() => setIsSearchOpen(true), []);
    const closeSearch = useCallback(() => setIsSearchOpen(false), []);

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-theme text-theme-primary">
            <TitleBar onSearchClick={openSearch} />

            <div className="flex flex-1 pt-[var(--titlebar-h)] overflow-hidden">
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                <MainStage activeTab={activeTab} />
                <QueueSidebar />
            </div>

            <PlayerBar />

            {/* Search Palette */}
            <SearchPalette isOpen={isSearchOpen} onClose={closeSearch} />
        </div>
    );
};
