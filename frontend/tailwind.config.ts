import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "toll-blue": "#2563EB",
        "toll-blue-dark": "#1D4ED8",
        "toll-blue-light": "#EFF6FF",
        "toll-text": "#1E293B",
        "toll-text-light": "#64748B",
        "toll-bg": "#FFFFFF",
        "toll-bg-alt": "#F8FAFC",
        "toll-accent": "#3B82F6",
        "stripe-blurple": "#635bff",
        "accent-green": "#10b981",
        "accent-red": "#ef4444",
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
        glow: "0 0 40px -10px rgba(37, 99, 235, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
