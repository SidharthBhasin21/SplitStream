import "../global.css";

import NetInfo from "@react-native-community/netinfo";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { colorScheme as nativewindColorScheme, useColorScheme } from "nativewind";
import { useEffect } from "react";
import { Appearance } from "react-native";

import { OfflineBanner } from "@/components/OfflineBanner";
import { Toast } from "@/components/Toast";
import { startAuthListener, useAuthStore } from "@/lib/authStore";
import { usePushNotifications } from "@/lib/notifications";
import { useThemeStore } from "@/lib/themeStore";

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
  // Apply the persisted theme preference to NativeWind. Two subtleties:
  // must run in an effect (set() during module init doesn't stick), and
  // "system" is resolved to an explicit light/dark via Appearance ourselves
  // (NativeWind's own "system" handling drops the root class on web).
  const preference = useThemeStore((s) => s.preference);
  useEffect(() => {
    if (preference !== "system") {
      nativewindColorScheme.set(preference);
      return;
    }
    nativewindColorScheme.set(
      Appearance.getColorScheme() === "dark" ? "dark" : "light",
    );
    const sub = Appearance.addChangeListener(({ colorScheme: os }) => {
      nativewindColorScheme.set(os === "dark" ? "dark" : "light");
    });
    return () => sub.remove();
  }, [preference]);
  // Effective scheme after the preference is applied — drives navigation
  // chrome; NativeWind dark: classes follow it automatically.
  const { colorScheme } = useColorScheme();

  // Register this device for activity push notifications once logged in.
  usePushNotifications(session?.user.id);

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
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
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
        <OfflineBanner />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
