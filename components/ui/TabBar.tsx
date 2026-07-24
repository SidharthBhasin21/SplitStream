import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { softShadow, softShadowSm } from "./Card";

/**
 * Custom floating tab bar (design v3). A rounded bar hovering above the
 * bottom edge holding the three tab destinations (Groups · Activity ·
 * Profile) plus two quick actions — a prominent central Create (+) and a
 * Join button. Active tab tints ledger green; motion is intentionally
 * minimal (color only) per the "subtle animation" direction.
 *
 * Minimal local prop type — Expo Router passes React Navigation's bottom-tab
 * bar props; we only read `state` and `navigation`.
 */
interface TabBarProps {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  navigation: {
    navigate: (name: string) => void;
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: boolean;
    }) => { defaultPrevented: boolean };
  };
}

const LEDGER = "#2F5D50";
const MUTED = "#9ca3af";

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const tabItem = (routeName: string, icon: string, label: string) => {
    const index = state.routes.findIndex((r) => r.name === routeName);
    const route = state.routes[index];
    const focused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) navigation.navigate(routeName);
    };

    return (
      <Pressable
        className="w-16 items-center py-1"
        onPress={onPress}
        hitSlop={6}
      >
        <FontAwesome
          name={icon as never}
          size={20}
          color={focused ? LEDGER : MUTED}
        />
        <Text
          className={`mt-1 text-[10px] font-semibold ${
            focused ? "text-ledger" : "text-gray-400"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  // A non-tab action styled like a tab item (Join).
  const actionItem = (icon: string, label: string, onPress: () => void) => (
    <Pressable className="w-16 items-center py-1" onPress={onPress} hitSlop={6}>
      <FontAwesome name={icon as never} size={19} color={MUTED} />
      <Text className="mt-1 text-[10px] font-semibold text-gray-400">
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: insets.bottom + 10,
      }}
      className="items-center"
    >
      <View
        className="flex-row items-center rounded-[30px] bg-white px-2 py-2.5 dark:bg-gray-900"
        style={softShadow}
      >
        {tabItem("groups", "th-large", "Groups")}
        {tabItem("activity", "history", "Activity")}

        {/* Prominent central Create action */}
        <Pressable
          className="mx-1 h-14 w-14 items-center justify-center rounded-full bg-ledger active:opacity-80"
          style={softShadowSm}
          onPress={() => router.push("/groups/create")}
          hitSlop={6}
        >
          <FontAwesome name="plus" size={22} color="#ffffff" />
        </Pressable>

        {actionItem("qrcode", "Join", () => router.push("/groups/scan"))}
        {tabItem("profile", "user", "Profile")}
      </View>
    </View>
  );
}
