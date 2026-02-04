import { createTheme } from "./types";
import type { Theme } from "./types";

// Re-export types for convenience
export type { Theme, ThemeColors } from "./types";
export { createTheme, defaultTheme } from "./types";

// Catppuccin Latte (Light)
export const catppuccinLatte = createTheme(
  "catppuccin-latte",
  "Catppuccin Latte",
  {
    background: "#eff1f5",
    backgroundSecondary: "#e6e9ef",
    backgroundTertiary: "#dce0e8",

    surface: "rgba(255, 255, 255, 0.8)",
    surfaceHover: "rgba(140, 143, 161, 0.15)",
    surfaceActive: "rgba(140, 143, 161, 0.25)",

    glass: "rgba(255, 255, 255, 0.85)",
    glassHover: "rgba(255, 255, 255, 0.95)",
    glassBorder: "rgba(204, 208, 218, 0.6)",

    textPrimary: "#4c4f69",
    textSecondary: "#6c6f85",
    textMuted: "#8c8fa1",
    textInverse: "#eff1f5",

    accent: "#8839ef",
    accentHover: "#9c4dff",
    accentMuted: "rgba(136, 57, 239, 0.15)",

    interactive: "rgba(140, 143, 161, 0.1)",
    interactiveHover: "rgba(140, 143, 161, 0.18)",
    interactiveActive: "rgba(140, 143, 161, 0.25)",

    success: "#40a02b",
    warning: "#df8e1d",
    error: "#d20f39",

    progressTrack: "rgba(76, 79, 105, 0.15)",
    progressFill: "rgba(136, 57, 239, 0.7)",
    progressFillGradient: "#8839ef",

    overlayLight: "rgba(76, 79, 105, 0.05)",
    overlayMedium: "rgba(76, 79, 105, 0.3)",
    overlayHeavy: "rgba(76, 79, 105, 0.6)",

    border: "rgba(204, 208, 218, 0.8)",
    borderSubtle: "rgba(204, 208, 218, 0.5)",
    borderFocus: "#8839ef",

    shadowColor: "rgba(76, 79, 105, 0.15)",
  },
);

// Catppuccin Frappé (Dark)
export const catppuccinFrappe = createTheme(
  "catppuccin-frappe",
  "Catppuccin Frappé",
  {
    background: "#303446",
    backgroundSecondary: "#292c3c",
    backgroundTertiary: "#232634",

    surface: "rgba(65, 69, 89, 0.6)",
    surfaceHover: "rgba(165, 173, 206, 0.1)",
    surfaceActive: "rgba(165, 173, 206, 0.18)",

    glass: "rgba(65, 69, 89, 0.8)",
    glassHover: "rgba(81, 87, 109, 0.9)",
    glassBorder: "rgba(98, 104, 128, 0.4)",

    textPrimary: "#c6d0f5",
    textSecondary: "#a5adce",
    textMuted: "#949cbb",
    textInverse: "#303446",

    accent: "#ca9ee6",
    accentHover: "#e5c2ff",
    accentMuted: "rgba(202, 158, 230, 0.2)",

    interactive: "rgba(165, 173, 206, 0.08)",
    interactiveHover: "rgba(165, 173, 206, 0.15)",
    interactiveActive: "rgba(165, 173, 206, 0.22)",

    success: "#a6d189",
    warning: "#e5c890",
    error: "#e78284",

    progressTrack: "rgba(165, 173, 206, 0.15)",
    progressFill: "rgba(202, 158, 230, 0.7)",
    progressFillGradient: "#ca9ee6",

    overlayLight: "rgba(0, 0, 0, 0.1)",
    overlayMedium: "rgba(0, 0, 0, 0.4)",
    overlayHeavy: "rgba(0, 0, 0, 0.6)",

    border: "rgba(98, 104, 128, 0.5)",
    borderSubtle: "rgba(81, 87, 109, 0.4)",
    borderFocus: "#ca9ee6",

    shadowColor: "rgba(0, 0, 0, 0.4)",
  },
);

