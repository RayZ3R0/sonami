import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { defaultTheme, allThemes } from "../themes";
import type { Theme } from "../themes";

export type { Theme, ThemeColors } from "../themes";
export { createTheme, defaultTheme } from "../themes";

const themes: Record<string, Theme> = {
  default: defaultTheme,
  ...Object.fromEntries(allThemes.map((t) => [t.id, t])),
};

interface ThemeContextType {
  theme: Theme;
  themeId: string;
  availableThemes: Theme[];
  setTheme: (themeId: string) => void;
  registerTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "sonami-theme";

// Sync theme to CSS
const applyThemeToDocument = (theme: Theme) => {
  const root = document.documentElement;
  const colors = theme.colors;

  root.style.setProperty("--theme-background", colors.background);
  root.style.setProperty(
    "--theme-background-secondary",
    colors.backgroundSecondary,
  );
  root.style.setProperty(
    "--theme-background-tertiary",
    colors.backgroundTertiary,
  );

  root.style.setProperty("--theme-surface", colors.surface);
  root.style.setProperty("--theme-surface-hover", colors.surfaceHover);
  root.style.setProperty("--theme-surface-active", colors.surfaceActive);

  root.style.setProperty("--theme-glass", colors.glass);
  root.style.setProperty("--theme-glass-hover", colors.glassHover);
  root.style.setProperty("--theme-glass-border", colors.glassBorder);

  root.style.setProperty("--theme-text-primary", colors.textPrimary);
  root.style.setProperty("--theme-text-secondary", colors.textSecondary);
  root.style.setProperty("--theme-text-muted", colors.textMuted);
  root.style.setProperty("--theme-text-inverse", colors.textInverse);

  root.style.setProperty("--theme-accent", colors.accent);
  root.style.setProperty("--theme-accent-hover", colors.accentHover);
  root.style.setProperty("--theme-accent-muted", colors.accentMuted);

  root.style.setProperty("--theme-interactive", colors.interactive);
  root.style.setProperty("--theme-interactive-hover", colors.interactiveHover);
  root.style.setProperty(
    "--theme-interactive-active",
    colors.interactiveActive,
  );

  root.style.setProperty("--theme-success", colors.success);
  root.style.setProperty("--theme-warning", colors.warning);
  root.style.setProperty("--theme-error", colors.error);

  root.style.setProperty("--theme-progress-track", colors.progressTrack);
  root.style.setProperty("--theme-progress-fill", colors.progressFill);
  root.style.setProperty(
    "--theme-progress-fill-gradient",
    colors.progressFillGradient,
  );

  root.style.setProperty("--theme-overlay-light", colors.overlayLight);
  root.style.setProperty("--theme-overlay-medium", colors.overlayMedium);
  root.style.setProperty("--theme-overlay-heavy", colors.overlayHeavy);

  root.style.setProperty("--theme-border", colors.border);
  root.style.setProperty("--theme-border-subtle", colors.borderSubtle);
  root.style.setProperty("--theme-border-focus", colors.borderFocus);

  root.style.setProperty("--theme-shadow-color", colors.shadowColor);

  // Set data attribute for potential CSS selectors
  root.setAttribute("data-theme", theme.id);
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeId, setThemeId] = useState<string>(() => {
    // Load saved theme or use default
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved && themes[saved]) {
        return saved;
      }
    }
    return "default";
  });

  const [themeRegistry, setThemeRegistry] =
    useState<Record<string, Theme>>(themes);

  const theme = themeRegistry[themeId] || defaultTheme;

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = useCallback(
    (newThemeId: string) => {
      if (themeRegistry[newThemeId]) {
        setThemeId(newThemeId);
        localStorage.setItem(THEME_STORAGE_KEY, newThemeId);
      }
    },
    [themeRegistry],
  );

  const registerTheme = useCallback((newTheme: Theme) => {
    setThemeRegistry((prev) => ({
      ...prev,
      [newTheme.id]: newTheme,
    }));
  }, []);

  const availableThemes = Object.values(themeRegistry);

  return (
    <ThemeContext.Provider
      value={{ theme, themeId, availableThemes, setTheme, registerTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
