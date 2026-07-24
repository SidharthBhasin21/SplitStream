import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Pressable } from "react-native";

import { softShadowSm } from "./Card";

/**
 * Soft circular icon button (design v3) for header controls — a floating
 * white disc with a tinted icon. Consistent with the hero's action circles.
 */
export function IconButton({
  icon,
  onPress,
  color = "#16293B", // ink
  bg,
  size = 44,
}: {
  icon: string;
  onPress: () => void;
  color?: string;
  /** Optional filled background (e.g. ink for a primary action). Defaults to
   *  a white disc. */
  bg?: string;
  size?: number;
}) {
  return (
    <Pressable
      className={
        bg
          ? "items-center justify-center rounded-full active:opacity-80"
          : "items-center justify-center rounded-full bg-white active:bg-gray-100 dark:bg-gray-800 dark:active:bg-gray-700"
      }
      style={[softShadowSm, { width: size, height: size }, bg ? { backgroundColor: bg } : null]}
      onPress={onPress}
      hitSlop={8}
    >
      <FontAwesome name={icon as never} size={size * 0.42} color={color} />
    </Pressable>
  );
}
