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
        background: "#07090e",
        obsidian: {
          950: "#05070a",
          900: "#07090e",
          850: "#0b0e17",
          800: "#0f1422",
          700: "#171f33",
          600: "#222c46",
        },
        surface: {
          50: "#141c2e",
          100: "#0f1624",
          200: "#0a0f1a",
          300: "#060910",
        },
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        sunset: {
          light: "#fed7aa",
          DEFAULT: "#f97316",
          dark: "#ea580c",
          deep: "#9a3412",
          glow: "rgba(249, 115, 22, 0.28)",
        },
        frost: {
          mist: "rgba(148, 163, 184, 0.12)",
          light: "#cbd5e1",
          DEFAULT: "#94a3b8",
          dark: "#64748b",
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
        glow: "0 0 35px -5px rgba(249, 115, 22, 0.35)",
        "glow-sunset": "0 0 45px -10px rgba(234, 88, 12, 0.4)",
        "glow-frost": "0 0 35px -10px rgba(148, 163, 184, 0.2)",
        "glow-emerald": "0 0 25px -5px rgba(16, 185, 129, 0.25)",
        "glow-amber": "0 0 25px -5px rgba(245, 158, 11, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
