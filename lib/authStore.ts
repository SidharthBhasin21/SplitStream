import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "./supabase";

interface AuthState {
  session: Session | null;
  /**
   * false until supabase-js has loaded any persisted session from AsyncStorage.
   * The root layout holds the splash screen until this flips, so a logged-in
   * user never sees a flash of the login screen on cold start.
   */
  isReady: boolean;
}

export const useAuthStore = create<AuthState>(() => ({
  session: null,
  isReady: false,
}));

let started = false;

/**
 * Subscribe the store to Supabase auth changes. Called once from the root
 * layout. supabase-js emits INITIAL_SESSION after restoring from storage,
 * so this single listener covers cold start, login, logout, and token refresh.
 */
export function startAuthListener(): void {
  if (started) return;
  started = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({ session, isReady: true });
  });
}
