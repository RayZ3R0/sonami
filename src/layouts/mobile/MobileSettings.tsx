import { useState, useEffect } from "react";
import { useTheme, Theme } from "../../context/ThemeContext";
import { usePlayer } from "../../context/PlayerContext";
import {
  configureSubsonic,
  configureJellyfin,
  getProviderConfigs,
  removeProviderConfig,
  getHifiConfig,
  setHifiConfig,
  resetHifiConfig,
  ProviderConfig,
  HifiInstanceConfig,
} from "../../api/providers";

const ArrowLeftIcon = () => (
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
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
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

const NavidromeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 700 700"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform="translate(0,700) scale(0.1,-0.1)" stroke="none">
      <path d="M3225 6988 c-973 -78 -1852 -545 -2463 -1308 -833 -1041 -996 -2480 -418 -3695 329 -691 917 -1285 1611 -1625 373 -183 748 -291 1190 -342 142 -16 568 -16 710 0 628 73 1164 273 1659 620 162 114 334 262 491 423 417 428 695 906 860 1479 91 317 129 599 129 960 0 332 -27 560 -100 855 -277 1108 -1095 2023 -2164 2423 -473 176 -1004 251 -1505 210z m530 -289 c873 -75 1651 -478 2209 -1145 396 -473 639 -1031 723 -1662 24 -181 24 -608 -1 -787 -83 -604 -293 -1109 -662 -1585 -110 -142 -372 -407 -519 -525 -467 -373 -997 -597 -1610 -681 -184 -25 -608 -25 -790 0 -521 72 -956 233 -1375 511 -185 122 -326 239 -505 419 -511 513 -814 1133 -912 1863 -24 178 -24 608 0 785 81 608 305 1136 681 1613 102 129 372 399 503 502 503 399 1085 631 1728 692 131 12 391 12 530 0z" />
      <path d="M3405 3886 c-201 -49 -333 -251 -296 -452 31 -172 154 -294 331 -326 257 -48 499 197 451 458 -23 124 -95 227 -198 281 -96 51 -189 63 -288 39z" />
    </g>
  </svg>
);

const JellyfinIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 .002C8.826.002-1.398 18.537.16 21.666c1.56 3.129 22.14 3.094 23.682 0C25.384 18.573 15.177 0 12 0zm7.76 18.949c-1.008 2.028-14.493 2.05-15.514 0C3.224 16.9 9.92 4.755 12.003 4.755c2.081 0 8.77 12.166 7.759 14.196z" />
  </svg>
);

