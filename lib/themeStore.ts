import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Dark mode (v1.1). tailwind.config.js uses darkMode: "class", so NativeWind
 * doesn't follow the OS setting by itself. This store only persists the
 * user's preference ("system" by default, overridable from the Profile
 * screen); the root layout applies it to NativeWind in an effect —
 * colorScheme.set() must run after mount to reliably take effect.
 */

export type ThemePreference = "system" | "light" | "dark";

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "system",
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: "splitstream-theme",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