// Catppuccin Macchiato (Dark)
export const catppuccinMacchiato = createTheme(
  "catppuccin-macchiato",
  "Catppuccin Macchiato",
  {
    background: "#24273a",
    backgroundSecondary: "#1e2030",
    backgroundTertiary: "#181926",

    surface: "rgba(54, 58, 79, 0.6)",
    surfaceHover: "rgba(165, 173, 203, 0.1)",
    surfaceActive: "rgba(165, 173, 203, 0.18)",

    glass: "rgba(54, 58, 79, 0.8)",
    glassHover: "rgba(73, 77, 100, 0.9)",
    glassBorder: "rgba(91, 96, 120, 0.4)",

    textPrimary: "#cad3f5",
    textSecondary: "#a5adc8",
    textMuted: "#939ab7",
    textInverse: "#24273a",

    accent: "#c6a0f6",
    accentHover: "#ddb6ff",
    accentMuted: "rgba(198, 160, 246, 0.2)",

    interactive: "rgba(165, 173, 203, 0.08)",
    interactiveHover: "rgba(165, 173, 203, 0.15)",
    interactiveActive: "rgba(165, 173, 203, 0.22)",

    success: "#a6da95",
    warning: "#eed49f",
    error: "#ed8796",

    progressTrack: "rgba(165, 173, 203, 0.15)",
    progressFill: "rgba(198, 160, 246, 0.7)",
    progressFillGradient: "#c6a0f6",

    overlayLight: "rgba(0, 0, 0, 0.1)",
    overlayMedium: "rgba(0, 0, 0, 0.4)",
    overlayHeavy: "rgba(0, 0, 0, 0.6)",

    border: "rgba(91, 96, 120, 0.5)",
    borderSubtle: "rgba(73, 77, 100, 0.4)",
    borderFocus: "#c6a0f6",

    shadowColor: "rgba(0, 0, 0, 0.45)",
  },
);

// Catppuccin Mocha (Dark)
export const catppuccinMocha = createTheme(
  "catppuccin-mocha",
  "Catppuccin Mocha",
  {
    background: "#1e1e2e",
    backgroundSecondary: "#181825",
    backgroundTertiary: "#11111b",

    surface: "rgba(49, 50, 68, 0.6)",
    surfaceHover: "rgba(166, 173, 200, 0.1)",
    surfaceActive: "rgba(166, 173, 200, 0.18)",

    glass: "rgba(49, 50, 68, 0.8)",
    glassHover: "rgba(69, 71, 90, 0.9)",
    glassBorder: "rgba(88, 91, 112, 0.4)",

    textPrimary: "#cdd6f4",
    textSecondary: "#a6adc8",
    textMuted: "#9399b2",
    textInverse: "#1e1e2e",

    accent: "#cba6f7",
    accentHover: "#e4bbff",
    accentMuted: "rgba(203, 166, 247, 0.2)",

    interactive: "rgba(166, 173, 200, 0.08)",
    interactiveHover: "rgba(166, 173, 200, 0.15)",
    interactiveActive: "rgba(166, 173, 200, 0.22)",

    success: "#a6e3a1",
    warning: "#f9e2af",
    error: "#f38ba8",

    progressTrack: "rgba(166, 173, 200, 0.15)",
    progressFill: "rgba(203, 166, 247, 0.7)",
    progressFillGradient: "#cba6f7",

    overlayLight: "rgba(0, 0, 0, 0.1)",
    overlayMedium: "rgba(0, 0, 0, 0.4)",
    overlayHeavy: "rgba(0, 0, 0, 0.6)",

    border: "rgba(88, 91, 112, 0.5)",
    borderSubtle: "rgba(69, 71, 90, 0.4)",
    borderFocus: "#cba6f7",

    shadowColor: "rgba(0, 0, 0, 0.5)",
  },
);

// Matcha (Light)
export const matcha = createTheme("matcha", "Matcha", {
  background: "#f7f4e9",
  backgroundSecondary: "#ece8d9",
  backgroundTertiary: "#e0dccb",

  surface: "rgba(255, 255, 255, 0.8)",
  surfaceHover: "rgba(111, 117, 95, 0.1)",
  surfaceActive: "rgba(111, 117, 95, 0.18)",

  glass: "rgba(255, 255, 255, 0.85)",
  glassHover: "rgba(255, 255, 255, 0.95)",
  glassBorder: "rgba(211, 209, 197, 0.6)",

  textPrimary: "#3a4032",
  textSecondary: "#5a6150",
  textMuted: "#6f755f",
  textInverse: "#f7f4e9",

  accent: "#7fa650",
  accentHover: "#a6c977",
  accentMuted: "rgba(127, 166, 80, 0.15)",

  interactive: "rgba(111, 117, 95, 0.08)",
  interactiveHover: "rgba(111, 117, 95, 0.15)",
  interactiveActive: "rgba(111, 117, 95, 0.22)",

  success: "#7fa650",
  warning: "#c9a227",
  error: "#c75c5c",

  progressTrack: "rgba(58, 64, 50, 0.12)",
  progressFill: "rgba(127, 166, 80, 0.7)",
  progressFillGradient: "#7fa650",

  overlayLight: "rgba(58, 64, 50, 0.05)",
  overlayMedium: "rgba(58, 64, 50, 0.3)",
  overlayHeavy: "rgba(58, 64, 50, 0.6)",

  border: "rgba(211, 209, 197, 0.8)",
  borderSubtle: "rgba(211, 209, 197, 0.5)",
  borderFocus: "#7fa650",

  shadowColor: "rgba(58, 64, 50, 0.12)",
});

