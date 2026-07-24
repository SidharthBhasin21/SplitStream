import FontAwesome from "@expo/vector-icons/FontAwesome";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polygon } from "react-native-svg";

import { formatMoney } from "@/lib/currency";
import { softShadow, softShadowSm } from "./Card";

/** Subtle geometric facet texture over the navy hero card. */
function FacetTexture() {
  return (
    <Svg
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 400 260"
    >
      <Polygon points="0,0 190,0 60,150" fill="#ffffff" opacity={0.04} />
      <Polygon points="400,0 400,180 230,40" fill="#ffffff" opacity={0.05} />
      <Polygon points="120,260 320,260 240,110" fill="#000000" opacity={0.08} />
      <Polygon points="0,260 110,260 0,120" fill="#ffffff" opacity={0.03} />
      <Polygon points="300,0 400,0 400,90" fill="#000000" opacity={0.06} />
    </Svg>
  );
}

export interface HeroAction {
  icon: string;
  label: string;
  onPress: () => void;
}

/**
 * Soft-tactile balance hero (design v3): a rounded navy card FLOATING on the
 * paper background (soft shadow, chunky radius), with an optional header row
 * rendered on paper above it and circular action buttons straddling its
 * bottom edge.
 */
export function BalanceHero({
  label,
  amount,
  currency = "INR",
  subtitle,
  actions,
  topBar,
}: {
  label: string;
  amount: number;
  /** ISO 4217 code for the group this balance belongs to (v1.3). */
  currency?: string;
  subtitle?: string;
  actions: HeroAction[];
  /** Rendered on the paper background above the floating card. */
  topBar?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const sign = amount < 0 ? "-" : "";

  return (
    <View className="px-4" style={{ paddingTop: insets.top + 8 }}>
      {topBar ? <View className="mb-3 px-1">{topBar}</View> : null}

      <View
        className="overflow-hidden rounded-[32px] bg-navy px-6 pb-16 pt-8"
        style={softShadow}
      >
        <FacetTexture />
        <View className="items-center">
          <Text className="text-sm text-white/60">{label}</Text>
          <Text className="mt-1 text-5xl font-bold text-white">
            {sign}
            {formatMoney(amount, currency)}
          </Text>
          {subtitle ? (
            <Text className="mt-2 text-sm text-white/60">{subtitle}</Text>
          ) : null}
        </View>
      </View>

      {/* Action circles overlap the card's bottom edge. */}
      <View className="-mt-9 flex-row justify-evenly px-4">
        {actions.map((action) => (
          <View key={action.label} className="items-center">
            <Pressable
              className="h-16 w-16 items-center justify-center rounded-full bg-white active:bg-gray-100 dark:bg-gray-800 dark:active:bg-gray-700"
              style={softShadowSm}
              onPress={action.onPress}
            >
              <FontAwesome
                name={action.icon as never}
                size={22}
                color="#2F5D50"
              />
            </Pressable>
            <Text className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              {action.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
