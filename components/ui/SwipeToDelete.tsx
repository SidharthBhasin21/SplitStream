import FontAwesome from "@expo/vector-icons/FontAwesome";
import { type ReactNode, useRef } from "react";
import { Pressable } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import Swipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

const ACTION_WIDTH = 76;

function DeleteAction({
  progress,
  onPress,
}: {
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [ACTION_WIDTH, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View
      style={[{ width: ACTION_WIDTH }, style]}
      className="ml-2 items-center justify-center"
    >
      <Pressable
        className="h-full w-full items-center justify-center rounded-[28px] bg-rust active:opacity-80"
        onPress={onPress}
      >
        <FontAwesome name="trash" size={18} color="#ffffff" />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Gmail-style swipe-left-to-delete for a transaction row: dragging left
 * reveals a red delete button behind the row; tapping it fires `onDelete`
 * (the caller is responsible for any confirmation). Disabled rows (someone
 * else's expense, an already-syncing row) render children plain — no
 * gesture wrapper, so there's nothing to accidentally swipe.
 */
export function SwipeToDelete({
  children,
  onDelete,
  enabled = true,
}: {
  children: ReactNode;
  onDelete: () => void;
  enabled?: boolean;
}) {
  const ref = useRef<SwipeableMethods>(null);

  if (!enabled) return <>{children}</>;

  return (
    <Swipeable
      ref={ref}
      friction={2}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      renderRightActions={(progress) => (
        <DeleteAction
          progress={progress}
          onPress={() => {
            ref.current?.close();
            onDelete();
          }}
        />
      )}
    >
      {children}
    </Swipeable>
  );
}