// Nord (Dark)
export const nord = createTheme("nord", "Nord", {
  background: "#2e3440",
  backgroundSecondary: "#3b4252",
  backgroundTertiary: "#242933",

  surface: "rgba(67, 76, 94, 0.6)",
  surfaceHover: "rgba(216, 222, 233, 0.08)",
  surfaceActive: "rgba(216, 222, 233, 0.15)",

  glass: "rgba(67, 76, 94, 0.8)",
  glassHover: "rgba(76, 86, 106, 0.9)",
  glassBorder: "rgba(94, 110, 135, 0.4)",

  textPrimary: "#eceff4",
  textSecondary: "#d8dee9",
  textMuted: "#a5b1c2",
  textInverse: "#2e3440",

  accent: "#88c0d0",
  accentHover: "#8fbcbb",
  accentMuted: "rgba(136, 192, 208, 0.2)",

  interactive: "rgba(216, 222, 233, 0.06)",
  interactiveHover: "rgba(216, 222, 233, 0.12)",
  interactiveActive: "rgba(216, 222, 233, 0.18)",

  success: "#a3be8c",
  warning: "#ebcb8b",
  error: "#bf616a",

  progressTrack: "rgba(216, 222, 233, 0.12)",
  progressFill: "rgba(136, 192, 208, 0.7)",
  progressFillGradient: "#88c0d0",

  overlayLight: "rgba(0, 0, 0, 0.1)",
  overlayMedium: "rgba(0, 0, 0, 0.4)",
  overlayHeavy: "rgba(0, 0, 0, 0.6)",

  border: "rgba(94, 110, 135, 0.5)",
  borderSubtle: "rgba(81, 96, 119, 0.4)",
  borderFocus: "#88c0d0",

  shadowColor: "rgba(0, 0, 0, 0.4)",
});

// Gruvbox (Dark)
export const gruvbox = createTheme("gruvbox", "Gruvbox", {
  background: "#282828",
  backgroundSecondary: "#3c3836",
  backgroundTertiary: "#1d2021",

  surface: "rgba(50, 48, 47, 0.6)",
  surfaceHover: "rgba(213, 196, 161, 0.08)",
  surfaceActive: "rgba(213, 196, 161, 0.15)",

  glass: "rgba(60, 56, 54, 0.8)",
  glassHover: "rgba(80, 73, 69, 0.9)",
  glassBorder: "rgba(124, 111, 100, 0.4)",

  textPrimary: "#ebdbb2",
  textSecondary: "#d5c4a1",
  textMuted: "#a89984",
  textInverse: "#282828",

  accent: "#8ec07c",
  accentHover: "#b8bb26",
  accentMuted: "rgba(142, 192, 124, 0.2)",

  interactive: "rgba(213, 196, 161, 0.06)",
  interactiveHover: "rgba(213, 196, 161, 0.12)",
  interactiveActive: "rgba(213, 196, 161, 0.18)",

  success: "#b8bb26",
  warning: "#fabd2f",
  error: "#fb4934",

  progressTrack: "rgba(213, 196, 161, 0.12)",
  progressFill: "rgba(142, 192, 124, 0.7)",
  progressFillGradient: "#8ec07c",

  overlayLight: "rgba(0, 0, 0, 0.1)",
  overlayMedium: "rgba(0, 0, 0, 0.4)",
  overlayHeavy: "rgba(0, 0, 0, 0.6)",

  border: "rgba(124, 111, 100, 0.5)",
  borderSubtle: "rgba(102, 92, 84, 0.4)",
  borderFocus: "#8ec07c",

  shadowColor: "rgba(0, 0, 0, 0.5)",
});

