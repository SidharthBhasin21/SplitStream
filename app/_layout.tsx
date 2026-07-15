import "../global.css";

import NetInfo from "@react-native-community/netinfo";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { Toast } from "@/components/Toast";
import { startAuthListener, useAuthStore } from "@/lib/authStore";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

// Keep the splash screen visible until we know whether a session exists.
SplashScreen.preventAutoHideAsync();

// React Query can't detect connectivity on native by itself — feed it
// NetInfo's status. With this wired, mutations fired while offline are
// PAUSED (optimistic row stays visible, marked "Syncing…") and resume when
// the connection returns, which is exactly PRD 11's queue-and-sync-on-
// reconnect behavior. Without it, offline mutations fail instantly.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
);

const queryClient = new QueryClient();

export default function RootLayout() {
  const { session, isReady } = useAuthStore();

  useEffect(() => {
    startAuthListener();
  }, []);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Route guard: signed-in users get the app tabs, everyone else the
            auth flow. Expo Router redirects automatically when `session`
            changes, so login/signup/logout never navigate manually. */}
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      <Toast />
    </QueryClientProvider>
  );
}
