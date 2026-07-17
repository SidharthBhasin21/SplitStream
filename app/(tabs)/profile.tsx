import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircleAvatar, entityTint } from "@/components/ui/CircleAvatar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useAuthStore } from "@/lib/authStore";
import { supabase } from "@/lib/supabase";
import { useThemeStore, type ThemePreference } from "@/lib/themeStore";
import type { Profile } from "@/lib/types";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;
  const { preference, setPreference } = useThemeStore();

  const {
    data: profile,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });

  const initials = (profile?.name ?? "?")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const tint = userId ? entityTint(userId) : { bg: "#E8ECEB", fg: "#5C6B68" };

  const confirmSignOut = () => {
    Alert.alert("Sign out?", "You can log back in any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  };

  return (
    <View
      className="flex-1 bg-paper px-5 dark:bg-gray-950"
      style={{ paddingTop: insets.top + 24 }}
    >
      {/* Centered identity block (design-ref 04) */}
      <View className="items-center">
        {isPending ? (
          <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <ActivityIndicator />
          </View>
        ) : (
          <CircleAvatar initials={initials} bg={tint.bg} fg={tint.fg} size={96} />
        )}
        {error ? (
          <Pressable className="mt-4" onPress={() => refetch()}>
            <Text className="text-base text-rust">
              Couldn't load your profile — tap to retry
            </Text>
          </Pressable>
        ) : (
          <Text className="mt-4 text-2xl font-bold text-ink dark:text-gray-50">
            {profile?.name ?? " "}
          </Text>
        )}
        <Text className="mt-1 text-base text-gray-400">
          {session?.user.email}
        </Text>
      </View>

      <Text className="mb-2 mt-10 text-lg font-bold text-ink dark:text-gray-100">
        Preferences
      </Text>
      <View className="rounded-3xl bg-white p-4 dark:bg-gray-900">
        <Text className="mb-2 text-sm font-medium text-gray-400">
          Appearance
        </Text>
        <SegmentedControl
          options={THEME_OPTIONS}
          value={preference}
          onChange={setPreference}
        />
      </View>

      <Pressable
        className="mt-6 items-center rounded-full border border-rust/30 py-4 active:bg-rust/10 dark:border-rust/50"
        onPress={confirmSignOut}
      >
        <Text className="text-base font-semibold text-rust">Sign out</Text>
      </Pressable>
    </View>
  );
}