// Dracula (Dark)
export const dracula = createTheme("dracula", "Dracula", {
  background: "#282a36",
  backgroundSecondary: "#343746",
  backgroundTertiary: "#21222c",

  surface: "rgba(68, 71, 90, 0.6)",
  surfaceHover: "rgba(248, 248, 242, 0.08)",
  surfaceActive: "rgba(248, 248, 242, 0.15)",

  glass: "rgba(68, 71, 90, 0.8)",
  glassHover: "rgba(77, 81, 113, 0.9)",
  glassBorder: "rgba(139, 143, 176, 0.4)",

  textPrimary: "#f8f8f2",
  textSecondary: "#bfbfbf",
  textMuted: "#9090a0",
  textInverse: "#282a36",

  accent: "#bd93f9",
  accentHover: "#d6baff",
  accentMuted: "rgba(189, 147, 249, 0.2)",

  interactive: "rgba(248, 248, 242, 0.06)",
  interactiveHover: "rgba(248, 248, 242, 0.12)",
  interactiveActive: "rgba(248, 248, 242, 0.18)",

  success: "#50fa7b",
  warning: "#f1fa8c",
  error: "#ff5555",

  progressTrack: "rgba(248, 248, 242, 0.12)",
  progressFill: "rgba(189, 147, 249, 0.7)",
  progressFillGradient: "#bd93f9",

  overlayLight: "rgba(0, 0, 0, 0.1)",
  overlayMedium: "rgba(0, 0, 0, 0.4)",
  overlayHeavy: "rgba(0, 0, 0, 0.6)",

  border: "rgba(119, 123, 156, 0.5)",
  borderSubtle: "rgba(98, 102, 130, 0.4)",
  borderFocus: "#bd93f9",

  shadowColor: "rgba(0, 0, 0, 0.45)",
});

// Solarized Light
export const solarizedLight = createTheme(
  "solarized-light",
  "Solarized Light",
  {
    background: "#fdf6e3",
    backgroundSecondary: "#eee8d5",
    backgroundTertiary: "#e4ddc8",

    surface: "rgba(254, 254, 254, 0.8)",
    surfaceHover: "rgba(88, 110, 117, 0.1)",
    surfaceActive: "rgba(88, 110, 117, 0.18)",

    glass: "rgba(254, 254, 254, 0.85)",
    glassHover: "rgba(254, 254, 254, 0.95)",
    glassBorder: "rgba(224, 224, 224, 0.6)",

    textPrimary: "#073642",
    textSecondary: "#586e75",
    textMuted: "#93a1a1",
    textInverse: "#fdf6e3",

    accent: "#268bd2",
    accentHover: "#4ca4e8",
    accentMuted: "rgba(38, 139, 210, 0.15)",

    interactive: "rgba(88, 110, 117, 0.08)",
    interactiveHover: "rgba(88, 110, 117, 0.15)",
    interactiveActive: "rgba(88, 110, 117, 0.22)",

    success: "#859900",
    warning: "#b58900",
    error: "#dc322f",

    progressTrack: "rgba(7, 54, 66, 0.12)",
    progressFill: "rgba(38, 139, 210, 0.7)",
    progressFillGradient: "#268bd2",

    overlayLight: "rgba(7, 54, 66, 0.05)",
    overlayMedium: "rgba(7, 54, 66, 0.3)",
    overlayHeavy: "rgba(7, 54, 66, 0.6)",

    border: "rgba(224, 224, 224, 0.8)",
    borderSubtle: "rgba(224, 224, 224, 0.5)",
    borderFocus: "#268bd2",

    shadowColor: "rgba(7, 54, 66, 0.12)",
  },
);

// Solarized Dark
export const solarizedDark = createTheme("solarized-dark", "Solarized Dark", {
  background: "#002b36",
  backgroundSecondary: "#073642",
  backgroundTertiary: "#001f27",

  surface: "rgba(7, 54, 66, 0.6)",
  surfaceHover: "rgba(147, 161, 161, 0.1)",
  surfaceActive: "rgba(147, 161, 161, 0.18)",

  glass: "rgba(7, 54, 66, 0.8)",
  glassHover: "rgba(17, 71, 82, 0.9)",
  glassBorder: "rgba(101, 123, 131, 0.4)",

  textPrimary: "#fdf6e3",
  textSecondary: "#93a1a1",
  textMuted: "#657b83",
  textInverse: "#002b36",

  accent: "#268bd2",
  accentHover: "#4ca4e8",
  accentMuted: "rgba(38, 139, 210, 0.2)",

  interactive: "rgba(147, 161, 161, 0.08)",
  interactiveHover: "rgba(147, 161, 161, 0.15)",
  interactiveActive: "rgba(147, 161, 161, 0.22)",

  success: "#859900",
  warning: "#b58900",
  error: "#dc322f",

  progressTrack: "rgba(147, 161, 161, 0.15)",
  progressFill: "rgba(38, 139, 210, 0.7)",
  progressFillGradient: "#268bd2",

  overlayLight: "rgba(0, 0, 0, 0.1)",
  overlayMedium: "rgba(0, 0, 0, 0.4)",
  overlayHeavy: "rgba(0, 0, 0, 0.6)",

  border: "rgba(88, 110, 117, 0.5)",
  borderSubtle: "rgba(88, 110, 117, 0.35)",
  borderFocus: "#268bd2",

  shadowColor: "rgba(0, 0, 0, 0.5)",
});

