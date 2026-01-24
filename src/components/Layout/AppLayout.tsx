import { Sidebar } from "../Sidebar";
import { PlayerBar } from "../PlayerBar";
import { TitleBar } from "../TitleBar";
import { MainStage } from "../MainStage";
import { QueueSidebar } from "../QueueSidebar";
import { SearchPalette } from "../SearchPalette";
import { SpotifyImportIndicator } from "../SpotifyImportIndicator";
import { useAudioEvents } from "../../hooks/useAudioEvents";
import { useState, useEffect, useCallback } from "react";
import { usePlayer } from "../../context/PlayerContext";
import { Settings } from "../Settings";

export const AppLayout = () => {
  useAudioEvents();
  const { isQueueOpen } = usePlayer();

  const [activeTab, setActiveTab] = useState("home");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"appearance" | "playback">(
    "appearance",
  );
  const { setIsSettingsOpen, isSettingsOpen, setIsQueueOpen } = usePlayer();

  const handleOpenSettings = useCallback(
    (tab: "appearance" | "playback") => {
      if (isSettingsOpen && settingsTab === tab) {
        setIsSettingsOpen(false);
      } else {
        setSettingsTab(tab);
        setIsSettingsOpen(true);
        setIsQueueOpen(false);
      }
    },
    [isSettingsOpen, settingsTab, setIsSettingsOpen, setIsQueueOpen],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        handleOpenSettings("playback");
      }
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    },
    [handleOpenSettings],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  const handleSearchNavigate = useCallback((tab: string) => {
    setActiveTab(tab);
    setIsSearchOpen(false);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-theme text-theme-primary">
      <TitleBar
        onSearchClick={openSearch}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={handleOpenSettings}
      />

      <div className="flex flex-1 pt-[var(--titlebar-h)] overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        <div
          className={`flex-1 flex flex-col relative overflow-hidden bg-theme-background-secondary rounded-tl-2xl shadow-[0_0_20px_rgba(0,0,0,0.3)] z-30 transition-all duration-300 ${
            isQueueOpen || isSettingsOpen ? "rounded-tr-2xl" : ""
          }`}
        >
          <MainStage activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        <Settings
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          defaultTab={settingsTab}
        />

        <QueueSidebar />
      </div>

      <PlayerBar onNavigate={setActiveTab} />

      <SearchPalette
        isOpen={isSearchOpen}
        onClose={closeSearch}
        onNavigate={handleSearchNavigate}
      />

      <SpotifyImportIndicator />
    </div>
  );
};
