import { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import { useIsMobile } from "../hooks/useIsMobile";

const SparklesIcon = () => (
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
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);

const HifiIcon = () => (
  <svg
    width="32"
    height="32"
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

const ExternalLinkIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

const CloseIcon = () => (
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
    <path d="M18 6 6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

// Storage key for tracking if notification has been shown
const NOTIFICATION_SHOWN_KEY = "sonami_update_notification_shown_v0.1.10";

// Public HiFi instances URL
const PUBLIC_HIFI_INSTANCES_URL = "https://raw.githubusercontent.com/EduardPrigoana/hifi-instances/refs/heads/main/instances.json";

interface UpdateNotificationModalProps {
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const UpdateNotificationModal = ({
  onClose,
  onOpenSettings,
}: UpdateNotificationModalProps) => {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const [urlCopied, setUrlCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_HIFI_INSTANCES_URL);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy URL:", e);
    }
  };

  const handleSetupClick = () => {
    // Open the GitHub repo for HiFi setup instructions
    window.open(
      "https://github.com/sachinsenal0x64/hifi?tab=readme-ov-file#-installation-",
      "_blank",
    );
  };

  const handleDismiss = () => {
    // Mark as shown so it doesn't appear again
    localStorage.setItem(NOTIFICATION_SHOWN_KEY, "true");
    onClose();
  };

  const handleConfigureNow = () => {
    // Mark as shown and open settings
    localStorage.setItem(NOTIFICATION_SHOWN_KEY, "true");
    onClose();
    if (onOpenSettings) {
      onOpenSettings();
    }
  };

  if (isMobile) {
    // Mobile: Bottom sheet style
    return (
      <div className="fixed inset-0 z-[9999] flex items-end justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleDismiss}
        />

        {/* Sheet */}
        <div
          className="relative w-full max-h-[85vh] rounded-t-3xl overflow-hidden animate-slide-up safe-area-bottom"
          style={{ background: theme.colors.background }}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div
              className="w-10 h-1.5 rounded-full"
              style={{ background: theme.colors.surfaceActive }}
            />
          </div>

          {/* Content */}
          <div className="px-6 pb-8">
            {/* Header with icon */}
            <div className="flex flex-col items-center text-center mb-6">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.accent}30, ${theme.colors.accent}10)`,
                  color: theme.colors.accent,
                  boxShadow: `0 8px 32px ${theme.colors.accent}20`,
                }}
              >
                <HifiIcon />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <SparklesIcon />
                <h2 className="text-xl font-bold text-theme-primary">
                  What's New!
                </h2>
              </div>
              <p className="text-theme-secondary text-sm">Version 0.1.10</p>
            </div>

            {/* Features list */}
            <div className="space-y-4 mb-6">
              <div
                className="p-4 rounded-xl"
                style={{ background: theme.colors.surfaceHover }}
              >
                <h3 className="font-semibold text-theme-primary mb-1">
                  HiFi Instance Configuration
                </h3>
                <p className="text-sm text-theme-secondary leading-relaxed">
                  Configure your HiFi instance URL in Settings → Services.
                  Copy the public URL below to get started:
                </p>
              </div>

              {/* Public URL with copy button */}
              <div
                className="p-4 rounded-xl"
                style={{
                  background: theme.colors.surface,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs font-medium"
                    style={{ color: theme.colors.textSecondary }}
                  >
                    Public Instance URL
                  </span>
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
                    style={{
                      background: urlCopied
                        ? theme.colors.accent
                        : theme.colors.surfaceHover,
                      color: urlCopied
                        ? theme.colors.textInverse
                        : theme.colors.textSecondary,
                    }}
                  >
                    {urlCopied ? (
                      <>
                        <svg
                          width="14"
                          height="14"
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
                          width="14"
                          height="14"
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
                        Copy URL
                      </>
                    )}
                  </button>
                </div>
                <code
                  className="block text-xs break-all select-all leading-relaxed"
                  style={{ color: theme.colors.textMuted }}
                >
                  {PUBLIC_HIFI_INSTANCES_URL}
                </code>
              </div>

              <div
                className="p-4 rounded-xl"
                style={{ background: theme.colors.surfaceHover }}
              >
                <h3 className="font-semibold text-theme-primary mb-1">
                  Self-Hosting Support
                </h3>
                <p className="text-sm text-theme-secondary leading-relaxed">
                  Want more control? Host your own HiFi instance for enhanced
                  privacy and reliability.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleConfigureNow}
                className="w-full py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                style={{
                  background: theme.colors.accent,
                  color: theme.colors.textInverse,
                }}
              >
                <svg
                  width="16"
                  height="16"
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
                <span>Configure Now</span>
              </button>
              <button
                onClick={handleSetupClick}
                className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                style={{
                  background: theme.colors.surfaceHover,
                  color: theme.colors.textPrimary,
                }}
              >
                <span>View Setup Guide</span>
                <ExternalLinkIcon />
              </button>
              <button
                onClick={handleDismiss}
                className="w-full py-3 rounded-xl text-sm font-medium transition-colors active:scale-[0.98]"
                style={{
                  background: "transparent",
                  color: theme.colors.textSecondary,
                }}
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Centered modal
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scale-in"
        style={{
          background: theme.colors.background,
          boxShadow: `0 25px 50px -12px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-full transition-colors hover:bg-theme-surface-hover z-10"
          style={{ color: theme.colors.textMuted }}
        >
          <CloseIcon />
        </button>

        {/* Decorative gradient header */}
        <div
          className="h-2"
          style={{
            background: `linear-gradient(90deg, ${theme.colors.accent}, ${theme.colors.accent}80)`,
          }}
        />

        {/* Content */}
        <div className="p-6">
          {/* Header with icon */}
          <div className="flex flex-col items-center text-center mb-6">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center mb-4"
              style={{
                background: `linear-gradient(135deg, ${theme.colors.accent}25, ${theme.colors.accent}08)`,
                color: theme.colors.accent,
              }}
            >
              <HifiIcon />
            </div>
            <div
              className="flex items-center gap-2 mb-1"
              style={{ color: theme.colors.accent }}
            >
              <SparklesIcon />
              <h2 className="text-lg font-bold text-theme-primary">
                What's New in v0.1.10
              </h2>
            </div>
            <p className="text-theme-muted text-sm">
              New features and improvements
            </p>
          </div>

          {/* Features */}
          <div className="space-y-3 mb-6">
            <div
              className="p-4 rounded-xl border"
              style={{
                background: theme.colors.surface,
                borderColor: theme.colors.border,
              }}
            >
              <h3 className="font-semibold text-theme-primary mb-1 text-sm">
                🎵 HiFi Instance Configuration
              </h3>
              <p className="text-xs text-theme-secondary leading-relaxed">
                Configure your HiFi streaming instance URL in Settings →
                Services. Copy the public URL below to get started.
              </p>
            </div>

            {/* Public URL with copy button */}
            <div
              className="p-3 rounded-xl border"
              style={{
                background: theme.colors.surfaceHover,
                borderColor: theme.colors.border,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs font-medium"
                  style={{ color: theme.colors.textSecondary }}
                >
                  Public Instance URL
                </span>
                <button
                  onClick={handleCopyUrl}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all"
                  style={{
                    background: urlCopied
                      ? theme.colors.accent
                      : theme.colors.surface,
                    color: urlCopied
                      ? theme.colors.textInverse
                      : theme.colors.textSecondary,
                  }}
                >
                  {urlCopied ? (
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

            <div
              className="p-4 rounded-xl border"
              style={{
                background: theme.colors.surface,
                borderColor: theme.colors.border,
              }}
            >
              <h3 className="font-semibold text-theme-primary mb-1 text-sm">
                🖥️ Self-Hosting Support
              </h3>
              <p className="text-xs text-theme-secondary leading-relaxed">
                Want more control? Host your own HiFi instance for enhanced
                privacy.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleConfigureNow}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors hover:opacity-90 flex items-center justify-center gap-2"
              style={{
                background: theme.colors.accent,
                color: theme.colors.textInverse,
              }}
            >
              <svg
                width="14"
                height="14"
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
              <span className="pt-[3px]">Configure</span>
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80 flex items-center justify-center"
              style={{
                background: theme.colors.surfaceHover,
                color: theme.colors.textSecondary,
              }}
            >
              <span className="pt-[3px]">Dismiss</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Hook to manage showing the update notification
export const useUpdateNotification = () => {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Check if we've already shown this notification
    const hasShown = localStorage.getItem(NOTIFICATION_SHOWN_KEY);
    if (!hasShown) {
      // Small delay to let the app settle before showing
      const timer = setTimeout(() => {
        setShouldShow(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(NOTIFICATION_SHOWN_KEY, "true");
    setShouldShow(false);
  };

  return { shouldShow, dismiss };
};
