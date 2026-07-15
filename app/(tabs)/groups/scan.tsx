import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { useJoinGroup } from "@/lib/groups";
import { parseInviteCode } from "@/lib/invites";
import { useToastStore } from "@/lib/toastStore";

/** Camera scanner for invite QR codes — the QR carries the invite code
 *  (see inviteUrl in lib/groups.ts), so a successful scan just feeds the
 *  same join flow as typing the code. */
export default function ScanScreen() {
  const router = useRouter();
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
    return <View className="flex-1 bg-gray-50" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-8">
        <Text className="mb-2 text-center text-xl font-semibold text-gray-900">
          Camera access needed
        </Text>
        <Text className="mb-6 text-center text-base text-gray-500">
          SplitStream uses the camera only to scan group invite QR codes.
        </Text>
        <Pressable
          className="items-center rounded-xl bg-teal-600 px-6 py-3.5 active:bg-teal-700"
          onPress={() =>
            permission.canAskAgain ? requestPermission() : Linking.openSettings()
          }
        >
          <Text className="text-base font-semibold text-white">
            {permission.canAskAgain ? "Allow camera" : "Open settings"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        className="flex-1"
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onBarcodeScanned}
      />
      <View className="absolute bottom-12 left-6 right-6 items-center">
        <Text className="rounded-xl bg-gray-900/80 px-4 py-3 text-center text-sm text-white">
          {joinGroup.isPending
            ? "Joining group…"
            : badScan
              ? "That QR isn't a SplitStream invite — try another"
              : "Point the camera at a group's invite QR"}
        </Text>
      </View>
    </View>
  );
}
