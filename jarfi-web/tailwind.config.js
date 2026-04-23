/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sol: {
          purple: "#9945FF",
          green: "#14F195",
          blue: "#00C2FF",
        },
        surface: {
          lavender: "#F0EAFF",
          mint: "#E6FDF5",
          sky: "#E6F9FF",
          cream: "#FFF9F0",
        },
        ink: {
          DEFAULT: "#0F1020",
          muted: "#6B7094",
          faint: "#A0A6C8",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
