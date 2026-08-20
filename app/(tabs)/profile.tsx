import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircleAvatar, entityTint } from "@/components/ui/CircleAvatar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useDeleteAccount } from "@/lib/account";
import { useAuthStore } from "@/lib/authStore";
import { CURRENCIES } from "@/lib/currency";
import { useCurrencyStore } from "@/lib/currencyStore";
import { supabase } from "@/lib/supabase";
import { useThemeStore, type ThemePreference } from "@/lib/themeStore";
import { useToastStore } from "@/lib/toastStore";
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
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;
  const { preference, setPreference } = useThemeStore();
  const { homeCurrency, setHomeCurrency } = useCurrencyStore();
  const deleteAccount = useDeleteAccount();

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
        // Wipe the React Query cache AFTER sign-out unmounts the app tabs
        // (audit #27): queries aren't keyed per user, so without this a
        // second account on the same device briefly sees the first
        // account's cached groups.
        onPress: async () => {
          await supabase.auth.signOut();
          queryClient.clear();
        },
      },
    ]);
  };

  // Point of no return, split out so the first alert stays purely
  // informational — the user has to choose destruction twice.
  const reallyDeleteAccount = () => {
    Alert.alert(
      "This can't be undone",
      "You won't be able to sign in to Lumenz again with this account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount.mutateAsync();
              // Session is already cleared, which flips the route guard to
              // the auth stack; drop the cache so nothing of theirs lingers.
              queryClient.clear();
            } catch (e) {
              useToastStore
                .getState()
                .show(
                  e instanceof Error
                    ? e.message
                    : "Couldn't delete your account. Try again.",
                );
            }
          },
        },
      ],
    );
  };

  // Two-step on purpose: deletion is irreversible. The first alert is honest
  // about what SURVIVES — hiding that would be the unpleasant surprise.
  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete your account?",
      "Your sign-in, name and notifications are permanently removed.\n\nExpenses and payments you recorded stay in your groups, shown as “Deleted user” — removing them would change what everyone else owes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: reallyDeleteAccount,
        },
      ],
    );
  };

  return (
    // Scrollable: the currency picker alone is several rows tall, and the
    // account-deletion control below must stay reachable on small screens
    // (Play requires it to be discoverable in-app).
    <ScrollView
      className="flex-1 bg-paper px-5 dark:bg-gray-950"
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: 160 }}
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

      <Text className="mb-2 mt-4 text-lg font-bold text-ink dark:text-gray-100">
        Home currency
      </Text>
      <View className="rounded-3xl bg-white p-4 dark:bg-gray-900">
        <Text className="mb-3 text-sm text-gray-400">
          Used to convert your cross-group balance total on the Groups tab.
          Each group still tracks expenses in its own currency.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {CURRENCIES.map((c) => {
            const selected = homeCurrency === c.code;
            return (
              <Pressable
                // Remount on selection flip — NativeWind can't upgrade a
                // mounted component's style features.
                key={`${c.code}-${selected}`}
                className={`flex-row items-center rounded-full border px-3 py-2 ${
                  selected
                    ? "border-ledger bg-ledger"
                    : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                }`}
                onPress={() => setHomeCurrency(c.code)}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selected ? "text-white" : "text-ink dark:text-gray-100"
                  }`}
                >
                  {c.symbol}
                </Text>
                <Text
                  className={`ml-1.5 text-sm ${
                    selected
                      ? "font-semibold text-white"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {c.code}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        className="mt-6 items-center rounded-full border border-rust/30 py-4 active:bg-rust/10 dark:border-rust/50"
        onPress={confirmSignOut}
      >
        <Text className="text-base font-semibold text-rust">Sign out</Text>
      </Pressable>

      <Pressable
        className="mt-4 items-center py-3 active:opacity-60"
        onPress={confirmDeleteAccount}
        disabled={deleteAccount.isPending}
      >
        {deleteAccount.isPending ? (
          <ActivityIndicator color="#B54A3A" />
        ) : (
          <Text className="text-sm font-semibold text-rust">
            Delete account
          </Text>
        )}
      </Pressable>
      <Text className="mt-1 text-center text-xs text-gray-400">
        Permanently removes your sign-in. Shared expenses stay in your groups.
      </Text>
    </ScrollView>
  );
}
