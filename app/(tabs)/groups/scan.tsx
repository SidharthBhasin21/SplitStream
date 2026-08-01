import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useJoinGroup } from "@/lib/groups";
import { parseInviteCode } from "@/lib/invites";
import { useToastStore } from "@/lib/toastStore";

/** Camera scanner for invite QR codes — the QR carries the invite code
 *  (see inviteUrl in lib/groups.ts), so a successful scan just feeds the
 *  same join flow as typing the code. */
export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const joinGroup = useJoinGroup();
  const [permission, requestPermission] = useCameraPermissions();
  const [badScan, setBadScan] = useState(false);
  // Barcode events fire continuously while the QR is in frame — only the
  // first successful parse may trigger the join.
  const handled = useRef(false);

  const onBarcodeScanned = async ({ data }: { data: string }) => {
    if (handled.current) return;

    const code = parseInviteCode(data);
    if (!code) {
      // Not one of ours (someone scanned a random QR) — hint, keep scanning.
      setBadScan(true);
      return;
    }

    handled.current = true;
    try {
      const group = await joinGroup.mutateAsync(code);
      router.replace(`/groups/${group.id}`);
    } catch (e) {
      useToastStore
        .getState()
        .show(e instanceof Error ? e.message : "Couldn't join the group");
      router.back();
    }
  };

  if (!permission) {
    return <View className="flex-1 bg-paper dark:bg-gray-950" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-paper px-8 dark:bg-gray-950">
        <Text className="mb-2 text-center text-xl font-bold text-ink dark:text-gray-100">
          Camera access needed
        </Text>
        <Text className="mb-6 text-center text-base text-gray-400">
          Lumenz uses the camera only to scan group invite QR codes.
        </Text>
        <Pressable
          className="items-center rounded-full bg-ink px-8 py-4 active:opacity-80 dark:bg-white"
          onPress={() =>
            permission.canAskAgain ? requestPermission() : Linking.openSettings()
          }
        >
          <Text className="text-base font-semibold text-white dark:text-ink">
            {permission.canAskAgain ? "Allow camera" : "Open settings"}
          </Text>
        </Pressable>
        {/* Escape hatch: no camera? Join by typing the code instead. */}
        <Pressable
          className="mt-4 items-center px-8 py-3"
          onPress={() => router.replace("/groups/join")}
        >
          <Text className="text-base font-semibold text-ledger">
            Enter code instead
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* NativeWind's className isn't wired into CameraView (a third-party
          native component), so it needs a real style to actually fill the
          screen — with only a className the preview stays zero-sized (black). */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onBarcodeScanned}
      />
      {/* Lift the overlay clear of the floating tab bar (which renders over
          this modal): its bar is ~72px tall sitting at insets.bottom + 10. */}
      <View
        className="absolute left-6 right-6 items-center"
        style={{ bottom: insets.bottom + 96 }}
      >
        <Text className="mb-4 rounded-xl bg-gray-900/80 px-4 py-3 text-center text-sm text-white">
          {joinGroup.isPending
            ? "Joining group…"
            : badScan
              ? "That QR isn't a Lumenz invite — try another"
              : "Point the camera at a group's invite QR"}
        </Text>
        {/* Primary flow is scanning; typing the code is the fallback. */}
        <Pressable
          className="w-full items-center rounded-full bg-white py-4 active:opacity-80"
          onPress={() => router.replace("/groups/join")}
        >
          <Text className="text-base font-semibold text-ink">
            Enter code instead
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
