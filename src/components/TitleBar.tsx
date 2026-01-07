import { useEffect, useState } from "react";
import { Window } from "@tauri-apps/api/window";
import { type } from "@tauri-apps/plugin-os";


const MinusIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10.2 1" fill="currentColor">
        <rect width="10.2" height="1" rx="0.5" />
    </svg>
);

const SquareIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
        <rect x="0.5" y="0.5" width="9" height="9" rx="1.5" />
    </svg>
);

const XIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
        <path d="M9.35355 0.646447C9.54882 0.451184 9.8654 0.451184 10.0607 0.646447C10.2559 0.841709 10.2559 1.15829 10.0607 1.35355L5.70711 5.70711L10.0607 10.0607C10.2559 10.2559 10.2559 10.5725 10.0607 10.7678C9.8654 10.963 9.54882 10.963 9.35355 10.7678L5 6.41421L0.646447 10.7678C0.451184 10.963 0.134602 10.963 -0.0606602 10.7678C-0.255922 10.5725 -0.255922 10.2559 -0.0606602 10.0607L4.29289 5.70711L-0.0606602 1.35355C-0.255922 1.15829 -0.255922 0.841709 -0.0606602 0.646447C0.134602 0.451184 0.451184 0.451184 0.646447 0.646447L5 5L9.35355 0.646447Z" />
    </svg>
);

interface TitleBarProps {
    onSearchClick?: () => void;
    activeTab?: string;
    setActiveTab?: (tab: string) => void;
}

export const TitleBar = ({ onSearchClick, activeTab, setActiveTab }: TitleBarProps) => {


    const [osType, setOsType] = useState<string>("windows");

    useEffect(() => {
        async function init() {
            try {

                const platform = await type();
                setOsType(platform);
            } catch (e) {
                console.error("Failed to get OS type", e);
            }
        }
        init();
    }, []);

    const appWindow = new Window("main");

    const minimize = () => appWindow.minimize();
    const maximize = () => appWindow.toggleMaximize();
    const close = () => appWindow.close();

    const isMac = osType === "macos";

    return (
        <div
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between select-none"
            style={{
                height: "var(--titlebar-h)",
                backgroundColor: "transparent",
                // We make it transparent here because Sidebar curve will handle the corner visual.
                // Or we keep background but distinct. User said "seamless join".
                // Let's keep transparent or consistent bg.
            }}
            data-tauri-drag-region
        >
            {/* Left Section (Mac Controls & Home) */}
            <div className="flex items-center pl-4 h-full pointer-events-none gap-4" style={{ width: '240px' }}>
                {isMac && (
                    <div className="flex gap-2 pointer-events-auto no-drag mr-2">
                        {/* Mac Traffic Lights */}
                        <div onClick={close} className="traffic-light traffic-light-close" />
                        <div onClick={minimize} className="traffic-light traffic-light-minimize" />
                        <div onClick={maximize} className="traffic-light traffic-light-maximize" />
                    </div>
                )}

                {/* Home Button moved here */}
                {setActiveTab && (
                    <button
                        onClick={() => setActiveTab('home')}
                        className={`pointer-events-auto no-drag flex items-center justify-center p-2 rounded-lg transition-all ${activeTab === 'home'
                            ? 'bg-theme-surface-active text-theme-primary'
                            : 'text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover'
                            }`}
                        title="Home"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Center Section - Search Button */}
            <div className="flex-1 flex items-center justify-center pointer-events-none px-4 pl-32">
                <button
                    onClick={onSearchClick}
                    className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-theme-surface/60 hover:bg-theme-surface/80 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all pointer-events-auto no-drag cursor-pointer group w-full max-w-xl shadow-lg hover:shadow-xl hover:scale-[1.01]"
                >
                    <svg className="w-4 h-4 text-theme-muted group-hover:text-theme-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="text-sm flex-1 text-left text-theme-muted group-hover:text-theme-primary transition-colors pt-[2px]">Search music...</span>
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-theme-background/30 text-[11px] font-mono text-theme-muted/70">
                        {isMac ? '⌘' : 'Ctrl'}+K
                    </kbd>
                </button>
            </div>

            {/* Right Section (Windows/Linux Controls) */}
            <div className="flex items-center justify-end h-full" style={{ width: '200px' }}>
                {!isMac && (
                    <div className="flex h-full no-drag">
                        <button
                            onClick={minimize}
                            className="window-control"
                        >
                            <MinusIcon />
                        </button>
                        <button
                            onClick={maximize}
                            className="window-control"
                        >
                            <SquareIcon />
                        </button>
                        <button
                            onClick={close}
                            className="window-control window-control-close"
                        >
                            <div className="scale-75"><XIcon /></div>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
