/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // NativeWind requires class-based dark mode when the color scheme is set
  // programmatically (Expo does this on web with userInterfaceStyle "automatic").
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand tokens (design-ref/): semantic money colors + hero surfaces.
        ledger: "#2F5D50", // positive / "owed to you"
        rust: "#B54A3A", // negative / "you owe"
        navy: "#1F3A52", // hero card surface
        ink: "#16293B", // darkest text / CTA buttons
        paper: "#F6F8F8", // off-white app background
      },
    },
  },
  plugins: [],
};
