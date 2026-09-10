import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/extension/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#080c14",
        surface: {
          50: "#141c2e",
          100: "#0f1624",
          200: "#0a0f1a",
          300: "#060910",
        },
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        accent: {
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
          cyan: "#06b6d4",
        },
        // CommitGuard interceptor modal — "bank passbook / ledger slip" palette.
        // Ink-on-paper, not SaaS gradients: named after what each color represents on a
        // real Indian bank ledger, not by hue.
        ledger: {
          navy: "#0B1D3A",   // ink / primary text
          paper: "#F5F1E6",  // ledger paper background
          debit: "#8B1E1E",  // debit / AVOID verdict ink
          credit: "#1F6F4A", // credit / BEST verdict ink
          seal: "#C9A227",   // brand seal / stamp accent, used sparingly
          rule: "#D8D2C0",   // hairline divider
        },
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(99, 102, 241, 0.25)",
        "glow-emerald": "0 0 25px -5px rgba(16, 185, 129, 0.25)",
        "glow-amber": "0 0 25px -5px rgba(245, 158, 11, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
