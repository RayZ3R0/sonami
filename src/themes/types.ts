// Theme color definitions - each theme must provide all these colors
export interface ThemeColors {
    // Base colors
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    
    // Surface colors (for cards, panels, etc.)
    surface: string;
    surfaceHover: string;
    surfaceActive: string;
    
    // Glass effects
    glass: string;
    glassHover: string;
    glassBorder: string;
    
    // Text colors
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textInverse: string;
    
    // Accent colors
    accent: string;
    accentHover: string;
    accentMuted: string;
    
    // Interactive states
    interactive: string;
    interactiveHover: string;
    interactiveActive: string;
    
    // Semantic colors
    success: string;
    warning: string;
    error: string;
    
    // Player specific
    progressTrack: string;
    progressFill: string;
    progressFillGradient: string;
    
    // Overlay colors
    overlayLight: string;
    overlayMedium: string;
    overlayHeavy: string;
    
    // Border colors
    border: string;
    borderSubtle: string;
    borderFocus: string;
    
    // Shadow colors
    shadowColor: string;
}

export interface Theme {
    id: string;
    name: string;
    colors: ThemeColors;
}

// Default theme based on current styles
export const defaultTheme: Theme = {
    id: "default",
    name: "Default Dark",
    colors: {
        // Base colors
        background: "#121212",
        backgroundSecondary: "#1a1a20",
        backgroundTertiary: "#0a0a0a",
        
        // Surface colors
        surface: "rgba(20, 20, 23, 0.6)",
        surfaceHover: "rgba(255, 255, 255, 0.06)",
        surfaceActive: "rgba(255, 255, 255, 0.10)",
        
        // Glass effects
        glass: "rgba(30, 30, 35, 0.7)",
        glassHover: "rgba(40, 40, 45, 0.8)",
        glassBorder: "rgba(255, 255, 255, 0.1)",
        
        // Text colors
        textPrimary: "#ffffff",
        textSecondary: "#a1a1aa", // zinc-400
        textMuted: "#71717a", // zinc-500
        textInverse: "#000000",
        
        // Accent colors
        accent: "#fa586a",
        accentHover: "#fb6b7b",
        accentMuted: "rgba(250, 88, 106, 0.2)",
        
        // Interactive states
        interactive: "rgba(255, 255, 255, 0.08)",
        interactiveHover: "rgba(255, 255, 255, 0.12)",
        interactiveActive: "rgba(255, 255, 255, 0.16)",
        
        // Semantic colors
        success: "#22c55e",
        warning: "#eab308",
        error: "#ef4444",
        
        // Player specific
        progressTrack: "rgba(255, 255, 255, 0.1)",
        progressFill: "rgba(255, 255, 255, 0.6)",
        progressFillGradient: "#ffffff",
        
        // Overlay colors
        overlayLight: "rgba(0, 0, 0, 0.1)",
        overlayMedium: "rgba(0, 0, 0, 0.4)",
        overlayHeavy: "rgba(0, 0, 0, 0.6)",
        
        // Border colors
        border: "rgba(255, 255, 255, 0.08)",
        borderSubtle: "rgba(255, 255, 255, 0.06)",
        borderFocus: "rgba(255, 255, 255, 0.2)",
        
        // Shadow colors
        shadowColor: "rgba(0, 0, 0, 0.5)",
    },
};

// Helper to create a new theme by extending the default
export const createTheme = (id: string, name: string, colors: Partial<ThemeColors>): Theme => ({
    id,
    name,
    colors: {
        ...defaultTheme.colors,
        ...colors,
    },
});
