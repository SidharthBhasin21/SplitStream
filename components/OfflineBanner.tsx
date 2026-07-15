import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { Text } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

/** Live connectivity flag from the same onlineManager that pauses mutations
 *  (wired to NetInfo in the root layout) — banner and queue can't disagree. */
function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => onlineManager.subscribe(onStoreChange),
    () => onlineManager.isOnline(),
  );
}

/** The PRD 11 "reconnecting" indicator: a persistent strip while offline. */
export function OfflineBanner() {
  const isOnline = useIsOnline();

  if (isOnline) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      className="absolute bottom-0 left-0 right-0 bg-amber-500 pb-7 pt-2"
    >
      <Text className="text-center text-sm font-medium text-white">
        You're offline — changes will sync when you reconnect
      </Text>
    </Animated.View>
  );
}
