import { useState, useCallback, useEffect } from "react";
import { MainStage } from "../../components/MainStage";
import { BottomNav } from "./BottomNav";
import { SpotifyImportIndicator } from "../../components/SpotifyImportIndicator";
import { useAudioEvents } from "../../hooks/useAudioEvents";
import { MobileTopBar } from "./MobileTopBar";
import { MobilePlayerBar } from "../../components/MobilePlayerBar";
import { usePlayer } from "../../context/PlayerContext";
import { MobileSettings } from "./MobileSettings";

export const MobileLayout = () => {
  useAudioEvents();
  const [activeTab, setActiveTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const { isSettingsOpen, setIsSettingsOpen } = usePlayer();

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setActiveTab(`search:${query}`);
  }, []);

  // Sync search query if activeTab implies it (e.g. from bottom nav click)
  useEffect(() => {
    if (activeTab === "search" && !searchQuery) {
      // Focus or init
    } else if (activeTab === "home" || activeTab === "library") {
      setSearchQuery("");
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-theme text-theme-primary select-none">
      {isSettingsOpen ? (
        <MobileSettings onBack={() => setIsSettingsOpen(false)} />
      ) : (
        <>
          <MobileTopBar
            activeTab={activeTab}
            onSearchClick={() => setActiveTab("search")}
            onSettingsClick={() => setIsSettingsOpen(true)}
            query={searchQuery}
            onQueryChange={handleSearchChange}
          />

          <div className="flex-1 overflow-hidden relative bg-theme-background-secondary pt-16">
            <MainStage activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>

          <MobilePlayerBar onNavigate={setActiveTab} />

          <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

          <SpotifyImportIndicator />
        </>
      )}
    </div>
  );
};
