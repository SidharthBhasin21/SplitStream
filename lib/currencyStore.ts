import { create } from "zustand";
import { persist } from "zustand/middleware";

import { persistedStorage } from "./persistedStorage";

/**
 * The user's "home" currency (v1.3) — used only to display the Groups list'
 * cross-group total (each group's balance converted into this currency via
 * lib/exchangeRates.ts). Per-group screens always show that group's own
 * currency regardless of this setting.
 */
interface CurrencyState {
  homeCurrency: string;
  setHomeCurrency: (code: string) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      homeCurrency: "INR",
      setHomeCurrency: (code) => set({ homeCurrency: code }),
    }),
    {
      name: "lumenz-currency",
      storage: persistedStorage("splitstream-currency"),
    },
  ),
);
