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

export const TitleBar = () => {
    
    
    
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
                backgroundColor: "var(--theme-overlay-light)",
                backdropFilter: "blur(0px)"
            }}
            data-tauri-drag-region
        >
            {/* Left Section (Mac Controls or Title) */}
            <div className="flex items-center pl-4 h-full pointer-events-none">
                {isMac && (
                    <div className="flex gap-2 pointer-events-auto no-drag">
                        {/* Mac Traffic Lights */}
                        <div onClick={close} className="traffic-light traffic-light-close" />
                        <div onClick={minimize} className="traffic-light traffic-light-minimize" />
                        <div onClick={maximize} className="traffic-light traffic-light-maximize" />
                    </div>
                )}
                {!isMac && <div className="text-xs font-semibold tracking-wide text-theme-muted ml-2">SONAMI</div>}
            </div>

            {/* Right Section (Windows/Linux Controls) */}
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
    );
};
