import { Sidebar } from "../Sidebar";
import { PlayerBar } from "../PlayerBar";
import { TitleBar } from "../TitleBar";
import { MainStage } from "../MainStage";
import { QueueSidebar } from "../QueueSidebar";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

export const AppLayout = () => {
    // Enable keyboard shortcuts
    useKeyboardShortcuts();

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-theme text-theme-primary">
            <TitleBar />

            <div className="flex flex-1 pt-[var(--titlebar-h)] overflow-hidden">
                <Sidebar />
                <MainStage />
                <QueueSidebar />
            </div>

            <PlayerBar />
        </div>
    );
};
