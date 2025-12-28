import { Sidebar } from "../Sidebar";
import { PlayerBar } from "../PlayerBar";
import { TitleBar } from "../TitleBar";
import { MainStage } from "../MainStage";
import { QueueSidebar } from "../QueueSidebar";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useAudioEvents } from "../../hooks/useAudioEvents";
import { useState } from "react";

export const AppLayout = () => {
    // Enable keyboard shortcuts
    useKeyboardShortcuts();

    // Listen for audio events (errors, device changes) and show toasts
    useAudioEvents();

    const [activeTab, setActiveTab] = useState('home');

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-theme text-theme-primary">
            <TitleBar />

            <div className="flex flex-1 pt-[var(--titlebar-h)] overflow-hidden">
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                <MainStage activeTab={activeTab} />
                <QueueSidebar />
            </div>

            <PlayerBar />
        </div>
    );
};
