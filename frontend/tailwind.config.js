/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Dark theme colors (default)
        studio: {
          bg: "var(--studio-bg)",
          surface: "var(--studio-surface)",
          card: "var(--studio-card)",
          border: "var(--studio-border)",
          hover: "var(--studio-hover)",
          accent: "#38bdf8",
          accentHover: "#0284c7",
          purple: "#a855f7",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(56, 189, 248, 0.3)",
        purpleGlow: "0 0 25px -5px rgba(168, 85, 247, 0.3)",
        emeraldGlow: "0 0 25px -5px rgba(16, 185, 129, 0.3)",
      },
      animation: {
        pulseSlow: "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        }
      }
    },
  },
  plugins: [],
}
