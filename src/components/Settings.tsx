import { useState } from "react";
import { useTheme, Theme } from "../context/ThemeContext";

// Icons
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

// Theme preview card showing actual theme colors
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
            {/* Mini UI Preview */}
            <div className="flex gap-2 mb-2">
                {/* Mini sidebar */}
                <div 
                    className="w-8 h-16 rounded-md flex flex-col gap-1 p-1"
                    style={{ background: colors.surface }}
                >
                    <div className="w-full h-1.5 rounded-full" style={{ background: colors.surfaceActive }} />
                    <div className="w-full h-1.5 rounded-full opacity-50" style={{ background: colors.textMuted }} />
                    <div className="w-full h-1.5 rounded-full opacity-50" style={{ background: colors.textMuted }} />
                </div>
                
                {/* Mini main content */}
                <div className="flex-1 flex flex-col gap-1.5">
                    <div className="w-3/4 h-2 rounded-full" style={{ background: colors.textPrimary }} />
                    <div className="flex gap-1">
                        <div className="w-6 h-6 rounded-md" style={{ background: colors.surfaceHover }} />
                        <div className="w-6 h-6 rounded-md" style={{ background: colors.surfaceHover }} />
                        <div className="w-6 h-6 rounded-md" style={{ background: colors.surfaceHover }} />
                    </div>
                </div>
            </div>
            
            {/* Mini player bar */}
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
            
            {/* Theme name */}
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
            
            {/* Color swatches */}
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
}

export const Settings = ({ isOpen, onClose }: SettingsProps) => {
    const { theme, themeId, availableThemes, setTheme } = useTheme();
    const [activeTab] = useState<"appearance">("appearance");
    
    if (!isOpen) return null;
    
    // Group themes by type (light/dark)
    const lightThemes = availableThemes.filter(t => 
        t.id.includes("latte") || 
        t.id.includes("light") || 
        t.id === "matcha" ||
        t.id === "cotton-candy-dreams"
    );
    const darkThemes = availableThemes.filter(t => !lightThemes.includes(t));

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />
            
            {/* Settings Panel */}
            <div 
                className="fixed inset-y-0 right-0 z-[101] w-full max-w-lg flex flex-col animate-slide-in-right"
                style={{ 
                    background: `linear-gradient(135deg, ${theme.colors.background} 0%, ${theme.colors.backgroundSecondary} 100%)`,
                    borderLeft: `1px solid ${theme.colors.border}`,
                }}
            >
                {/* Header */}
                <div 
                    className="flex items-center justify-between px-6 py-4 border-b"
                    style={{ borderColor: theme.colors.border }}
                >
                    <div className="flex items-center gap-3">
                        <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: theme.colors.surfaceHover }}
                        >
                            <PaletteIcon />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold" style={{ color: theme.colors.textPrimary }}>
                                Settings
                            </h2>
                            <p className="text-xs" style={{ color: theme.colors.textMuted }}>
                                Customize your experience
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
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 no-scrollbar">
                    {activeTab === "appearance" && (
                        <div>
                            {/* Current Theme Banner */}
                            <div 
                                className="p-4 rounded-xl mb-6"
                                style={{ 
                                    background: `linear-gradient(135deg, ${theme.colors.accent}20 0%, ${theme.colors.accent}05 100%)`,
                                    border: `1px solid ${theme.colors.accent}30`,
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div 
                                        className="w-12 h-12 rounded-xl"
                                        style={{ 
                                            background: `linear-gradient(135deg, ${theme.colors.accent} 0%, ${theme.colors.accentHover} 100%)`,
                                        }}
                                    />
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: theme.colors.accent }}>
                                            Current Theme
                                        </p>
                                        <p className="text-lg font-bold" style={{ color: theme.colors.textPrimary }}>
                                            {theme.name}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Dark Themes */}
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
                            
                            {/* Light Themes */}
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
                </div>
                
                {/* Footer */}
                <div 
                    className="px-6 py-4 border-t"
                    style={{ borderColor: theme.colors.border }}
                >
                    <p className="text-xs text-center" style={{ color: theme.colors.textMuted }}>
                        Theme changes are saved automatically
                    </p>
                </div>
            </div>
        </>
    );
};

// Settings trigger button component for reuse
export const SettingsButton = ({ onClick }: { onClick: () => void }) => {
    return (
        <button
            onClick={onClick}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 text-theme-secondary hover:text-theme-primary hover:bg-theme-surface-hover"
            title="Settings"
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
        </button>
    );
};
