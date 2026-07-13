import { Stack } from "expo-router";
import { Text, View } from "react-native";

/** Placeholder shell — group list arrives in Phase 2. */
export default function GroupsScreen() {
  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: "Groups" }} />
      <View className="flex-1 items-center justify-center px-8">
        <Text className="mb-2 text-center text-xl font-semibold text-gray-900">
          No groups yet
        </Text>
        <Text className="text-center text-base text-gray-500">
          Creating and joining groups lands in Phase 2.
        </Text>
      </View>
    </View>
  );
}
