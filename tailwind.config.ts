import type { Config } from 'tailwindcss';

/**
 * paperx Tailwind config
 *
 * Critical: preflight is DISABLED to prevent global style pollution of host pages.
 * The content script renders inside a Shadow DOM (see T3); a scoped reset is
 * applied within the shadow root via src/shared/styles/preflight.css.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,html}'],
  corePlugins: {
    preflight: false,
  },
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--paperx-border))',
        input: 'hsl(var(--paperx-input))',
        ring: 'hsl(var(--paperx-ring))',
        background: 'hsl(var(--paperx-background))',
        foreground: 'hsl(var(--paperx-foreground))',
        primary: {
          DEFAULT: 'hsl(var(--paperx-primary))',
          foreground: 'hsl(var(--paperx-primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--paperx-secondary))',
          foreground: 'hsl(var(--paperx-secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--paperx-muted))',
          foreground: 'hsl(var(--paperx-muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--paperx-accent))',
          foreground: 'hsl(var(--paperx-accent-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--paperx-radius)',
        md: 'calc(var(--paperx-radius) - 2px)',
        sm: 'calc(var(--paperx-radius) - 4px)',
      },
    },
  },
  plugins: [],
};

export default config;