// Rosé Pine (Dark)
export const rosePine = createTheme("rose-pine", "Rosé Pine", {
  background: "#191724",
  backgroundSecondary: "#1f1d2e",
  backgroundTertiary: "#14121f",

  surface: "rgba(38, 35, 58, 0.6)",
  surfaceHover: "rgba(224, 222, 244, 0.08)",
  surfaceActive: "rgba(224, 222, 244, 0.15)",

  glass: "rgba(38, 35, 58, 0.8)",
  glassHover: "rgba(42, 39, 63, 0.9)",
  glassBorder: "rgba(82, 79, 103, 0.4)",

  textPrimary: "#e0def4",
  textSecondary: "#908caa",
  textMuted: "#6e6a86",
  textInverse: "#191724",

  accent: "#ebbcba",
  accentHover: "#f4cbc9",
  accentMuted: "rgba(235, 188, 186, 0.2)",

  interactive: "rgba(224, 222, 244, 0.06)",
  interactiveHover: "rgba(224, 222, 244, 0.12)",
  interactiveActive: "rgba(224, 222, 244, 0.18)",

  success: "#9ccfd8",
  warning: "#f6c177",
  error: "#eb6f92",

  progressTrack: "rgba(224, 222, 244, 0.12)",
  progressFill: "rgba(235, 188, 186, 0.7)",
  progressFillGradient: "#ebbcba",

  overlayLight: "rgba(0, 0, 0, 0.1)",
  overlayMedium: "rgba(0, 0, 0, 0.4)",
  overlayHeavy: "rgba(0, 0, 0, 0.6)",

  border: "rgba(64, 61, 88, 0.5)",
  borderSubtle: "rgba(56, 53, 76, 0.4)",
  borderFocus: "#ebbcba",

  shadowColor: "rgba(0, 0, 0, 0.5)",
});

// Tokyo Night (Dark)
export const tokyoNight = createTheme("tokyo-night", "Tokyo Night", {
  background: "#1a1b26",
  backgroundSecondary: "#24283b",
  backgroundTertiary: "#13141c",

  surface: "rgba(47, 53, 73, 0.6)",
  surfaceHover: "rgba(192, 202, 245, 0.08)",
  surfaceActive: "rgba(192, 202, 245, 0.15)",

  glass: "rgba(47, 53, 73, 0.8)",
  glassHover: "rgba(53, 59, 84, 0.9)",
  glassBorder: "rgba(84, 92, 126, 0.4)",

  textPrimary: "#c0caf5",
  textSecondary: "#a9b1d6",
  textMuted: "#737aa2",
  textInverse: "#1a1b26",

  accent: "#7aa2f7",
  accentHover: "#96b1fa",
  accentMuted: "rgba(122, 162, 247, 0.2)",

  interactive: "rgba(192, 202, 245, 0.06)",
  interactiveHover: "rgba(192, 202, 245, 0.12)",
  interactiveActive: "rgba(192, 202, 245, 0.18)",

  success: "#9ece6a",
  warning: "#e0af68",
  error: "#f7768e",

  progressTrack: "rgba(192, 202, 245, 0.12)",
  progressFill: "rgba(122, 162, 247, 0.7)",
  progressFillGradient: "#7aa2f7",

  overlayLight: "rgba(0, 0, 0, 0.1)",
  overlayMedium: "rgba(0, 0, 0, 0.4)",
  overlayHeavy: "rgba(0, 0, 0, 0.6)",

  border: "rgba(65, 72, 104, 0.5)",
  borderSubtle: "rgba(56, 62, 90, 0.4)",
  borderFocus: "#7aa2f7",

  shadowColor: "rgba(0, 0, 0, 0.5)",
});

