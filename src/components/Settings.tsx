import { useState, useEffect } from "react";
import { useTheme, Theme } from "../context/ThemeContext";
import { usePlayer } from "../context/PlayerContext";
import { useDownload } from "../context/DownloadContext";
import { open } from "@tauri-apps/plugin-dialog";
import {
  configureSubsonic,
  configureJellyfin,
  getProviderConfigs,
  removeProviderConfig,
  ProviderConfig,
} from "../api/providers";

const ArrowRightIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="M12 5l7 7-7 7" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const PaletteIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
      className={`
                relative group w-full p-3 rounded-xl transition-all duration-200
                ${
                  isActive
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
          <div
            className="w-full h-1.5 rounded-full"
            style={{ background: colors.surfaceActive }}
          />
          <div
            className="w-full h-1.5 rounded-full opacity-50"
            style={{ background: colors.textMuted }}
          />
          <div
            className="w-full h-1.5 rounded-full opacity-50"
            style={{ background: colors.textMuted }}
          />
        </div>

        <div className="flex-1 flex flex-col gap-1.5">
          <div
            className="w-3/4 h-2 rounded-full"
            style={{ background: colors.textPrimary }}
          />
          <div className="flex gap-1">
            <div
              className="w-6 h-6 rounded-md"
              style={{ background: colors.surfaceHover }}
            />
            <div
              className="w-6 h-6 rounded-md"
              style={{ background: colors.surfaceHover }}
            />
            <div
              className="w-6 h-6 rounded-md"
              style={{ background: colors.surfaceHover }}
            />
          </div>
        </div>
      </div>

      <div
        className="w-full h-6 rounded-lg flex items-center px-2 gap-2"
        style={{ background: colors.glass }}
      >
        <div
          className="w-3 h-3 rounded-sm"
          style={{ background: colors.surfaceHover }}
        />
        <div
          className="flex-1 h-1 rounded-full"
          style={{ background: colors.progressTrack }}
        >
          <div
            className="w-1/3 h-full rounded-full"
            style={{ background: colors.progressFillGradient }}
          />
        </div>
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: colors.accent }}
        >
          <div
            className="w-0 h-0 border-l-[4px] border-t-[2.5px] border-b-[2.5px] border-l-current border-t-transparent border-b-transparent ml-0.5"
            style={{ color: colors.textInverse }}
          />
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
        <div
          className="w-4 h-4 rounded-full border"
          style={{ background: colors.accent, borderColor: colors.border }}
        />
        <div
          className="w-4 h-4 rounded-full border"
          style={{ background: colors.textPrimary, borderColor: colors.border }}
        />
        <div
          className="w-4 h-4 rounded-full border"
          style={{ background: colors.surface, borderColor: colors.border }}
        />
        <div
          className="w-4 h-4 rounded-full border"
          style={{ background: colors.background, borderColor: colors.border }}
        />
      </div>
    </button>
  );
};

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "appearance" | "playback" | "services";
}

export const Settings = ({
  isOpen,
  onClose,
  defaultTab = "appearance",
}: SettingsProps) => {
  const { theme, themeId, availableThemes, setTheme } = useTheme();
  const {
    crossfadeEnabled,
    crossfadeDuration,
    setCrossfade,
    playerBarStyle,
    setPlayerBarStyle,
    loudnessNormalization,
    setLoudnessNormalization,
    discordRpcEnabled,
    setDiscordRpcEnabled,
    lyricsProvider,
    setLyricsProvider,
    preferHighQualityStream,
    setPreferHighQualityStream,
  } = usePlayer();
  const [activeTab, setActiveTab] = useState<
    "appearance" | "playback" | "services"
  >(defaultTab);

  // Provider configuration state
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);
  const [subsonicForm, setSubsonicForm] = useState({
    url: "",
    username: "",
    password: "",
  });
  const [jellyfinForm, setJellyfinForm] = useState({
    url: "",
    username: "",
    password: "",
  });
  const [subsonicLoading, setSubsonicLoading] = useState(false);
  const [jellyfinLoading, setJellyfinLoading] = useState(false);
  const [subsonicError, setSubsonicError] = useState<string | null>(null);
  const [jellyfinError, setJellyfinError] = useState<string | null>(null);

  const subsonicConfig = providerConfigs.find(
    (c) => c.provider_id === "subsonic",
  );
  const jellyfinConfig = providerConfigs.find(
    (c) => c.provider_id === "jellyfin",
  );

  const loadProviderConfigs = async () => {
    try {
      const configs = await getProviderConfigs();
      setProviderConfigs(configs);
    } catch (e) {
      console.error("Failed to load provider configs:", e);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === "services") {
      loadProviderConfigs();
    }
  }, [isOpen, activeTab]);

  const handleSubsonicConnect = async () => {
    setSubsonicError(null);
    setSubsonicLoading(true);
    try {
      await configureSubsonic(
        subsonicForm.url,
        subsonicForm.username,
        subsonicForm.password,
      );
      await loadProviderConfigs();
      setSubsonicForm({ url: "", username: "", password: "" });
    } catch (e: any) {
      setSubsonicError(e.toString());
    } finally {
      setSubsonicLoading(false);
    }
  };

  const handleJellyfinConnect = async () => {
    setJellyfinError(null);
    setJellyfinLoading(true);
    try {
      await configureJellyfin(
        jellyfinForm.url,
        jellyfinForm.username,
        jellyfinForm.password,
      );
      await loadProviderConfigs();
      setJellyfinForm({ url: "", username: "", password: "" });
    } catch (e: any) {
      setJellyfinError(e.toString());
    } finally {
      setJellyfinLoading(false);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    try {
      await removeProviderConfig(providerId);
      await loadProviderConfigs();
    } catch (e) {
      console.error("Failed to disconnect:", e);
    }
  };
  const {
    downloadPath,
    setDownloadPath,
    openDownloadFolder,
    refreshDownloadPath,
  } = useDownload();

  // Refresh download path when modal opens
  useEffect(() => {
    if (isOpen) {
      refreshDownloadPath();
    }
  }, [isOpen, refreshDownloadPath]);

  // Reset active tab when modal opens or defaultTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // if (!isOpen) return null; <-- Removed early return to allow AnimatePresence to work

  // Group themes by type (light/dark)
  const lightThemes = availableThemes.filter(
    (t) =>
      t.id.includes("latte") ||
      t.id.includes("light") ||
      t.id === "matcha" ||
      t.id === "cotton-candy-dreams",
  );
  const darkThemes = availableThemes.filter((t) => !lightThemes.includes(t));

  const Toggle = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full transition-colors relative ${checked ? "bg-theme-accent" : "bg-theme-surface-active"}`}
      style={{
        backgroundColor: checked
          ? theme.colors.accent
          : theme.colors.surfaceActive,
      }}
    >
      <div
        className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );

  // if (!isOpen) return null;

  return (
    <>
      <div
        className={`h-full flex-shrink-0 bg-theme-sidebar transition-all duration-300 ease-in-out overflow-hidden shadow-2xl ${
          isOpen ? "w-[480px]" : "w-0"
        }`}
      >
        <div className="w-[480px] h-full flex flex-col">
          {/* Header matching QueueSidebar style */}
          <div className="px-6 py-4 border-b border-theme flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: theme.colors.surfaceHover }}
              >
                <SettingsIcon />
              </div>
              <div>
                <h3 className="font-semibold text-theme-primary">Settings</h3>
                <p className="text-xs text-theme-muted">
                  Manage your preferences
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 -mr-2 rounded-md text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover transition-colors"
            >
              <ArrowRightIcon />
            </button>
          </div>

          <div className="flex border-b border-white/5">
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === "appearance" ? "text-theme-primary" : "text-theme-muted"}`}
              onClick={() => setActiveTab("appearance")}
              style={{
                color:
                  activeTab === "appearance"
                    ? theme.colors.textPrimary
                    : theme.colors.textSecondary,
              }}
            >
              Appearance
              {activeTab === "appearance" && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: theme.colors.accent }}
                />
              )}
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === "playback" ? "text-theme-primary" : "text-theme-muted"}`}
              onClick={() => setActiveTab("playback")}
              style={{
                color:
                  activeTab === "playback"
                    ? theme.colors.textPrimary
                    : theme.colors.textSecondary,
              }}
            >
              Playback
              {activeTab === "playback" && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: theme.colors.accent }}
                />
              )}
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === "services" ? "text-theme-primary" : "text-theme-muted"}`}
              onClick={() => setActiveTab("services")}
              style={{
                color:
                  activeTab === "services"
                    ? theme.colors.textPrimary
                    : theme.colors.textSecondary,
              }}
            >
              Services
              {activeTab === "services" && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: theme.colors.accent }}
                />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 no-scrollbar">
            {activeTab === "appearance" && (
              <div>
                {/* Player Bar Style Section */}
                <div className="mb-8">
                  <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-4"
                    style={{ color: theme.colors.textMuted }}
                  >
                    Player Bar Style
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPlayerBarStyle("floating")}
                      className={`
                                            relative group w-full p-3 rounded-xl transition-all duration-200 text-left
                                            ${
                                              playerBarStyle === "floating"
                                                ? "ring-2 ring-offset-2 ring-offset-transparent"
                                                : "hover:scale-[1.02]"
                                            }
                                        `}
                      style={{
                        background: theme.colors.surface,
                        borderColor:
                          playerBarStyle === "floating"
                            ? theme.colors.accent
                            : theme.colors.border,
                        borderWidth: "1px",
                        borderStyle: "solid",
                        // @ts-ignore
                        "--tw-ring-color": theme.colors.accent,
                      }}
                    >
                      <div className="h-20 mb-3 bg-theme-background rounded-lg relative overflow-hidden flex flex-col justify-end p-2 border border-theme-border opacity-80">
                        <div
                          className="h-6 w-3/4 mx-auto bg-theme-surface-active rounded-full shadow-lg"
                          style={{ background: theme.colors.surfaceActive }}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span
                          className="text-sm font-medium"
                          style={{ color: theme.colors.textPrimary }}
                        >
                          Floating
                        </span>
                        {playerBarStyle === "floating" && (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{
                              background: theme.colors.accent,
                              color: theme.colors.textInverse,
                            }}
                          >
                            <CheckIcon />
                          </div>
                        )}
                      </div>
                    </button>

                    <button
                      onClick={() => setPlayerBarStyle("classic")}
                      className={`
                                            relative group w-full p-3 rounded-xl transition-all duration-200 text-left
                                            ${
                                              playerBarStyle === "classic"
                                                ? "ring-2 ring-offset-2 ring-offset-transparent"
                                                : "hover:scale-[1.02]"
                                            }
                                        `}
                      style={{
                        background: theme.colors.surface,
                        borderColor:
                          playerBarStyle === "classic"
                            ? theme.colors.accent
                            : theme.colors.border,
                        borderWidth: "1px",
                        borderStyle: "solid",
                        // @ts-ignore
                        "--tw-ring-color": theme.colors.accent,
                      }}
                    >
                      <div className="h-20 mb-3 bg-theme-background rounded-lg relative overflow-hidden flex flex-col justify-end border border-theme-border opacity-80">
                        <div
                          className="h-6 w-full bg-theme-surface-active shadow-sm border-t border-theme-border"
                          style={{ background: theme.colors.surfaceActive }}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span
                          className="text-sm font-medium"
                          style={{ color: theme.colors.textPrimary }}
                        >
                          Classic
                        </span>
                        {playerBarStyle === "classic" && (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{
                              background: theme.colors.accent,
                              color: theme.colors.textInverse,
                            }}
                          >
                            <CheckIcon />
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                </div>

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
                {/* Prefer High Quality Stream Section */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: theme.colors.surface }}
                >
                  <div>
                    <h3
                      className="font-medium"
                      style={{ color: theme.colors.textPrimary }}
                    >
                      Prefer Streaming Quality
                    </h3>
                    <p
                      className="text-xs mt-1"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Use online stream if quality is better than local file
                    </p>
                  </div>
                  <Toggle
                    checked={preferHighQualityStream}
                    onChange={(checked) => setPreferHighQualityStream(checked)}
                  />
                </div>

                {/* Crossfade Section */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: theme.colors.surface }}
                >
                  <div>
                    <h3
                      className="font-medium"
                      style={{ color: theme.colors.textPrimary }}
                    >
                      Crossfade Songs
                    </h3>
                    <p
                      className="text-xs mt-1"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Fade tracks into each other for seamless playback
                    </p>
                  </div>
                  <Toggle
                    checked={crossfadeEnabled}
                    onChange={(checked) =>
                      setCrossfade(checked, crossfadeDuration)
                    }
                  />
                </div>

                {crossfadeEnabled && (
                  <div
                    className="p-4 rounded-xl space-y-4"
                    style={{ background: theme.colors.surface }}
                  >
                    <div className="flex justify-between items-center">
                      <h3
                        className="font-medium"
                        style={{ color: theme.colors.textPrimary }}
                      >
                        Duration
                      </h3>
                      <span
                        className="text-sm font-mono"
                        style={{ color: theme.colors.accent }}
                      >
                        {crossfadeDuration / 1000}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="12000"
                      step="1000"
                      value={crossfadeDuration}
                      onChange={(e) =>
                        setCrossfade(true, parseInt(e.target.value))
                      }
                      className="w-full h-1 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${theme.colors.accent} 0%, ${theme.colors.accent} ${((crossfadeDuration - 1000) / 11000) * 100}%, ${theme.colors.surfaceActive} ${((crossfadeDuration - 1000) / 11000) * 100}%, ${theme.colors.surfaceActive} 100%)`,
                      }}
                    />
                    <div
                      className="flex justify-between text-xs"
                      style={{ color: theme.colors.textMuted }}
                    >
                      <span>1s</span>
                      <span>12s</span>
                    </div>
                  </div>
                )}

                {/* Loudness Normalization Section */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: theme.colors.surface }}
                >
                  <div>
                    <h3
                      className="font-medium"
                      style={{ color: theme.colors.textPrimary }}
                    >
                      Loudness Normalization
                    </h3>
                    <p
                      className="text-xs mt-1"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Normalize volume across tracks (-14 LUFS target)
                    </p>
                  </div>
                  <Toggle
                    checked={loudnessNormalization}
                    onChange={(checked) => setLoudnessNormalization(checked)}
                  />
                </div>

                {/* Discord Rich Presence Section */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{ background: theme.colors.surface }}
                >
                  <div>
                    <h3
                      className="font-medium"
                      style={{ color: theme.colors.textPrimary }}
                    >
                      Discord Rich Presence
                    </h3>
                    <p
                      className="text-xs mt-1"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Show what you're listening to on Discord
                    </p>
                  </div>
                  <Toggle
                    checked={discordRpcEnabled}
                    onChange={(checked) => setDiscordRpcEnabled(checked)}
                  />
                </div>

                {/* Lyrics Provider Section */}
                <div
                  className="p-4 rounded-xl space-y-4"
                  style={{ background: theme.colors.surface }}
                >
                  <div>
                    <h3
                      className="font-medium"
                      style={{ color: theme.colors.textPrimary }}
                    >
                      Lyrics Provider
                    </h3>
                    <p
                      className="text-xs mt-1"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Choose source for lyrics
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          value: "netease",
                          label: "NetEase Cloud Music",
                          desc: "Best for coverage",
                        },
                        {
                          value: "lrclib",
                          label: "LRCLib",
                          desc: "Open source database",
                        },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setLyricsProvider(option.value)}
                        className={`p-3 rounded-lg transition-all duration-200 text-left ${
                          lyricsProvider === option.value
                            ? "ring-2"
                            : "hover:scale-[1.02]"
                        }`}
                        style={{
                          background:
                            lyricsProvider === option.value
                              ? theme.colors.accentMuted
                              : theme.colors.surfaceHover,
                          borderColor:
                            lyricsProvider === option.value
                              ? theme.colors.accent
                              : theme.colors.border,
                          borderWidth: "1px",
                          borderStyle: "solid",
                          // @ts-ignore
                          "--tw-ring-color": theme.colors.accent,
                        }}
                      >
                        <div
                          className="text-sm font-medium"
                          style={{ color: theme.colors.textPrimary }}
                        >
                          {option.label}
                        </div>
                        <div
                          className="text-xs mt-0.5"
                          style={{ color: theme.colors.textMuted }}
                        >
                          {option.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Downloads Section */}
                <div
                  className="p-4 rounded-xl space-y-4"
                  style={{ background: theme.colors.surface }}
                >
                  <div>
                    <h3
                      className="font-medium"
                      style={{ color: theme.colors.textPrimary }}
                    >
                      Download Location
                    </h3>
                    <p
                      className="text-xs mt-1"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Where downloaded tracks are saved
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div
                      className="flex-1 px-3 py-2 pt-[12px] rounded-lg text-sm truncate"
                      style={{
                        background: theme.colors.surfaceHover,
                        color: theme.colors.textPrimary,
                      }}
                      title={downloadPath}
                    >
                      {downloadPath || "Loading..."}
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const selected = await open({
                            directory: true,
                            multiple: false,
                            title: "Select Download Folder",
                          });
                          if (selected && typeof selected === "string") {
                            await setDownloadPath(selected);
                          }
                        } catch (e) {
                          console.error("Failed to select folder:", e);
                        }
                      }}
                      className="px-3 py-2 pt-[12px] rounded-lg text-sm font-medium transition-colors"
                      style={{
                        background: theme.colors.surfaceHover,
                        color: theme.colors.textPrimary,
                      }}
                    >
                      Browse
                    </button>
                    <button
                      onClick={openDownloadFolder}
                      className="px-3 py-2 pt-[12px] rounded-lg text-sm font-medium transition-colors"
                      style={{
                        background: theme.colors.accentMuted,
                        color: theme.colors.accent,
                      }}
                      title="Open in file manager"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "services" && (
              <div className="space-y-6">
                {/* Header */}
                <div>
                  <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-1"
                    style={{ color: theme.colors.textMuted }}
                  >
                    Self-Hosted Services
                  </h3>
                  <p
                    className="text-xs"
                    style={{ color: theme.colors.textSecondary }}
                  >
                    Connect your own music servers
                  </p>
                </div>

                {/* Subsonic / Navidrome Card */}
                <div
                  className="p-4 rounded-xl space-y-4"
                  style={{ background: theme.colors.surface }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                        style={{ background: theme.colors.surfaceHover }}
                      >
                        🎵
                      </div>
                      <div>
                        <h3
                          className="font-medium"
                          style={{ color: theme.colors.textPrimary }}
                        >
                          Subsonic / Navidrome
                        </h3>
                        <p
                          className="text-xs"
                          style={{
                            color: subsonicConfig
                              ? theme.colors.accent
                              : theme.colors.textSecondary,
                          }}
                        >
                          {subsonicConfig
                            ? `Connected to ${subsonicConfig.server_url}`
                            : "Not configured"}
                        </p>
                      </div>
                    </div>
                    {subsonicConfig && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: theme.colors.accent }}
                      />
                    )}
                  </div>

                  {subsonicConfig ? (
                    <button
                      onClick={() => handleDisconnect("subsonic")}
                      className="w-full py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        background: theme.colors.surfaceHover,
                        color: theme.colors.textPrimary,
                      }}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Server URL (e.g., https://music.example.com)"
                          value={subsonicForm.url}
                          onChange={(e) =>
                            setSubsonicForm((f) => ({
                              ...f,
                              url: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{
                            background: theme.colors.surfaceHover,
                            color: theme.colors.textPrimary,
                            border: `1px solid ${theme.colors.border}`,
                          }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Username"
                            value={subsonicForm.username}
                            onChange={(e) =>
                              setSubsonicForm((f) => ({
                                ...f,
                                username: e.target.value,
                              }))
                            }
                            className="px-3 py-2 rounded-lg text-sm outline-none"
                            style={{
                              background: theme.colors.surfaceHover,
                              color: theme.colors.textPrimary,
                              border: `1px solid ${theme.colors.border}`,
                            }}
                          />
                          <input
                            type="password"
                            placeholder="Password"
                            value={subsonicForm.password}
                            onChange={(e) =>
                              setSubsonicForm((f) => ({
                                ...f,
                                password: e.target.value,
                              }))
                            }
                            className="px-3 py-2 rounded-lg text-sm outline-none"
                            style={{
                              background: theme.colors.surfaceHover,
                              color: theme.colors.textPrimary,
                              border: `1px solid ${theme.colors.border}`,
                            }}
                          />
                        </div>
                      </div>
                      {subsonicError && (
                        <p className="text-xs" style={{ color: "#ef4444" }}>
                          {subsonicError}
                        </p>
                      )}
                      <button
                        onClick={handleSubsonicConnect}
                        disabled={
                          subsonicLoading ||
                          !subsonicForm.url ||
                          !subsonicForm.username ||
                          !subsonicForm.password
                        }
                        className="w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        style={{
                          background: theme.colors.accent,
                          color: theme.colors.textInverse,
                        }}
                      >
                        {subsonicLoading ? "Connecting..." : "Connect"}
                      </button>
                    </>
                  )}
                </div>

                {/* Jellyfin Card */}
                <div
                  className="p-4 rounded-xl space-y-4"
                  style={{ background: theme.colors.surface }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                        style={{ background: theme.colors.surfaceHover }}
                      >
                        🍞
                      </div>
                      <div>
                        <h3
                          className="font-medium"
                          style={{ color: theme.colors.textPrimary }}
                        >
                          Jellyfin
                        </h3>
                        <p
                          className="text-xs"
                          style={{
                            color: jellyfinConfig
                              ? theme.colors.accent
                              : theme.colors.textSecondary,
                          }}
                        >
                          {jellyfinConfig
                            ? `Connected to ${jellyfinConfig.server_url}`
                            : "Not configured"}
                        </p>
                      </div>
                    </div>
                    {jellyfinConfig && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: theme.colors.accent }}
                      />
                    )}
                  </div>

                  {jellyfinConfig ? (
                    <button
                      onClick={() => handleDisconnect("jellyfin")}
                      className="w-full py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        background: theme.colors.surfaceHover,
                        color: theme.colors.textPrimary,
                      }}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Server URL (e.g., https://jellyfin.example.com)"
                          value={jellyfinForm.url}
                          onChange={(e) =>
                            setJellyfinForm((f) => ({
                              ...f,
                              url: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{
                            background: theme.colors.surfaceHover,
                            color: theme.colors.textPrimary,
                            border: `1px solid ${theme.colors.border}`,
                          }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Username"
                            value={jellyfinForm.username}
                            onChange={(e) =>
                              setJellyfinForm((f) => ({
                                ...f,
                                username: e.target.value,
                              }))
                            }
                            className="px-3 py-2 rounded-lg text-sm outline-none"
                            style={{
                              background: theme.colors.surfaceHover,
                              color: theme.colors.textPrimary,
                              border: `1px solid ${theme.colors.border}`,
                            }}
                          />
                          <input
                            type="password"
                            placeholder="Password"
                            value={jellyfinForm.password}
                            onChange={(e) =>
                              setJellyfinForm((f) => ({
                                ...f,
                                password: e.target.value,
                              }))
                            }
                            className="px-3 py-2 rounded-lg text-sm outline-none"
                            style={{
                              background: theme.colors.surfaceHover,
                              color: theme.colors.textPrimary,
                              border: `1px solid ${theme.colors.border}`,
                            }}
                          />
                        </div>
                      </div>
                      {jellyfinError && (
                        <p className="text-xs" style={{ color: "#ef4444" }}>
                          {jellyfinError}
                        </p>
                      )}
                      <button
                        onClick={handleJellyfinConnect}
                        disabled={
                          jellyfinLoading ||
                          !jellyfinForm.url ||
                          !jellyfinForm.username ||
                          !jellyfinForm.password
                        }
                        className="w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        style={{
                          background: theme.colors.accent,
                          color: theme.colors.textInverse,
                        }}
                      >
                        {jellyfinLoading ? "Connecting..." : "Connect"}
                      </button>
                    </>
                  )}
                </div>

                {/* Info Note */}
                <div
                  className="p-3 rounded-lg text-xs"
                  style={{
                    background: theme.colors.surfaceHover,
                    color: theme.colors.textSecondary,
                  }}
                >
                  <p>
                    After connecting, you can search for music from your server
                    using the search palette.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-white/5">
            <p
              className="text-xs text-center"
              style={{ color: theme.colors.textMuted }}
            >
              Settings are saved automatically
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

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
