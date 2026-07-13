import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View className="flex-1 items-center justify-center bg-gray-50 p-5">
        <Text className="text-xl font-bold text-gray-900">
          This screen doesn't exist.
        </Text>
        <Link href="/groups" className="mt-4 py-4 font-semibold text-teal-600">
          Go home
        </Link>
      </View>
    </>
  );
}
