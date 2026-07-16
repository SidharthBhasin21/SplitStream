import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

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
    <View className="flex-1 bg-gray-50 px-6 pt-10 dark:bg-gray-950">
      <View className="items-center">
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-teal-600">
          {isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-2xl font-bold text-white">{initials}</Text>
          )}
        </View>
        {error ? (
          <Pressable onPress={() => refetch()}>
            <Text className="text-base text-red-500">
              Couldn't load your profile — tap to retry
            </Text>
          </Pressable>
        ) : (
          <Text className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {profile?.name ?? " "}
          </Text>
        )}
        <Text className="mt-1 text-base text-gray-500 dark:text-gray-400">
          {session?.user.email}
        </Text>
      </View>

      <Text className="mb-1.5 mt-10 text-sm font-medium text-gray-700 dark:text-gray-300">
        Appearance
      </Text>
      <View className="flex-row rounded-xl border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
        {THEME_OPTIONS.map(({ value, label }) => {
          const selected = preference === value;
          return (
            <Pressable
              key={value}
              className={`flex-1 items-center rounded-lg py-2 ${
                selected ? "bg-teal-600" : ""
              }`}
              onPress={() => setPreference(value)}
            >
              <Text
                className={`text-sm ${
                  selected
                    ? "font-semibold text-white"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        className="mt-6 items-center rounded-xl border border-red-200 bg-white py-3.5 active:bg-red-50 dark:border-red-950 dark:bg-gray-900"
        onPress={confirmSignOut}
      >
        <Text className="text-base font-semibold text-red-500">Sign out</Text>
      </Pressable>
    </View>
  );
}
