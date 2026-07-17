import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { signInWithGoogle } from "@/lib/oauth";

/** "or" divider + Google sign-in button, shared by login and signup.
 *  On success the auth listener flips the route guard — no navigation here. */
export function GoogleSignIn({
  onError,
}: {
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    const result = await signInWithGoogle();
    setBusy(false);
    if (!result.ok && !("cancelled" in result)) {
      onError(result.error);
    }
  };

  return (
    <>
      <View className="my-6 flex-row items-center">
        <View className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
        <Text className="mx-3 text-xs font-medium text-gray-400">or</Text>
        <View className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
      </View>

      <Pressable
        className="flex-row items-center justify-center rounded-full border border-gray-200 bg-white py-4 active:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:active:bg-gray-800"
        onPress={onPress}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator />
        ) : (
          <>
            <FontAwesome name="google" size={18} color="#B54A3A" />
            <Text className="ml-3 text-base font-semibold text-ink dark:text-gray-100">
              Continue with Google
            </Text>
          </>
        )}
      </Pressable>
    </>
  );
}
