import FontAwesome from "@expo/vector-icons/FontAwesome";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polygon } from "react-native-svg";

import { formatINR } from "@/lib/balances";

/** Subtle geometric facet texture over the navy hero card (design-ref). */
function FacetTexture() {
  return (
    <Svg
      pointerEvents="none"
      // Plain style, not className: NativeWind doesn't wrap svg components,
      // so classes would be ignored and the Svg would take layout space.
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
 * Dark navy hero (design-ref screen 3): optional in-card top bar, "Total"
 * label, large white balance, then a row of white circular action buttons
 * straddling the card's bottom edge.
 */
export function BalanceHero({
  label,
  amount,
  subtitle,
  actions,
  topBar,
}: {
  label: string;
  amount: number;
  subtitle?: string;
  actions: HeroAction[];
  /** Rendered inside the card, above the balance (back button, title…). */
  topBar?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const sign = amount < 0 ? "-" : "";

  return (
    <View className="pb-2">
      <View
        className="overflow-hidden rounded-b-3xl bg-navy px-5 pb-16"
        style={{ paddingTop: insets.top + 8 }}
      >
        <FacetTexture />
        {topBar}
        <View className="mt-4 items-center">
          <Text className="text-sm text-white/60">{label}</Text>
          <Text className="mt-1 text-5xl font-bold text-white">
            {sign}
            {formatINR(amount)}
          </Text>
          {subtitle ? (
            <Text className="mt-2 text-sm text-white/60">{subtitle}</Text>
          ) : null}
        </View>
      </View>

      {/* Action circles overlap the card's bottom edge. */}
      <View className="-mt-10 flex-row justify-evenly px-6">
        {actions.map((action) => (
          <View key={action.label} className="items-center">
            <Pressable
              className="h-16 w-16 items-center justify-center rounded-full bg-white shadow-md active:bg-gray-100 dark:bg-gray-800 dark:active:bg-gray-700"
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
