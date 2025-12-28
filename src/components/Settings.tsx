import { useState, useEffect } from "react";
import { useTheme, Theme } from "../context/ThemeContext";
import { usePlayer } from "../context/PlayerContext";

const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
    </svg>
);

const PaletteIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
        <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
        <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
        <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
    </svg>
);

const SettingsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);


const ThemePreviewCard = ({
    theme,
    isActive,
    onClick
}: {
    theme: Theme;
    isActive: boolean;
    onClick: () => void;
}) => {
    const colors = theme.colors;

    return (
        <button
            onClick={onClick}
            className={`
                relative group w-full p-3 rounded-xl transition-all duration-200
                ${isActive
                    ? "ring-2 ring-offset-2 ring-offset-transparent"
                    : "hover:scale-[1.02]"
                }
            `}
            style={{
                background: colors.background,
                borderColor: isActive ? colors.accent : colors.border,
                borderWidth: "1px",
                borderStyle: "solid",
                // @ts-ignore
                "--tw-ring-color": colors.accent,
            }}
        >

            <div className="flex gap-2 mb-2">

                <div
                    className="w-8 h-16 rounded-md flex flex-col gap-1 p-1"
                    style={{ background: colors.surface }}
                >
                    <div className="w-full h-1.5 rounded-full" style={{ background: colors.surfaceActive }} />
                    <div className="w-full h-1.5 rounded-full opacity-50" style={{ background: colors.textMuted }} />
                    <div className="w-full h-1.5 rounded-full opacity-50" style={{ background: colors.textMuted }} />
                </div>


                <div className="flex-1 flex flex-col gap-1.5">
                    <div className="w-3/4 h-2 rounded-full" style={{ background: colors.textPrimary }} />
                    <div className="flex gap-1">
                        <div className="w-6 h-6 rounded-md" style={{ background: colors.surfaceHover }} />
                        <div className="w-6 h-6 rounded-md" style={{ background: colors.surfaceHover }} />
                        <div className="w-6 h-6 rounded-md" style={{ background: colors.surfaceHover }} />
                    </div>
                </div>
            </div>


            <div
                className="w-full h-6 rounded-lg flex items-center px-2 gap-2"
                style={{ background: colors.glass }}
            >
                <div className="w-3 h-3 rounded-sm" style={{ background: colors.surfaceHover }} />
                <div className="flex-1 h-1 rounded-full" style={{ background: colors.progressTrack }}>
                    <div className="w-1/3 h-full rounded-full" style={{ background: colors.progressFillGradient }} />
                </div>
                <div
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: colors.accent }}
                >
                    <div className="w-0 h-0 border-l-[4px] border-t-[2.5px] border-b-[2.5px] border-l-current border-t-transparent border-b-transparent ml-0.5" style={{ color: colors.textInverse }} />
                </div>
            </div>


            <div className="mt-2 flex items-center justify-between">
                <span
                    className="text-xs font-medium"
                    style={{ color: colors.textPrimary }}
                >
                    {theme.name}
                </span>

                {isActive && (
                    <div
                        className="w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: colors.accent, color: colors.textInverse }}
                    >
                        <CheckIcon />
                    </div>
                )}
            </div>


            <div className="mt-2 flex gap-1">
                <div className="w-4 h-4 rounded-full border" style={{ background: colors.accent, borderColor: colors.border }} />
                <div className="w-4 h-4 rounded-full border" style={{ background: colors.textPrimary, borderColor: colors.border }} />
                <div className="w-4 h-4 rounded-full border" style={{ background: colors.surface, borderColor: colors.border }} />
                <div className="w-4 h-4 rounded-full border" style={{ background: colors.background, borderColor: colors.border }} />
            </div>
        </button>
    );
};

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
    defaultTab?: "appearance" | "playback";
}