// Crimson (Dark)
export const crimson = createTheme("crimson", "Crimson", {
  background: "#1a1a1a",
  backgroundSecondary: "#252525",
  backgroundTertiary: "#111111",

  surface: "rgba(45, 45, 45, 0.6)",
  surfaceHover: "rgba(245, 245, 245, 0.08)",
  surfaceActive: "rgba(245, 245, 245, 0.15)",

  glass: "rgba(45, 45, 45, 0.8)",
  glassHover: "rgba(53, 53, 53, 0.9)",
  glassBorder: "rgba(85, 85, 85, 0.4)",

  textPrimary: "#f5f5f5",
  textSecondary: "#b3b3b3",
  textMuted: "#808080",
  textInverse: "#1a1a1a",

  accent: "#e53935",
  accentHover: "#ff6659",
  accentMuted: "rgba(229, 57, 53, 0.2)",

  interactive: "rgba(245, 245, 245, 0.06)",
  interactiveHover: "rgba(245, 245, 245, 0.12)",
  interactiveActive: "rgba(245, 245, 245, 0.18)",

  success: "#4caf50",
  warning: "#ff9800",
  error: "#e53935",

  progressTrack: "rgba(245, 245, 245, 0.12)",
  progressFill: "rgba(229, 57, 53, 0.7)",
  progressFillGradient: "#e53935",

  overlayLight: "rgba(0, 0, 0, 0.1)",
  overlayMedium: "rgba(0, 0, 0, 0.4)",
  overlayHeavy: "rgba(0, 0, 0, 0.6)",

  border: "rgba(68, 68, 68, 0.5)",
  borderSubtle: "rgba(60, 60, 60, 0.4)",
  borderFocus: "#e53935",

  shadowColor: "rgba(0, 0, 0, 0.5)",
});

// Kanagawa (Dark)
export const kanagawa = createTheme("kanagawa", "Kanagawa", {
  background: "#1f1f28",
  backgroundSecondary: "#2a2a37",
  backgroundTertiary: "#16161d",

  surface: "rgba(84, 84, 109, 0.4)",
  surfaceHover: "rgba(220, 215, 186, 0.08)",
  surfaceActive: "rgba(220, 215, 186, 0.15)",

  glass: "rgba(54, 54, 70, 0.8)",
  glassHover: "rgba(70, 70, 90, 0.9)",
  glassBorder: "rgba(114, 114, 149, 0.4)",

  textPrimary: "#dcd7ba",
  textSecondary: "#a3a3a3",
  textMuted: "#727272",
  textInverse: "#1f1f28",

  accent: "#7e9cd8",
  accentHover: "#a3c1f0",
  accentMuted: "rgba(126, 156, 216, 0.2)",

  interactive: "rgba(220, 215, 186, 0.06)",
  interactiveHover: "rgba(220, 215, 186, 0.12)",
  interactiveActive: "rgba(220, 215, 186, 0.18)",

  success: "#98bb6c",
  warning: "#e6c384",
  error: "#c34043",

  progressTrack: "rgba(220, 215, 186, 0.12)",
  progressFill: "rgba(126, 156, 216, 0.7)",
  progressFillGradient: "#7e9cd8",

  overlayLight: "rgba(0, 0, 0, 0.1)",
  overlayMedium: "rgba(0, 0, 0, 0.4)",
  overlayHeavy: "rgba(0, 0, 0, 0.6)",

  border: "rgba(114, 114, 149, 0.5)",
  borderSubtle: "rgba(90, 90, 115, 0.4)",
  borderFocus: "#7e9cd8",

  shadowColor: "rgba(0, 0, 0, 0.5)",
});

// One Dark
export const oneDark = createTheme("one-dark", "One Dark", {
  background: "#282c34",
  backgroundSecondary: "#2e333d",
  backgroundTertiary: "#21252b",

  surface: "rgba(62, 68, 81, 0.6)",
  surfaceHover: "rgba(171, 178, 191, 0.08)",
  surfaceActive: "rgba(171, 178, 191, 0.15)",

  glass: "rgba(62, 68, 81, 0.8)",
  glassHover: "rgba(75, 82, 99, 0.9)",
  glassBorder: "rgba(104, 111, 127, 0.4)",

  textPrimary: "#abb2bf",
  textSecondary: "#828997",
  textMuted: "#636d83",
  textInverse: "#282c34",

  accent: "#61afef",
  accentHover: "#89c7ff",
  accentMuted: "rgba(97, 175, 239, 0.2)",

  interactive: "rgba(171, 178, 191, 0.06)",
  interactiveHover: "rgba(171, 178, 191, 0.12)",
  interactiveActive: "rgba(171, 178, 191, 0.18)",

  success: "#98c379",
  warning: "#e5c07b",
  error: "#e06c75",

  progressTrack: "rgba(171, 178, 191, 0.12)",
  progressFill: "rgba(97, 175, 239, 0.7)",
  progressFillGradient: "#61afef",

  overlayLight: "rgba(0, 0, 0, 0.1)",
  overlayMedium: "rgba(0, 0, 0, 0.4)",
  overlayHeavy: "rgba(0, 0, 0, 0.6)",

  border: "rgba(92, 99, 112, 0.5)",
  borderSubtle: "rgba(78, 84, 96, 0.4)",
  borderFocus: "#61afef",

  shadowColor: "rgba(0, 0, 0, 0.45)",
});

