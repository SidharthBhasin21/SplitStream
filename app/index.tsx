import { Redirect } from "expo-router";

import { useAuthStore } from "@/lib/authStore";

/**
 * Root route. The (auth)/(tabs) groups don't match the bare "/" path on
 * their own, so without this a cold launch at "/" — which is exactly how a
 * dev build / deep link opens the app — falls through to +not-found. This
 * redirects "/" to the right place based on auth state. The root layout
 * holds until `isReady`, so `session` is already settled when this mounts.
 */
export default function Index() {
  const session = useAuthStore((s) => s.session);
  return <Redirect href={session ? "/groups" : "/login"} />;
}
