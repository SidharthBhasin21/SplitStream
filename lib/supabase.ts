import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

import { secureSessionStorage } from "./secureSessionStorage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase config: copy .env.example to .env, fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server with `npx expo start -c`.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session on-device so users stay logged in across app
    // restarts. On native the session is encrypted at rest (see
    // lib/secureSessionStorage.ts — security audit #13); the plain
    // AsyncStorage fallback is only for the web dev preview, where
    // SecureStore doesn't exist.
    storage: Platform.OS === "web" ? AsyncStorage : secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native (that's for web OAuth redirects).
    detectSessionInUrl: false,
  },
});

// Token auto-refresh runs on a timer that doesn't fire while the app is
// backgrounded, so tie it to the app's foreground state (per Supabase's RN guide).
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
