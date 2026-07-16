import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Pressable, Text, View } from "react-native";

/**
 * Reference-style empty state: soft illustration disc, one-line message,
 * single dark pill CTA.
 */
export function EmptyState({
  icon,
  title,
  message,
  ctaLabel,
  onCta,
}: {
  icon: string;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <View className="items-center px-6 pt-12">
      <View className="h-28 w-28 items-center justify-center rounded-full bg-ledger/10">
        <FontAwesome name={icon as never} size={44} color="#2F5D50" />
      </View>
      <Text className="mt-6 text-center text-lg font-bold text-ink dark:text-gray-100">
        {title}
      </Text>
      {message ? (
        <Text className="mt-1.5 text-center text-sm text-gray-400">
          {message}
        </Text>
      ) : null}
      {ctaLabel && onCta ? (
        <Pressable
          className="mt-8 w-full items-center rounded-full bg-ink py-4 active:opacity-80 dark:bg-white"
          onPress={onCta}
        >
          <Text className="text-base font-semibold text-white dark:text-ink">
            {ctaLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
