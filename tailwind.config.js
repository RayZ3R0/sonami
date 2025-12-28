/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware colors using CSS variables
        theme: {
          bg: 'var(--theme-background)',
          'bg-secondary': 'var(--theme-background-secondary)',
          'bg-tertiary': 'var(--theme-background-tertiary)',
          surface: 'var(--theme-surface)',
          'surface-hover': 'var(--theme-surface-hover)',
          'surface-active': 'var(--theme-surface-active)',
          glass: 'var(--theme-glass)',
          'glass-hover': 'var(--theme-glass-hover)',
          'glass-border': 'var(--theme-glass-border)',
          'text-primary': 'var(--theme-text-primary)',
          'text-secondary': 'var(--theme-text-secondary)',
          'text-muted': 'var(--theme-text-muted)',
          'text-inverse': 'var(--theme-text-inverse)',
          accent: 'var(--theme-accent)',
          'accent-hover': 'var(--theme-accent-hover)',
          'accent-muted': 'var(--theme-accent-muted)',
          interactive: 'var(--theme-interactive)',
          'interactive-hover': 'var(--theme-interactive-hover)',
          'interactive-active': 'var(--theme-interactive-active)',
          success: 'var(--theme-success)',
          warning: 'var(--theme-warning)',
          error: 'var(--theme-error)',
          border: 'var(--theme-border)',
          'border-subtle': 'var(--theme-border-subtle)',
          'border-focus': 'var(--theme-border-focus)',
        },
      },
      backgroundColor: {
        theme: 'var(--theme-background)',
        'theme-secondary': 'var(--theme-background-secondary)',
        'theme-tertiary': 'var(--theme-background-tertiary)',
        'theme-surface': 'var(--theme-surface)',
        'theme-surface-hover': 'var(--theme-surface-hover)',
        'theme-surface-active': 'var(--theme-surface-active)',
        'theme-interactive': 'var(--theme-interactive)',
        'theme-interactive-hover': 'var(--theme-interactive-hover)',
        'theme-accent': 'var(--theme-accent)',
      },
      textColor: {
        'theme-primary': 'var(--theme-text-primary)',
        'theme-secondary': 'var(--theme-text-secondary)',
        'theme-muted': 'var(--theme-text-muted)',
        'theme-inverse': 'var(--theme-text-inverse)',
        'theme-accent': 'var(--theme-accent)',
      },
      borderColor: {
        theme: 'var(--theme-border)',
        'theme-subtle': 'var(--theme-border-subtle)',
        'theme-focus': 'var(--theme-border-focus)',
      },
    },
  },
  plugins: [],
}

