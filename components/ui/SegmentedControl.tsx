import { Pressable, Text, View } from "react-native";

/**
 * Pill segmented control (design-ref): light track, active segment on a
 * white pill with a soft shadow.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row rounded-full bg-gray-200/60 p-1 dark:bg-gray-800">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            // `active` in the key forces a REMOUNT when the segment toggles:
            // NativeWind can't dynamically add styles like shadow-sm to an
            // already-mounted native component (css-interop "upgrade" crash);
            // a fresh mount sidesteps that entirely.
            key={`${option.value}-${active}`}
            className={`flex-1 items-center rounded-full py-2 ${
              active ? "bg-white shadow-sm dark:bg-gray-600" : ""
            }`}
            onPress={() => onChange(option.value)}
          >
            <Text
              className={`text-sm ${
                active
                  ? "font-bold text-ink dark:text-white"
                  : "font-medium text-gray-400"
              }`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
