import { Link, Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useGroup } from "@/lib/groups";

/** Group detail shell — the expense list + balances land here in Phase 3. */
export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { data: group, isPending } = useGroup(groupId);

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen
        options={{
          title: group?.name ?? "",
          headerRight: () => (
            <Link href={`/groups/${groupId}/members`} asChild>
              <Pressable hitSlop={8}>
                <Text className="text-base font-semibold text-teal-600">
                  Members
                </Text>
              </Pressable>
            </Link>
          ),
        }}
      />

      {isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-2 text-center text-xl font-semibold text-gray-900">
            No expenses yet
          </Text>
          <Text className="text-center text-base text-gray-500">
            Adding expenses and live balances arrive in Phase 3.
          </Text>
        </View>
      )}
    </View>
  );
}