const HifiIcon = () => (
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
    <path d="M2 10v3" />
    <path d="M6 6v11" />
    <path d="M10 3v18" />
    <path d="M14 8v7" />
    <path d="M18 5v13" />
    <path d="M22 10v3" />
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
      className={`relative group w-full p-3 rounded-xl transition-all duration-200 ${isActive ? "ring-2 ring-offset-2 ring-offset-transparent" : "active:scale-[0.98]"}`}
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
          </div>
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

  const [activeTab, setActiveTab] = useState<
    "appearance" | "playback" | "services"
  >("appearance");

  // Provider configs
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

  // HiFi config
  const [hifiConfig, setHifiConfigState] = useState<HifiInstanceConfig | null>(
    null,
  );
  const [hifiUrl, setHifiUrl] = useState("");
  const [hifiLoading, setHifiLoading] = useState(false);
  const [hifiError, setHifiError] = useState<string | null>(null);
  const [hifiSuccess, setHifiSuccess] = useState<string | null>(null);

  const subsonicConfig = providerConfigs.find(
    (c) => c.provider_id === "subsonic",
  );
  const jellyfinConfig = providerConfigs.find(
    (c) => c.provider_id === "jellyfin",
  );

  // Group themes
  const lightThemes = availableThemes.filter(
    (t) =>
      t.id.includes("latte") ||
      t.id.includes("light") ||
      t.id === "matcha" ||
      t.id === "cotton-candy-dreams",
  );
  const darkThemes = availableThemes.filter((t) => !lightThemes.includes(t));

  const loadProviderConfigs = async () => {
    try {
      const configs = await getProviderConfigs();
      setProviderConfigs(configs);
    } catch (e) {
      console.error("Failed to load provider configs:", e);
    }
  };

  const loadHifiConfig = async () => {
    try {
      const config = await getHifiConfig();
      setHifiConfigState(config);
      setHifiUrl(config.endpoints_url);
    } catch (e) {
      console.error("Failed to load HiFi config:", e);
    }
  };

  useEffect(() => {
    if (activeTab === "services") {
      loadProviderConfigs();
      loadHifiConfig();
    }
  }, [activeTab]);

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

  const handleHifiSave = async () => {
    setHifiError(null);
    setHifiSuccess(null);
    setHifiLoading(true);
    try {
      await setHifiConfig(hifiUrl);
      await loadHifiConfig();
      setHifiSuccess("Saved successfully");
      setTimeout(() => setHifiSuccess(null), 3000);
    } catch (e: any) {
      setHifiError(e.toString());
    } finally {
      setHifiLoading(false);
    }
  };

  const handleHifiReset = async () => {
    setHifiError(null);
    setHifiSuccess(null);
    setHifiLoading(true);
    try {
      await resetHifiConfig();
      await loadHifiConfig();
      setHifiSuccess("Reset to default");
      setTimeout(() => setHifiSuccess(null), 3000);
    } catch (e: any) {
      setHifiError(e.toString());
    } finally {
      setHifiLoading(false);
    }
  };

  const Toggle = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 rounded-full transition-colors relative ${checked ? "bg-theme-accent" : "bg-theme-surface-active"}`}
      style={{
        backgroundColor: checked
          ? theme.colors.accent
          : theme.colors.surfaceActive,
      }}
    >
      <div
        className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full transition-transform shadow-sm ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );

  const ServiceCard = ({
    icon,
    title,
    connected,
    serverUrl,
    onDisconnect,
    children,
  }: {
    icon: React.ReactNode;
    title: string;
    connected: boolean;
    serverUrl?: string;
    onDisconnect?: () => void;
    children?: React.ReactNode;
  }) => (
    <div
      className="p-4 rounded-2xl space-y-4"
      style={{ background: theme.colors.surface }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: theme.colors.surfaceHover }}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-theme-primary">{title}</h3>
            <p
              className="text-xs mt-0.5"
              style={{
                color: connected
                  ? theme.colors.accent
                  : theme.colors.textSecondary,
              }}
            >
              {connected
                ? `Connected${serverUrl ? ` • ${serverUrl.replace(/https?:\/\//, "").split("/")[0]}` : ""}`
                : "Not configured"}
            </p>
          </div>
        </div>
        {connected && (
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ background: theme.colors.accent }}
          />
        )}
      </div>

      {connected && onDisconnect ? (
        <button
          onClick={onDisconnect}
          className="w-full py-3 rounded-xl text-sm font-medium transition-colors active:scale-[0.98]"
          style={{
            background: theme.colors.surfaceHover,
            color: theme.colors.textPrimary,
          }}
        >
          Disconnect
        </button>
      ) : (
        children
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-theme-background-secondary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/5 flex items-center gap-4 bg-theme-background-secondary relative z-10 safe-area-top">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full active:bg-theme-surface-hover transition-colors text-theme-primary"
        >
          <ArrowLeftIcon />
        </button>
        <h1 className="text-xl font-bold text-theme-primary">Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-theme-background-secondary z-10 px-2">
        {(["appearance", "playback", "services"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3.5 text-sm font-medium transition-colors relative ${activeTab === tab ? "text-theme-primary" : "text-theme-muted"}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-theme-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 safe-area-bottom">
        {activeTab === "appearance" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-theme-muted">
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
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-theme-muted">
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
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-theme-surface/50 border border-theme-border/50 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-theme-primary">
                  High Quality Stream
                </h3>
                <p className="text-xs text-theme-muted mt-0.5">
                  Prefer online stream if better quality
                </p>
              </div>
              <Toggle
                checked={preferHighQualityStream}
                onChange={setPreferHighQualityStream}
              />
            </div>

            <div className="p-4 rounded-2xl bg-theme-surface/50 border border-theme-border/50 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-theme-primary">Crossfade</h3>
                <p className="text-xs text-theme-muted mt-0.5">
                  Fade between songs
                </p>
              </div>
              <Toggle
                checked={crossfadeEnabled}
                onChange={(c) => setCrossfade(c, crossfadeDuration)}
              />
            </div>

            {crossfadeEnabled && (
              <div className="p-4 rounded-2xl bg-theme-surface/50 border border-theme-border/50">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-theme-primary">Duration</h3>
                  <span className="text-sm font-mono text-theme-accent">
                    {crossfadeDuration / 1000}s
                  </span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="12000"
                  step="1000"
                  value={crossfadeDuration}
                  onChange={(e) => setCrossfade(true, parseInt(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${theme.colors.accent} 0%, ${theme.colors.accent} ${((crossfadeDuration - 1000) / 11000) * 100}%, ${theme.colors.surfaceActive} ${((crossfadeDuration - 1000) / 11000) * 100}%, ${theme.colors.surfaceActive} 100%)`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "services" && (
          <div className="space-y-6">
            {/* Self-Hosted Header */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-theme-muted">
                Self-Hosted Services
              </h3>
              <p className="text-xs text-theme-secondary mt-1">
                Connect your own music servers
              </p>
            </div>

            {/* Subsonic Card */}
            <ServiceCard
              icon={<NavidromeIcon />}
              title="Subsonic / Navidrome"
              connected={!!subsonicConfig}
              serverUrl={subsonicConfig?.server_url}
              onDisconnect={() => handleDisconnect("subsonic")}
            >
              <div className="space-y-3">
                <input
                  type="url"
                  placeholder="Server URL"
                  value={subsonicForm.url}
                  onChange={(e) =>
                    setSubsonicForm((f) => ({ ...f, url: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
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
                    className="px-4 py-3 rounded-xl text-sm outline-none"
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
                    className="px-4 py-3 rounded-xl text-sm outline-none"
                    style={{
                      background: theme.colors.surfaceHover,
                      color: theme.colors.textPrimary,
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  />
                </div>
                {subsonicError && (
                  <p className="text-xs text-red-400">{subsonicError}</p>
                )}
                <button
                  onClick={handleSubsonicConnect}
                  disabled={
                    subsonicLoading ||
                    !subsonicForm.url ||
                    !subsonicForm.username ||
                    !subsonicForm.password
                  }
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 active:scale-[0.98]"
                  style={{
                    background: theme.colors.accent,
                    color: theme.colors.textInverse,
                  }}
                >
                  {subsonicLoading ? "Connecting..." : "Connect"}
                </button>
              </div>
            </ServiceCard>

            {/* Jellyfin Card */}
            <ServiceCard
              icon={<JellyfinIcon />}
              title="Jellyfin"
              connected={!!jellyfinConfig}
              serverUrl={jellyfinConfig?.server_url}
              onDisconnect={() => handleDisconnect("jellyfin")}
            >
              <div className="space-y-3">
                <input
                  type="url"
                  placeholder="Server URL"
                  value={jellyfinForm.url}
                  onChange={(e) =>
                    setJellyfinForm((f) => ({ ...f, url: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
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
                    className="px-4 py-3 rounded-xl text-sm outline-none"
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
                    className="px-4 py-3 rounded-xl text-sm outline-none"
                    style={{
                      background: theme.colors.surfaceHover,
                      color: theme.colors.textPrimary,
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  />
                </div>
                {jellyfinError && (
                  <p className="text-xs text-red-400">{jellyfinError}</p>
                )}
                <button
                  onClick={handleJellyfinConnect}
                  disabled={
                    jellyfinLoading ||
                    !jellyfinForm.url ||
                    !jellyfinForm.username ||
                    !jellyfinForm.password
                  }
                  className="w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 active:scale-[0.98]"
                  style={{
                    background: theme.colors.accent,
                    color: theme.colors.textInverse,
                  }}
                >
                  {jellyfinLoading ? "Connecting..." : "Connect"}
                </button>
              </div>
            </ServiceCard>

            {/* Streaming Header */}
            <div className="pt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-theme-muted">
                Streaming Service
              </h3>
              <p className="text-xs text-theme-secondary mt-1">
                Configure HiFi streaming instance
              </p>
            </div>

            {/* HiFi Card */}
            <div
              className="p-4 rounded-2xl space-y-4"
              style={{ background: theme.colors.surface }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: theme.colors.surfaceHover }}
                  >
                    <HifiIcon />
                  </div>
                  <div>
                    <h3 className="font-semibold text-theme-primary">
                      HiFi Instance
                    </h3>
                    <p
                      className="text-xs mt-0.5"
                      style={{
                        color:
                          hifiConfig && !hifiConfig.is_default
                            ? theme.colors.accent
                            : theme.colors.textSecondary,
                      }}
                    >
                      {hifiConfig && !hifiConfig.is_default
                        ? "Custom instance"
                        : "Using default"}
                    </p>
                  </div>
                </div>
                {hifiConfig && !hifiConfig.is_default && (
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: theme.colors.accent }}
                  />
                )}
              </div>

              <div className="space-y-3">
                <input
                  type="url"
                  placeholder="HiFi Instance URL"
                  value={hifiUrl}
                  onChange={(e) => setHifiUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{
                    background: theme.colors.surfaceHover,
                    color: theme.colors.textPrimary,
                    border: `1px solid ${theme.colors.border}`,
                  }}
                />
                <p className="text-xs text-theme-muted">
                  URL to the instances JSON file. Leave empty for default.
                </p>
              </div>

              {hifiError && <p className="text-xs text-red-400">{hifiError}</p>}
              {hifiSuccess && (
                <p className="text-xs" style={{ color: theme.colors.accent }}>
                  {hifiSuccess}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleHifiSave}
                  disabled={hifiLoading || !hifiUrl}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 active:scale-[0.98]"
                  style={{
                    background: theme.colors.accent,
                    color: theme.colors.textInverse,
                  }}
                >
                  {hifiLoading ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleHifiReset}
                  disabled={hifiLoading || (hifiConfig?.is_default ?? true)}
                  className="py-3 px-5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 active:scale-[0.98]"
                  style={{
                    background: theme.colors.surfaceHover,
                    color: theme.colors.textPrimary,
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Info Note */}
            <div
              className="p-4 rounded-xl text-xs"
              style={{
                background: theme.colors.surfaceHover,
                color: theme.colors.textSecondary,
              }}
            >
              <p className="leading-relaxed">
                After connecting a service, you can search for music using the
                search function. Your credentials are stored securely on your
                device.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
