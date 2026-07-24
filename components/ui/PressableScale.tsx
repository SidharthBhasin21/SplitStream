import { type ReactNode } from "react";
import { Pressable, type PressableProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that springs down slightly while pressed (design v3 micro-
 * interaction). Used for cards and primary buttons to make taps feel
 * tactile. Purely visual — forwards all Pressable behavior.
 */
export function PressableScale({
  children,
  onPressIn,
  onPressOut,
  scaleTo = 0.985,
  style,
  ...rest
}: PressableProps & { children: ReactNode; scaleTo?: number }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 22, stiffness: 320 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 22, stiffness: 320 });
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