// One Light
export const oneLight = createTheme("one-light", "One Light", {
  background: "#fafafa",
  backgroundSecondary: "#f0f0f0",
  backgroundTertiary: "#e5e5e5",

  surface: "rgba(229, 229, 229, 0.6)",
  surfaceHover: "rgba(56, 58, 66, 0.08)",
  surfaceActive: "rgba(56, 58, 66, 0.15)",

  glass: "rgba(255, 255, 255, 0.85)",
  glassHover: "rgba(255, 255, 255, 0.95)",
  glassBorder: "rgba(216, 216, 216, 0.6)",

  textPrimary: "#383a42",
  textSecondary: "#696c77",
  textMuted: "#a0a1a7",
  textInverse: "#fafafa",

  accent: "#4078f2",
  accentHover: "#699cff",
  accentMuted: "rgba(64, 120, 242, 0.15)",

  interactive: "rgba(56, 58, 66, 0.06)",
  interactiveHover: "rgba(56, 58, 66, 0.12)",
  interactiveActive: "rgba(56, 58, 66, 0.18)",

  success: "#50a14f",
  warning: "#c18401",
  error: "#e45649",

  progressTrack: "rgba(56, 58, 66, 0.1)",
  progressFill: "rgba(64, 120, 242, 0.7)",
  progressFillGradient: "#4078f2",

  overlayLight: "rgba(56, 58, 66, 0.05)",
  overlayMedium: "rgba(56, 58, 66, 0.3)",
  overlayHeavy: "rgba(56, 58, 66, 0.6)",

  border: "rgba(216, 216, 216, 0.8)",
  borderSubtle: "rgba(216, 216, 216, 0.5)",
  borderFocus: "#4078f2",

  shadowColor: "rgba(56, 58, 66, 0.12)",
});

// Everforest (Dark)
export const everforest = createTheme("everforest", "Everforest", {
  background: "#2f383e",
  backgroundSecondary: "#374247",
  backgroundTertiary: "#272f34",

  surface: "rgba(60, 70, 77, 0.6)",
  surfaceHover: "rgba(211, 198, 170, 0.08)",
  surfaceActive: "rgba(211, 198, 170, 0.15)",

  glass: "rgba(60, 70, 77, 0.8)",
  glassHover: "rgba(75, 86, 92, 0.9)",
  glassBorder: "rgba(98, 110, 115, 0.4)",

  textPrimary: "#d3c6aa",
  textSecondary: "#96a091",
  textMuted: "#7a8478",
  textInverse: "#2f383e",

  accent: "#a7c080",
  accentHover: "#c3d9a0",
  accentMuted: "rgba(167, 192, 128, 0.2)",

  interactive: "rgba(211, 198, 170, 0.06)",
  interactiveHover: "rgba(211, 198, 170, 0.12)",
  interactiveActive: "rgba(211, 198, 170, 0.18)",

  success: "#a7c080",
  warning: "#dbbc7f",
  error: "#e67e80",

  progressTrack: "rgba(211, 198, 170, 0.12)",
  progressFill: "rgba(167, 192, 128, 0.7)",
  progressFillGradient: "#a7c080",

  overlayLight: "rgba(0, 0, 0, 0.1)",
  overlayMedium: "rgba(0, 0, 0, 0.4)",
  overlayHeavy: "rgba(0, 0, 0, 0.6)",

  border: "rgba(75, 86, 92, 0.5)",
  borderSubtle: "rgba(65, 75, 80, 0.4)",
  borderFocus: "#a7c080",

  shadowColor: "rgba(0, 0, 0, 0.45)",
});

