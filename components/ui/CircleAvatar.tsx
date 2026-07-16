import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Text, View } from "react-native";

/**
 * Circular list avatar (design-ref rows): a soft pastel disc holding either
 * a FontAwesome icon (categories) or initials (groups/members).
 */
export function CircleAvatar({
  icon,
  initials,
  bg,
  fg,
  size = 44,
}: {
  icon?: string;
  initials?: string;
  /** Tint pair, e.g. from CATEGORY_META or GROUP_TINTS. */
  bg: string;
  fg: string;
  size?: number;
}) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      {icon ? (
        <FontAwesome name={icon as never} size={size * 0.4} color={fg} />
      ) : (
        <Text
          className="font-bold"
          style={{ color: fg, fontSize: size * 0.34 }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}

/** Deterministic pastel for entities without a category (e.g. groups). */
const ENTITY_TINTS = [
  { bg: "#D9EFE7", fg: "#2F5D50" },
  { bg: "#D8E9FC", fg: "#3B82C4" },
  { bg: "#FCE8D8", fg: "#C96F22" },
  { bg: "#E9E0F8", fg: "#7C5CBF" },
  { bg: "#FADCE4", fg: "#C2496F" },
] as const;

export function entityTint(id: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ENTITY_TINTS[hash % ENTITY_TINTS.length];
}
