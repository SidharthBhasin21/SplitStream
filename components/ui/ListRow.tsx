import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { formatINR } from "@/lib/balances";

/**
 * The reference design's list row: avatar disc left, title over gray
 * subtitle in the middle, right-aligned cell (usually an AmountCell).
 * Rows sit directly on the page background — no card chrome.
 */
export function ListRow({
  avatar,
  title,
  subtitle,
  right,
  onPress,
  dimmed = false,
}: {
  avatar: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  dimmed?: boolean;
}) {
  const content = (
    <View
      className={`flex-row items-center py-3 ${dimmed ? "opacity-60" : ""}`}
    >
      {avatar}
      <View className="ml-3 flex-1 pr-3">
        <Text
          className="text-base font-semibold text-ink dark:text-gray-100"
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="mt-0.5 text-sm text-gray-400 dark:text-gray-500"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable className="active:opacity-70" onPress={onPress}>
      {content}
    </Pressable>
  );
}

/**
 * Right-aligned semantic amount (design-ref): tiny gray label over the
 * signed figure in Ledger green (owed to you) / Rust (you owe).
 */
export function AmountCell({
  amount,
  topLine,
}: {
  /** Positive = owed to you (green), negative = you owe (rust), 0 = settled. */
  amount: number;
  /** Optional small gray line above the amount (label or date). */
  topLine?: string;
}) {
  const label =
    topLine ?? (amount > 0 ? "owes you:" : amount < 0 ? "you owe:" : "");
  const color =
    amount > 0 ? "text-ledger" : amount < 0 ? "text-rust" : "text-gray-400";
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";

  return (
    <View className="items-end">
      {label ? (
        <Text className="text-xs text-gray-400 dark:text-gray-500">
          {label}
        </Text>
      ) : null}
      <Text className={`text-base font-bold ${color}`}>
        {amount === 0 ? "settled" : `${sign}${formatINR(amount)}`}
      </Text>
    </View>
  );
}
