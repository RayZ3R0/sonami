import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { configureSubsonic, configureJellyfin } from "../api/providers";

interface WelcomePageProps {
  onComplete: () => void;
}

export const WelcomePage = ({ onComplete }: WelcomePageProps) => {
  const { theme } = useTheme();
  const [step, setStep] = useState<"intro" | "subsonic" | "jellyfin">("intro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSkip = () => {
    localStorage.setItem("onboarding_complete", "true");
    onComplete();
  };

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      if (step === "subsonic") {
        await configureSubsonic(url, username, password);
      } else if (step === "jellyfin") {
        await configureJellyfin(url, username, password);
      }
      handleSkip(); // Complete onboarding on success
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  if (step === "intro") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center z-50 p-8"
        style={{
          background: theme.colors.background,
          color: theme.colors.textPrimary,
        }}
      >
        <div className="max-w-md w-full text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Welcome to Sonami
            </h1>
            <p className="text-lg opacity-70">
              Your ultimate unified music player. Connect your libraries to get
              started.
            </p>
          </div>

          <div className="grid gap-4">
            <button
              onClick={() => setStep("subsonic")}
              className="w-full p-4 pt-[20px] rounded-xl border border-theme-border hover:bg-theme-surface transition-colors flex items-center justify-between group"
              style={{ borderColor: theme.colors.border }}
            >
              <span className="font-semibold">
                Connect Subsonic / Navidrome
              </span>
              <span className="opacity-50 group-hover:translate-x-1 transition-transform">
                →
              </span>
            </button>
            <button
              onClick={() => setStep("jellyfin")}
              className="w-full p-4 pt-[20px] rounded-xl border border-theme-border hover:bg-theme-surface transition-colors flex items-center justify-between group"
              style={{ borderColor: theme.colors.border }}
            >
              <span className="font-semibold">Connect Jellyfin</span>
              <span className="opacity-50 group-hover:translate-x-1 transition-transform">
                →
              </span>
            </button>
          </div>

          <div
            className="pt-8 border-t"
            style={{ borderColor: theme.colors.border }}
          >
            <button
              onClick={handleSkip}
              className="text-sm font-medium hover:underline opacity-60 hover:opacity-100 transition-opacity"
            >
              Skip setup (Tidal only)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-50 p-8"
      style={{
        background: theme.colors.background,
        color: theme.colors.textPrimary,
      }}
    >
      <div className="max-w-md w-full space-y-8">
        <div>
          <button
            onClick={() => {
              setStep("intro");
              setError(null);
            }}
            className="text-sm font-medium mb-4 flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity"
          >
            ← Back
          </button>
          <h2 className="text-2xl font-bold">
            Connect {step === "subsonic" ? "Subsonic" : "Jellyfin"}
          </h2>
          <p className="text-sm opacity-70 mt-2">
            Enter your server details to access your library.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">
              Server URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://music.example.com"
              className="w-full p-3 pt-[15.5px] rounded-lg bg-theme-surface border border-theme-border focus:outline-none focus:ring-2 focus:ring-theme-accent"
              style={{
                background: theme.colors.surface,
                borderColor: theme.colors.border,
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 pt-[15.5px] rounded-lg bg-theme-surface border border-theme-border focus:outline-none focus:ring-2 focus:ring-theme-accent"
              style={{
                background: theme.colors.surface,
                borderColor: theme.colors.border,
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1 opacity-70">
              {step === "subsonic" ? "Password" : "Password / API Token"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 pt-[15.5px] rounded-lg bg-theme-surface border border-theme-border focus:outline-none focus:ring-2 focus:ring-theme-accent"
              style={{
                background: theme.colors.surface,
                borderColor: theme.colors.border,
              }}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm border border-red-500/20">
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={loading || !url || !username || !password}
          className="w-full p-4 rounded-xl bg-theme-accent text-white font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          style={{
            background: theme.colors.accent,
            color: theme.colors.textInverse,
          }}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Connect Library"
          )}
        </button>
      </div>
    </div>
  );
};