// ============================================
// COTTON CANDY DREAMS (Light)
// ============================================
export const cottonCandyDreams = createTheme(
  "cotton-candy-dreams",
  "Cotton Candy Dreams",
  {
    background: "#ffe1ed",
    backgroundSecondary: "#ffd4e3",
    backgroundTertiary: "#ffc7d9",

    surface: "rgba(255, 236, 243, 0.8)",
    surfaceHover: "rgba(105, 56, 92, 0.1)",
    surfaceActive: "rgba(105, 56, 92, 0.18)",

    glass: "rgba(255, 236, 243, 0.85)",
    glassHover: "rgba(255, 236, 243, 0.95)",
    glassBorder: "rgba(255, 192, 212, 0.6)",

    textPrimary: "#69385c",
    textSecondary: "#986d8b",
    textMuted: "#b08aa3",
    textInverse: "#ffe1ed",

    accent: "#ff5c8d",
    accentHover: "#ff7da3",
    accentMuted: "rgba(255, 92, 141, 0.15)",

    interactive: "rgba(105, 56, 92, 0.08)",
    interactiveHover: "rgba(105, 56, 92, 0.15)",
    interactiveActive: "rgba(105, 56, 92, 0.22)",

    success: "#7bc96f",
    warning: "#f0a500",
    error: "#ff5c8d",

    progressTrack: "rgba(105, 56, 92, 0.12)",
    progressFill: "rgba(255, 92, 141, 0.7)",
    progressFillGradient: "#ff5c8d",

    overlayLight: "rgba(105, 56, 92, 0.05)",
    overlayMedium: "rgba(105, 56, 92, 0.3)",
    overlayHeavy: "rgba(105, 56, 92, 0.6)",

    border: "rgba(255, 171, 197, 0.8)",
    borderSubtle: "rgba(255, 192, 212, 0.5)",
    borderFocus: "#ff5c8d",

    shadowColor: "rgba(105, 56, 92, 0.15)",
  },
);

// ============================================
// SEA GREEN (Dark)
// ============================================
export const seaGreen = createTheme("sea-green", "Sea Green", {
  background: "#0e1a16",
  backgroundSecondary: "#132820",
  backgroundTertiary: "#0a120f",

  surface: "rgba(26, 46, 40, 0.6)",
  surfaceHover: "rgba(214, 245, 227, 0.08)",
  surfaceActive: "rgba(214, 245, 227, 0.15)",

  glass: "rgba(26, 46, 40, 0.8)",
  glassHover: "rgba(34, 61, 52, 0.9)",
  glassBorder: "rgba(58, 95, 83, 0.4)",

  textPrimary: "#d6f5e3",
  textSecondary: "#88b6a3",
  textMuted: "#5a8a77",
  textInverse: "#0e1a16",

  accent: "#2e8b57",
  accentHover: "#4caf81",
  accentMuted: "rgba(46, 139, 87, 0.2)",

  interactive: "rgba(214, 245, 227, 0.06)",
  interactiveHover: "rgba(214, 245, 227, 0.12)",
  interactiveActive: "rgba(214, 245, 227, 0.18)",

  success: "#2e8b57",
  warning: "#c9a227",
  error: "#c75c5c",

  progressTrack: "rgba(214, 245, 227, 0.12)",
  progressFill: "rgba(46, 139, 87, 0.7)",
  progressFillGradient: "#2e8b57",

  overlayLight: "rgba(0, 0, 0, 0.1)",
  overlayMedium: "rgba(0, 0, 0, 0.4)",
  overlayHeavy: "rgba(0, 0, 0, 0.6)",

  border: "rgba(47, 79, 67, 0.5)",
  borderSubtle: "rgba(40, 66, 56, 0.4)",
  borderFocus: "#2e8b57",

  shadowColor: "rgba(0, 0, 0, 0.5)",
});

// ============================================
// EXPORT ALL THEMES
// ============================================
export const allThemes: Theme[] = [
  catppuccinMocha,
  catppuccinMacchiato,
  catppuccinFrappe,
  catppuccinLatte,
  tokyoNight,
  rosePine,
  nord,
  dracula,
  gruvbox,
  kanagawa,
  oneDark,
  oneLight,
  everforest,
  crimson,
  solarizedDark,
  solarizedLight,
  matcha,
  seaGreen,
  cottonCandyDreams,
];

// Helper to register all themes with the ThemeContext
export const registerAllThemes = (registerTheme: (theme: Theme) => void) => {
  allThemes.forEach((theme) => registerTheme(theme));
};
