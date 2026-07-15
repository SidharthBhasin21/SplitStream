import { create } from "zustand";

/**
 * Minimal global toast (Zustand UI state). Shown by components/Toast.tsx,
 * which is mounted once in the root layout. `show` is safe to call from
 * non-React code via useToastStore.getState().show(...) — expenseSync uses
 * that to surface conflict errors without coupling to any screen.
 */
interface ToastState {
  message: string | null;
  show: (message: string) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  hide: () => set({ message: null }),
}));
