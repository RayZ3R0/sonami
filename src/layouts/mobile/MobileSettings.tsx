
import { useState } from "react";
import { useTheme, Theme } from "../../context/ThemeContext";
import { usePlayer } from "../../context/PlayerContext";

const ArrowLeftIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
    </svg>
);

const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
    </svg>
);

const ThemePreviewCard = ({
    theme,
    isActive,
    onClick,
}: {
    theme: Theme;
    isActive: boolean;
    onClick: () => void;
}) => {
    const colors = theme.colors;

    return (
        <button
            onClick={onClick}
            className={`relative group w-full p-3 rounded-xl transition-all duration-200 ${isActive ? "ring-2 ring-offset-2 ring-offset-transparent" : "hover:scale-[1.02]"}`}
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
                <div className="w-8 h-16 rounded-md flex flex-col gap-1 p-1" style={{ background: colors.surface }}>
                    <div className="w-full h-1.5 rounded-full" style={{ background: colors.surfaceActive }} />
                    <div className="w-full h-1.5 rounded-full opacity-50" style={{ background: colors.textMuted }} />
                </div>
                <div className="flex-1 flex flex-col gap-1.5">
                    <div className="w-3/4 h-2 rounded-full" style={{ background: colors.textPrimary }} />
                    <div className="flex gap-1">
                        <div className="w-6 h-6 rounded-md" style={{ background: colors.surfaceHover }} />
                        <div className="w-6 h-6 rounded-md" style={{ background: colors.surfaceHover }} />
                    </div>
                </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: colors.textPrimary }}>{theme.name}</span>
                {isActive && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: colors.accent, color: colors.textInverse }}>
                        <CheckIcon />
                    </div>
                )}
            </div>
        </button>
    );
};

interface MobileSettingsProps {
    onBack: () => void;
}

export const MobileSettings = ({ onBack }: MobileSettingsProps) => {
    const { theme, themeId, availableThemes, setTheme } = useTheme();
    const {
        crossfadeEnabled,
        crossfadeDuration,
        setCrossfade,
        preferHighQualityStream,
        setPreferHighQualityStream,
    } = usePlayer();

    const [activeTab, setActiveTab] = useState<"appearance" | "playback">("appearance");

    // Group themes
    const lightThemes = availableThemes.filter(t => t.id.includes("latte") || t.id.includes("light") || t.id === "matcha" || t.id === "cotton-candy-dreams");
    const darkThemes = availableThemes.filter(t => !lightThemes.includes(t));

    const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
        <button
            onClick={() => onChange(!checked)}
            className={`w-11 h-6 rounded-full transition-colors relative ${checked ? "bg-theme-accent" : "bg-theme-surface-active"}`}
            style={{ backgroundColor: checked ? theme.colors.accent : theme.colors.surfaceActive }}
        >
            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
        </button>
    );

    return (
        <div className="fixed inset-0 z-50 bg-theme-background-secondary flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-4 border-b border-white/5 flex items-center gap-4 bg-theme-background-secondary relative z-10 pt-12">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-theme-surface-hover transition-colors text-theme-primary">
                    <ArrowLeftIcon />
                </button>
                <h1 className="text-xl font-bold text-theme-primary">Settings</h1>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5 bg-theme-background-secondary z-10 px-4">
                <button
                    onClick={() => setActiveTab("appearance")}
                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === "appearance" ? "text-theme-primary" : "text-theme-muted"}`}
                >
                    Appearance
                    {activeTab === "appearance" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-accent" />}
                </button>
                <button
                    onClick={() => setActiveTab("playback")}
                    className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === "playback" ? "text-theme-primary" : "text-theme-muted"}`}
                >
                    Playback
                    {activeTab === "playback" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-theme-accent" />}
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 safe-area-bottom">
                {activeTab === "appearance" && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-theme-muted">Dark Themes</h3>
                            <div className="grid grid-cols-2 gap-3">
                                {darkThemes.map(t => (
                                    <ThemePreviewCard key={t.id} theme={t} isActive={themeId === t.id} onClick={() => setTheme(t.id)} />
                                ))}
                            </div>
                        </div>
                        {lightThemes.length > 0 && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-theme-muted">Light Themes</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {lightThemes.map(t => (
                                        <ThemePreviewCard key={t.id} theme={t} isActive={themeId === t.id} onClick={() => setTheme(t.id)} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "playback" && (
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-theme-surface/50 border border-theme-border/50 flex items-center justify-between">
                            <div>
                                <h3 className="font-medium text-theme-primary">High Quality Stream</h3>
                                <p className="text-xs text-theme-muted mt-0.5">Prefer online stream if better quality</p>
                            </div>
                            <Toggle checked={preferHighQualityStream} onChange={setPreferHighQualityStream} />
                        </div>

                        <div className="p-4 rounded-xl bg-theme-surface/50 border border-theme-border/50 flex items-center justify-between">
                            <div>
                                <h3 className="font-medium text-theme-primary">Crossfade</h3>
                                <p className="text-xs text-theme-muted mt-0.5">Fade usage between songs</p>
                            </div>
                            <Toggle checked={crossfadeEnabled} onChange={(c) => setCrossfade(c, crossfadeDuration)} />
                        </div>

                        {crossfadeEnabled && (
                            <div className="p-4 rounded-xl bg-theme-surface/50 border border-theme-border/50">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-medium text-theme-primary">Duration</h3>
                                    <span className="text-sm font-mono text-theme-accent">{crossfadeDuration / 1000}s</span>
                                </div>
                                <input
                                    type="range"
                                    min="1000"
                                    max="12000"
                                    step="1000"
                                    value={crossfadeDuration}
                                    onChange={(e) => setCrossfade(true, parseInt(e.target.value))}
                                    className="w-full h-1 rounded-full appearance-none cursor-pointer bg-theme-surface-active"
                                    style={{
                                        background: `linear-gradient(to right, ${theme.colors.accent} 0%, ${theme.colors.accent} ${((crossfadeDuration - 1000) / 11000) * 100}%, ${theme.colors.surfaceActive} ${((crossfadeDuration - 1000) / 11000) * 100}%, ${theme.colors.surfaceActive} 100%)`
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
