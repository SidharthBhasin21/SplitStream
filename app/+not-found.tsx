import { Link, Stack } from "expo-router";
import { View } from "react-native";

import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View className="flex-1 justify-center bg-paper p-5 dark:bg-gray-950">
        <EmptyState
          icon="compass"
          title="This screen doesn't exist"
          message="The link you followed points nowhere."
        />
        <Link
          href="/groups"
          className="mt-6 text-center font-semibold text-ledger"
        >
          Go home
        </Link>
      </View>
    </>
  );
}