export const Settings = ({ isOpen, onClose, defaultTab = "appearance" }: SettingsProps) => {
    const { theme, themeId, availableThemes, setTheme } = useTheme();
    const { crossfadeEnabled, crossfadeDuration, setCrossfade } = usePlayer();
    const [activeTab, setActiveTab] = useState<"appearance" | "playback">(defaultTab);

    // Reset active tab when modal opens or defaultTab changes
    useEffect(() => {
        if (isOpen) {
            setActiveTab(defaultTab);
        }
    }, [isOpen, defaultTab]);

    if (!isOpen) return null;

    // Group themes by type (light/dark)
    const lightThemes = availableThemes.filter(t =>
        t.id.includes("latte") ||
        t.id.includes("light") ||
        t.id === "matcha" ||
        t.id === "cotton-candy-dreams"
    );
    const darkThemes = availableThemes.filter(t => !lightThemes.includes(t));

    const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
        <button
            onClick={() => onChange(!checked)}
            className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-theme-accent' : 'bg-theme-surface-active'}`}
            style={{ backgroundColor: checked ? theme.colors.accent : theme.colors.surfaceActive }}
        >
            <div
                className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
            />
        </button>
    );

    return (
        <>
            <div
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            <div
                className="fixed inset-y-0 right-0 z-[101] w-full max-w-lg flex flex-col animate-slide-in-right"
                style={{
                    background: `linear-gradient(135deg, ${theme.colors.background} 0%, ${theme.colors.backgroundSecondary} 100%)`,
                    borderLeft: `1px solid ${theme.colors.border}`,
                }}
            >
                <div
                    className="flex items-center justify-between px-6 py-4 border-b"
                    style={{ borderColor: theme.colors.border }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: theme.colors.surfaceHover }}
                        >
                            <SettingsIcon />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold" style={{ color: theme.colors.textPrimary }}>
                                Settings
                            </h2>
                            <p className="text-xs" style={{ color: theme.colors.textMuted }}>
                                Manage your preferences
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                        style={{
                            color: theme.colors.textSecondary,
                            background: "transparent",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = theme.colors.surfaceHover}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                        <CloseIcon />
                    </button>
                </div>

                <div className="flex border-b" style={{ borderColor: theme.colors.border }}>
                    <button
                        className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === "appearance" ? "text-theme-primary" : "text-theme-muted"}`}
                        onClick={() => setActiveTab("appearance")}
                        style={{ color: activeTab === "appearance" ? theme.colors.textPrimary : theme.colors.textSecondary }}
                    >
                        Appearance
                        {activeTab === "appearance" && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: theme.colors.accent }} />
                        )}
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === "playback" ? "text-theme-primary" : "text-theme-muted"}`}
                        onClick={() => setActiveTab("playback")}
                        style={{ color: activeTab === "playback" ? theme.colors.textPrimary : theme.colors.textSecondary }}
                    >
                        Playback
                        {activeTab === "playback" && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: theme.colors.accent }} />
                        )}
                    </button>
                </div>


                <div className="flex-1 overflow-y-auto px-6 py-6 no-scrollbar">
                    {activeTab === "appearance" && (
                        <div>
                            <div className="mb-8">
                                <h3
                                    className="text-xs font-semibold uppercase tracking-wider mb-4"
                                    style={{ color: theme.colors.textMuted }}
                                >
                                    Dark Themes
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {darkThemes.map((t) => (
                                        <ThemePreviewCard
                                            key={t.id}
                                            theme={t}
                                            isActive={themeId === t.id}
                                            onClick={() => setTheme(t.id)}
                                        />
                                    ))}
                                </div>
                            </div>

                            {lightThemes.length > 0 && (
                                <div>
                                    <h3
                                        className="text-xs font-semibold uppercase tracking-wider mb-4"
                                        style={{ color: theme.colors.textMuted }}
                                    >
                                        Light Themes
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {lightThemes.map((t) => (
                                            <ThemePreviewCard
                                                key={t.id}
                                                theme={t}
                                                isActive={themeId === t.id}
                                                onClick={() => setTheme(t.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "playback" && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: theme.colors.surface }}>
                                <div>
                                    <h3 className="font-medium" style={{ color: theme.colors.textPrimary }}>Crossfade Songs</h3>
                                    <p className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
                                        Fade tracks into each other for seamless playback
                                    </p>
                                </div>
                                <Toggle
                                    checked={crossfadeEnabled}
                                    onChange={(checked) => setCrossfade(checked, crossfadeDuration)}
                                />
                            </div>

                            {crossfadeEnabled && (
                                <div className="p-4 rounded-xl space-y-4" style={{ background: theme.colors.surface }}>
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-medium" style={{ color: theme.colors.textPrimary }}>Duration</h3>
                                        <span className="text-sm font-mono" style={{ color: theme.colors.accent }}>{crossfadeDuration / 1000}s</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1000"
                                        max="12000"
                                        step="1000"
                                        value={crossfadeDuration}
                                        onChange={(e) => setCrossfade(true, parseInt(e.target.value))}
                                        className="w-full h-1 rounded-full appearance-none cursor-pointer"
                                        style={{
                                            background: `linear-gradient(to right, ${theme.colors.accent} 0%, ${theme.colors.accent} ${(crossfadeDuration - 1000) / 11000 * 100}%, ${theme.colors.surfaceActive} ${(crossfadeDuration - 1000) / 11000 * 100}%, ${theme.colors.surfaceActive} 100%)`
                                        }}
                                    />
                                    <div className="flex justify-between text-xs" style={{ color: theme.colors.textMuted }}>
                                        <span>1s</span>
                                        <span>12s</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>


                <div
                    className="px-6 py-4 border-t"
                    style={{ borderColor: theme.colors.border }}
                >
                    <p className="text-xs text-center" style={{ color: theme.colors.textMuted }}>
                        Settings are saved automatically
                    </p>
                </div>
            </div>
        </>
    );
};

// Re-export specific buttons if needed, or simple wrappers
export const SettingsButton = ({ onClick }: { onClick: () => void }) => {
    return (
        <button
            onClick={onClick}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover"
            title="Settings"
        >
            <SettingsIcon />
        </button>
    );
};

export const ThemeButton = ({ onClick }: { onClick: () => void }) => {
    return (
        <button
            onClick={onClick}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover"
            title="Change Theme"
        >
            <PaletteIcon />
        </button>
    );
};
