/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: "#1F8A5B",
          light: "#EAF4EE",
          mid: "#2E7D57",
        },
        border: "#EAEAEA",
        muted: "#F7F8F7",
        primary: "#111111",
        secondary: "#666666",
        tertiary: "#999999",
        // legacy aliases — keep so existing dashboard code doesn't break
        sol: {
          purple: "#1F8A5B",
          green: "#1F8A5B",
          blue: "#1F8A5B",
        },
        surface: {
          lavender: "#EAF4EE",
          mint: "#EAF4EE",
          sky: "#F7F8F7",
          cream: "#F7F8F7",
        },
        ink: {
          DEFAULT: "#111111",
          muted: "#666666",
          faint: "#999999",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
      },
      letterSpacing: {
        tight: "-0.03em",
        tighter: "-0.05em",
      },
    },
  },
  plugins: [],
};
