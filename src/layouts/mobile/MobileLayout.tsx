import { useState } from "react";
import { MainStage } from "../../components/MainStage";
import { BottomNav } from "./BottomNav";
import { SpotifyImportIndicator } from "../../components/SpotifyImportIndicator";
import { useAudioEvents } from "../../hooks/useAudioEvents";
import { TitleBar } from "../../components/TitleBar";
import { PlayerBar } from "../../components/PlayerBar";

export const MobileLayout = () => {
    useAudioEvents();
    const [activeTab, setActiveTab] = useState("home");

    // Mobile specific handlers could go here
    const openSearch = () => setActiveTab("search");
    const handleOpenSettings = () => {
        // Future: Navigate to settings view on mobile
        console.log("Open Settings Mobile");
    };

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-theme text-theme-primary">
            {/* Mobile Header - Reuse TitleBar for now but could simplify */}
            <TitleBar
                onSearchClick={openSearch}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onOpenSettings={handleOpenSettings}
                isMobile={true}
            />

            <div className="flex-1 overflow-hidden relative bg-theme-background-secondary">
                <MainStage activeTab={activeTab} setActiveTab={setActiveTab} />
            </div>

            {/* 
        TODO: MiniPlayer should go here. 
        For now reusing PlayerBar but it might need adaptation or a specific MobilePlayerBar 
       */}
            <div className="mb-0">
                <PlayerBar onNavigate={setActiveTab} isMobile={true} />
            </div>

            <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

            <SpotifyImportIndicator />
        </div>
    );
};
