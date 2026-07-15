import { useEffect } from "react";
import { Pressable, Text } from "react-native";

import { useToastStore } from "@/lib/toastStore";

const TOAST_MS = 4000;

/** Renders the global toast message; mounted once in the root layout. */
export function Toast() {
  const { message, hide } = useToastStore();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, hide]);

  if (!message) return null;

  return (
    <Pressable
      className="absolute bottom-24 left-6 right-6 rounded-xl bg-gray-900/95 px-4 py-3"
      onPress={hide}
    >
      <Text className="text-center text-sm text-white">{message}</Text>
    </Pressable>
  );
}
