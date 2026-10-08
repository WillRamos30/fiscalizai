import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--color-background) / <alpha-value>)",
        foreground: "rgb(var(--color-foreground) / <alpha-value>)",
        white: "rgb(var(--color-white) / <alpha-value>)", // overrides default white
        brand: {
          50: "rgb(var(--color-brand-50) / <alpha-value>)",
          100: "rgb(var(--color-brand-100) / <alpha-value>)",
          200: "rgb(var(--color-brand-200) / <alpha-value>)",
          500: "rgb(var(--color-brand-500) / <alpha-value>)",
          600: "rgb(var(--color-brand-600) / <alpha-value>)",
          700: "rgb(var(--color-brand-700) / <alpha-value>)",
          900: "rgb(var(--color-brand-900) / <alpha-value>)",
        },
        ink: { 
          900: "rgb(var(--color-ink-900) / <alpha-value>)", 
          700: "rgb(var(--color-ink-700) / <alpha-value>)", 
          500: "rgb(var(--color-ink-500) / <alpha-value>)", 
          300: "rgb(var(--color-ink-300) / <alpha-value>)" 
        },
        surface: { 
          50: "rgb(var(--color-surface-50) / <alpha-value>)", 
          100: "rgb(var(--color-surface-100) / <alpha-value>)", 
          200: "rgb(var(--color-surface-200) / <alpha-value>)" 
        },
        good: { 
          50: "rgb(var(--color-good-50) / <alpha-value>)", 
          500: "rgb(var(--color-good-500) / <alpha-value>)", 
          700: "rgb(var(--color-good-700) / <alpha-value>)" 
        },
        warn: { 
          50: "rgb(var(--color-warn-50) / <alpha-value>)", 
          500: "rgb(var(--color-warn-500) / <alpha-value>)", 
          700: "rgb(var(--color-warn-700) / <alpha-value>)" 
        },
        bad: { 
          50: "rgb(var(--color-bad-50) / <alpha-value>)", 
          500: "rgb(var(--color-bad-500) / <alpha-value>)", 
          700: "rgb(var(--color-bad-700) / <alpha-value>)" 
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
