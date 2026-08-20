import Constants, { AppOwnership, ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { supabase } from "./supabase";

/**
 * Push notifications for activity events (v1.1).
 *
 * Split of responsibilities:
 *  - DB triggers write activity_log rows (phase6.sql)
 *  - the notify-activity Edge Function fans each row out to members' Expo
 *    push tokens (supabase/functions/notify-activity)
 *  - this module only REGISTERS the device (token → push_tokens table) and
 *    handles taps.
 *
 * Expo Go note: remote push was removed from Expo Go in SDK 53, and even
 * *loading* expo-notifications there logs an error on Android. So this
 * module never statically imports it — everything is behind a dynamic
 * import that only runs in a real (dev/EAS) build. In Expo Go the whole
 * feature silently no-ops and the rest of the app is unaffected.
 */

// Environments where push can never work: Expo Go (removed in SDK 53) and
// web (out of scope). Skip everything, including loading the module.
//
// Two independent signals for "are we in Expo Go" on purpose. Getting this
// wrong doesn't degrade the feature — it dynamically imports a module that
// errors on load in Expo Go, which can take the app down at startup. And the
// failure only shows on a PHYSICAL device: emulators bail out earlier on
// `!Device.isDevice`, so a single-signal check tests clean and still breaks
// on real hardware. appOwnership is deprecated but still populated, and a
// deprecated-but-correct second opinion is worth more than the tidier check.
const pushUnavailable =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === AppOwnership.Expo ||
  Platform.OS === "web";

function easProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  );
}

async function registerForPush(userId: string): Promise<void> {
  if (pushUnavailable) return;
  if (!Device.isDevice) return; // simulators can't receive push

  const projectId = easProjectId();
  if (!projectId) return; // eas init not run yet — no-op

  try {
    const Notifications = await import("expo-notifications");

    // Show notifications as banners even while the app is foregrounded.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Group activity",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    // Upsert keyed on (user_id, token): reinstalls refresh updated_at, and a
    // device used by two accounts ends up with a row per account.
    const { error } = await supabase.from("push_tokens").upsert({
      user_id: userId,
      token,
      updated_at: new Date().toISOString(),
    });
    if (error) console.warn("push token save failed:", error.message);
  } catch (e) {
    // Registration must never crash the app — a device without working push
    // (denied permission, FCM hiccup) should still use everything else.
    console.warn("push registration failed:", e instanceof Error ? e.message : e);
  }
}

/** Mounted once from the root layout when a session exists. */
export function usePushNotifications(userId: string | undefined) {
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    registerForPush(userId);
  }, [userId]);

  // Tapping a notification deep-links into the group it came from.
  useEffect(() => {
    if (pushUnavailable) return;

    let sub: { remove: () => void } | undefined;
    let cancelled = false;

    import("expo-notifications").then((Notifications) => {
      if (cancelled) return;
      sub = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const groupId = response.notification.request.content.data?.groupId;
          if (typeof groupId === "string") {
            router.push(`/groups/${groupId}`);
          }
        },
      );
    });

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [router]);
}
