import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import { useAuthStore } from "@/lib/authStore";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

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
    <View className="flex-1 bg-gray-50 px-6 pt-10">
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
          <Text className="text-xl font-semibold text-gray-900">
            {profile?.name ?? " "}
          </Text>
        )}
        <Text className="mt-1 text-base text-gray-500">
          {session?.user.email}
        </Text>
      </View>

      <Pressable
        className="mt-10 items-center rounded-xl border border-red-200 bg-white py-3.5 active:bg-red-50"
        onPress={confirmSignOut}
      >
        <Text className="text-base font-semibold text-red-500">Sign out</Text>
      </Pressable>
    </View>
  );
}
