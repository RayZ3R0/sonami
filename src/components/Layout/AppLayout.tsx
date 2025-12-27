import { Sidebar } from "../Sidebar";
import { PlayerBar } from "../PlayerBar";
import { TitleBar } from "../TitleBar";
import { MainStage } from "../MainStage";

export const AppLayout = () => {
    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--app-bg)] text-white">
            <TitleBar />

            <div className="flex flex-1 pt-[var(--titlebar-h)] overflow-hidden">
                <Sidebar />
                <MainStage />
            </div>

            <PlayerBar />
        </div>
    );
};
