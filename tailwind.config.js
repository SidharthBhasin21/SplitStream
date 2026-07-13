/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  // NativeWind requires class-based dark mode when the color scheme is set
  // programmatically (Expo does this on web with userInterfaceStyle "automatic").
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
