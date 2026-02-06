import React, { useState, useEffect, useRef } from "react";
import { useTheme, Theme } from "../context/ThemeContext";
import { usePlayer } from "../context/PlayerContext";
import { useDownload } from "../context/DownloadContext";
import { open } from "@tauri-apps/plugin-dialog";
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
} from "../api/providers";
import { factoryReset } from "../api/library";

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

const FolderIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
  </svg>
);

const MusicIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const NavidromeIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 700 700"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform="translate(0,700) scale(0.1,-0.1)" stroke="none">
      <path d="M3225 6988 c-973 -78 -1852 -545 -2463 -1308 -833 -1041 -996 -2480 -418 -3695 329 -691 917 -1285 1611 -1625 373 -183 748 -291 1190 -342 142 -16 568 -16 710 0 628 73 1164 273 1659 620 162 114 334 262 491 423 417 428 695 906 860 1479 91 317 129 599 129 960 0 332 -27 560 -100 855 -277 1108 -1095 2023 -2164 2423 -473 176 -1004 251 -1505 210z m530 -289 c873 -75 1651 -478 2209 -1145 396 -473 639 -1031 723 -1662 24 -181 24 -608 -1 -787 -83 -604 -293 -1109 -662 -1585 -110 -142 -372 -407 -519 -525 -467 -373 -997 -597 -1610 -681 -184 -25 -608 -25 -790 0 -521 72 -956 233 -1375 511 -185 122 -326 239 -505 419 -511 513 -814 1133 -912 1863 -24 178 -24 608 0 785 81 608 305 1136 681 1613 102 129 372 399 503 502 503 399 1085 631 1728 692 131 12 391 12 530 0z" />
      <path d="M3255 6279 c-624 -54 -1227 -328 -1682 -763 -398 -380 -683 -887 -798 -1419 -16 -73 -16 -81 0 -122 31 -83 122 -117 201 -77 51 26 67 58 104 209 84 342 252 679 477 958 101 126 309 328 435 423 406 305 867 473 1383 503 195 11 217 19 253 91 18 35 22 55 16 83 -8 42 -44 89 -85 110 -31 17 -139 18 -304 4z" />
      <path d="M3320 5639 c-526 -45 -1008 -277 -1376 -661 -362 -379 -576 -891 -587 -1401 -2 -137 3 -154 66 -201 37 -27 117 -27 154 0 59 44 65 62 74 212 17 292 75 508 205 762 93 180 177 294 339 455 158 158 273 245 445 334 256 133 478 193 772 210 114 7 144 12 166 28 48 36 66 69 66 123 0 53 -18 87 -66 123 -32 24 -113 29 -258 16z" />
      <path d="M3363 4840 c-313 -35 -592 -170 -813 -390 -190 -190 -314 -420 -371 -693 -31 -143 -31 -371 0 -514 57 -273 179 -500 370 -692 255 -257 587 -394 951 -394 491 0 922 252 1173 685 189 327 225 740 96 1105 -135 382 -440 687 -822 822 -176 62 -413 91 -584 71z m265 -290 c235 -30 448 -134 618 -304 363 -363 414 -920 123 -1347 -56 -83 -187 -214 -267 -268 -96 -65 -236 -128 -347 -157 -87 -23 -119 -27 -255 -27 -136 0 -168 4 -255 27 -188 49 -356 145 -490 280 -358 360 -414 901 -139 1324 218 335 617 521 1012 472z" />
      <path d="M3405 3886 c-201 -49 -333 -251 -296 -452 31 -172 154 -294 331 -326 257 -48 499 197 451 458 -23 124 -95 227 -198 281 -96 51 -189 63 -288 39z m174 -307 c26 -26 31 -38 31 -79 0 -41 -5 -53 -31 -79 -26 -26 -38 -31 -79 -31 -41 0 -53 5 -79 31 -26 26 -31 38 -31 79 0 41 5 53 31 79 26 26 38 31 79 31 41 0 53 -5 79 -31z" />
      <path d="M792 3693 c-53 -26 -76 -68 -80 -145 -7 -116 49 -191 142 -191 53 0 102 26 126 66 16 25 20 50 20 114 0 73 -3 85 -26 113 -51 59 -117 75 -182 43z" />
      <path d="M5454 3639 c-18 -5 -46 -25 -62 -44 -34 -38 -38 -58 -47 -229 -20 -409 -207 -829 -510 -1145 -331 -346 -759 -542 -1244 -570 -153 -9 -171 -15 -215 -74 -27 -37 -27 -117 0 -154 46 -61 66 -68 187 -66 695 12 1351 382 1744 985 140 214 244 473 298 743 31 155 50 398 36 452 -13 47 -55 90 -102 103 -39 11 -43 11 -85 -1z" />
      <path d="M6083 3631 c-64 -30 -83 -69 -83 -168 0 -73 3 -85 26 -113 38 -45 79 -63 130 -57 87 9 134 71 134 177 0 134 -99 211 -207 161z" />
      <path d="M6019 3101 c-47 -26 -63 -61 -103 -221 -101 -408 -313 -788 -611 -1098 -320 -334 -692 -557 -1143 -686 -159 -46 -333 -74 -536 -87 -196 -12 -218 -20 -254 -89 -17 -33 -21 -54 -17 -80 17 -88 75 -130 181 -130 197 0 510 46 712 105 495 142 879 369 1233 725 371 374 631 849 744 1363 16 74 16 81 0 122 -9 25 -30 54 -47 66 -42 31 -113 35 -159 10z" />
    </g>
  </svg>
);

const JellyfinIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 .002C8.826.002-1.398 18.537.16 21.666c1.56 3.129 22.14 3.094 23.682 0C25.384 18.573 15.177 0 12 0zm7.76 18.949c-1.008 2.028-14.493 2.05-15.514 0C3.224 16.9 9.92 4.755 12.003 4.755c2.081 0 8.77 12.166 7.759 14.196zM12 9.198c-1.054 0-4.446 6.15-3.93 7.189.518 1.04 7.348 1.027 7.86 0 .511-1.027-2.874-7.19-3.93-7.19z" />
  </svg>
);

const HifiIcon = () => (
  <svg
    width="22"
    height="22"
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
    searchProviderOrder,
    setSearchProviderOrder,
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

  // UI State
  const [showResetModal, setShowResetModal] = useState(false);
  const [subsonicLoading, setSubsonicLoading] = useState(false);
  const [jellyfinLoading, setJellyfinLoading] = useState(false);
  const [subsonicError, setSubsonicError] = useState<string | null>(null);
  const [jellyfinError, setJellyfinError] = useState<string | null>(null);

  // HiFi Instance state
  const [hifiConfig, setHifiConfigState] = useState<HifiInstanceConfig | null>(
    null,
  );
  const [hifiUrl, setHifiUrl] = useState("");
  const [hifiLoading, setHifiLoading] = useState(false);
  const [hifiError, setHifiError] = useState<string | null>(null);
  const [hifiSuccess, setHifiSuccess] = useState<string | null>(null);
  const [hifiUrlCopied, setHifiUrlCopied] = useState(false);

  // Ref for HiFi section to scroll to
  const hifiSectionRef = useRef<HTMLDivElement>(null);

  // Public HiFi instances URL (shown in UI for user to copy)
  const PUBLIC_HIFI_INSTANCES_URL = "https://raw.githubusercontent.com/EduardPrigoana/hifi-instances/refs/heads/main/instances.json";

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
    if (isOpen && activeTab === "services") {
      loadProviderConfigs();
      loadHifiConfig();
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

  const handleHifiSave = async () => {
    setHifiError(null);
    setHifiSuccess(null);
    setHifiLoading(true);
    try {
      await setHifiConfig(hifiUrl);
      await loadHifiConfig();
      setHifiSuccess("HiFi instance URL saved successfully");
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
      setHifiSuccess("HiFi instance URL cleared");
      setTimeout(() => setHifiSuccess(null), 3000);
    } catch (e: any) {
      setHifiError(e.toString());
    } finally {
      setHifiLoading(false);
    }
  };

  const handleCopyHifiUrl = async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_HIFI_INSTANCES_URL);
      setHifiUrlCopied(true);
      setTimeout(() => setHifiUrlCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy URL:", e);
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

  // Scroll to HiFi section when services tab is opened
  useEffect(() => {
    if (isOpen && activeTab === "services" && hifiSectionRef.current) {
      // Small delay to ensure the tab content is rendered
      const timer = setTimeout(() => {
        hifiSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

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

                {/* Search Provider Order */}
                <div
                  className="p-4 rounded-xl"
                  style={{ background: theme.colors.surface }}
                >
                  <h3
                    className="font-medium mb-1"
                    style={{ color: theme.colors.textPrimary }}
                  >
                    Search Results Order
                  </h3>
                  <p
                    className="text-xs mb-4"
                    style={{ color: theme.colors.textSecondary }}
                  >
                    Drag to reorder how search results are displayed
                  </p>
                  <div className="space-y-2">
                    {searchProviderOrder.map((providerId, index) => {
                      const providerInfo: Record<
                        string,
                        { name: string; icon: React.ReactNode }
                      > = {
                        local: { name: "Local Library", icon: <FolderIcon /> },
                        tidal: { name: "Tidal", icon: <MusicIcon /> },
                        subsonic: {
                          name: "Subsonic / Navidrome",
                          icon: <NavidromeIcon />,
                        },
                        jellyfin: { name: "Jellyfin", icon: <JellyfinIcon /> },
                      };
                      const info = providerInfo[providerId] || {
                        name: providerId,
                        icon: <span className="text-lg">❓</span>,
                      };

                      return (
                        <div
                          key={providerId}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              "text/plain",
                              index.toString(),
                            );
                            e.currentTarget.style.opacity = "0.5";
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.style.opacity = "1";
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.borderColor =
                              theme.colors.accent;
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.style.borderColor = "transparent";
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.style.borderColor = "transparent";
                            const fromIndex = parseInt(
                              e.dataTransfer.getData("text/plain"),
                            );
                            const toIndex = index;
                            if (fromIndex !== toIndex) {
                              const newOrder = [...searchProviderOrder];
                              const [moved] = newOrder.splice(fromIndex, 1);
                              newOrder.splice(toIndex, 0, moved);
                              setSearchProviderOrder(newOrder);
                            }
                          }}
                          className="flex items-center gap-3 p-3 rounded-lg cursor-grab active:cursor-grabbing transition-all border-2 border-transparent"
                          style={{ background: theme.colors.surfaceHover }}
                        >
                          <span className="mt-0.5">{info.icon}</span>
                          <span
                            className="flex-1 font-medium text-sm mt-[7px]"
                            style={{ color: theme.colors.textPrimary }}
                          >
                            {info.name}
                          </span>
                          <svg
                            className="w-4 h-4 opacity-40 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 8h16M4 16h16"
                            />
                          </svg>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Danger Zone */}
                <div
                  className="flex items-center justify-between p-4 rounded-xl border border-red-500/20"
                  style={{ background: "rgba(239, 68, 68, 0.05)" }}
                >
                  <div>
                    <h3 className="font-medium text-red-500">Factory Reset</h3>
                    <p
                      className="text-xs mt-1"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Delete all library data. Downloaded files are preserved.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowResetModal(true)}
                    className="px-4 py-2 pt-[13px] bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Reset
                  </button>
                </div>

                {/* Reset Confirmation Modal */}
                {showResetModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div
                      className="w-full max-w-md rounded-2xl p-6 border shadow-2xl scale-100 animate-in fade-in zoom-in duration-200"
                      style={{
                        background: theme.colors.background,
                        borderColor: theme.colors.border,
                      }}
                    >
                      <h3 className="text-xl font-bold mb-2">Factory Reset?</h3>
                      <p className="text-theme-secondary mb-6 text-sm leading-relaxed">
                        Are you sure you want to delete all your library data?
                        This action cannot be undone.
                        <br />
                        <br />
                        <span className="font-semibold text-theme-primary">
                          Note:
                        </span>{" "}
                        Your downloaded music files will NOT be deleted from
                        your disk.
                      </p>

                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => setShowResetModal(false)}
                          className="px-4 py-2 rounded-lg font-medium hover:bg-theme-surface-hover transition-colors text-theme-secondary"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await factoryReset();
                              localStorage.clear();
                              window.location.reload();
                            } catch (e) {
                              console.error("Reset failed", e);
                              alert("Reset failed: " + e);
                            }
                          }}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-colors shadow-lg shadow-red-500/20"
                        >
                          Confirm Reset
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg mt-0.5"
                        style={{ background: theme.colors.surfaceHover }}
                      >
                        <NavidromeIcon />
                      </div>
                      <div>
                        <h3
                          className="font-medium mt-0.5"
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
                      className="w-full py-2 pt-[13px] rounded-lg text-sm font-medium transition-colors"
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
                          className="w-full px-3 py-2 pt-[13px] rounded-lg text-sm outline-none"
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
                            className="px-3 py-2 pt-[13px] rounded-lg text-sm outline-none"
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
                            className="px-3 py-2 pt-[13px] rounded-lg text-sm outline-none"
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
                        className="w-full py-2 pt-[13px] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg mt-0.5"
                        style={{ background: theme.colors.surfaceHover }}
                      >
                        <JellyfinIcon />
                      </div>
                      <div>
                        <h3
                          className="font-medium mt-0.5"
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
                      className="w-full py-2 pt-[13px] rounded-lg text-sm font-medium transition-colors"
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
                          className="w-full px-3 py-2 pt-[13px] rounded-lg text-sm outline-none"
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
                            className="px-3 py-2 pt-[13px] rounded-lg text-sm outline-none"
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
                            className="px-3 py-2 pt-[13px] rounded-lg text-sm outline-none"
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
                        className="w-full py-2 pt-[13px] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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

                {/* HiFi Instance Section */}
                <div ref={hifiSectionRef}>
                  <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-1 mt-6"
                    style={{ color: theme.colors.textMuted }}
                  >
                    Streaming Service
                  </h3>
                  <p
                    className="text-xs mb-4"
                    style={{ color: theme.colors.textSecondary }}
                  >
                    Configure HiFi streaming instance
                  </p>
                </div>

                <div
                  className="p-4 rounded-xl space-y-4"
                  style={{ background: theme.colors.surface }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg mt-0.5"
                        style={{ background: theme.colors.surfaceHover }}
                      >
                        <HifiIcon />
                      </div>
                      <div>
                        <h3
                          className="font-medium mt-0.5"
                          style={{ color: theme.colors.textPrimary }}
                        >
                          HiFi Instance
                        </h3>
                        <p
                          className="text-xs"
                          style={{
                            color:
                              hifiConfig && !hifiConfig.is_default
                                ? theme.colors.accent
                                : theme.colors.textSecondary,
                          }}
                        >
                          {hifiConfig && !hifiConfig.is_default
                            ? "Custom instance configured"
                            : "No instance configured"}
                        </p>
                      </div>
                    </div>
                    {hifiConfig && !hifiConfig.is_default && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: theme.colors.accent }}
                      />
                    )}
                  </div>

                  {/* Public URL with copy button */}
                  <div
                    className="p-3 rounded-lg space-y-2"
                    style={{
                      background: theme.colors.surfaceHover,
                      border: `1px solid ${theme.colors.border}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-medium"
                        style={{ color: theme.colors.textSecondary }}
                      >
                        Public Instance URL
                      </span>
                      <button
                        onClick={handleCopyHifiUrl}
                        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors"
                        style={{
                          background: hifiUrlCopied
                            ? theme.colors.accent + "20"
                            : theme.colors.surface,
                          color: hifiUrlCopied
                            ? theme.colors.accent
                            : theme.colors.textSecondary,
                        }}
                      >
                        {hifiUrlCopied ? (
                          <>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2"
                              />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                    <code
                      className="block text-xs break-all select-all"
                      style={{ color: theme.colors.textMuted }}
                    >
                      {PUBLIC_HIFI_INSTANCES_URL}
                    </code>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Paste your HiFi Instance URL here"
                      value={hifiUrl}
                      onChange={(e) => setHifiUrl(e.target.value)}
                      className="w-full px-3 py-2 pt-[13px] rounded-lg text-sm outline-none"
                      style={{
                        background: theme.colors.surfaceHover,
                        color: theme.colors.textPrimary,
                        border: `1px solid ${theme.colors.border}`,
                      }}
                    />
                    <p
                      className="text-xs"
                      style={{ color: theme.colors.textMuted }}
                    >
                      Copy the public URL above or use your own self-hosted
                      instance URL. The URL should point to a JSON file
                      containing API endpoint instances.
                    </p>
                  </div>

                  {hifiError && (
                    <p className="text-xs" style={{ color: "#ef4444" }}>
                      {hifiError}
                    </p>
                  )}
                  {hifiSuccess && (
                    <p
                      className="text-xs"
                      style={{ color: theme.colors.accent }}
                    >
                      {hifiSuccess}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleHifiSave}
                      disabled={hifiLoading || !hifiUrl}
                      className="flex-1 py-2 pt-[13px] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
                      className="py-2 pt-[13px] px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      style={{
                        background: theme.colors.surfaceHover,
                        color: theme.colors.textPrimary,
                      }}
                    >
                      Clear
                    </button>
                  </div>
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

          {/* Danger Zone */}

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
