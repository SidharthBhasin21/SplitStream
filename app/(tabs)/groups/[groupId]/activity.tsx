import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";

import {
  describeActivity,
  useActivity,
  useActivityRealtime,
  type ActivityWithActor,
} from "@/lib/activity";

const ACTION_ICONS: Record<ActivityWithActor["action"], string> = {
  expense_added: "plus",
  expense_edited: "pencil",
  expense_deleted: "trash",
  member_joined: "user-plus",
};

function ActivityRow({ entry }: { entry: ActivityWithActor }) {
  const when = new Date(entry.created_at).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <View className="mb-2 flex-row items-center rounded-xl bg-white p-3 dark:bg-gray-900">
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950">
        <FontAwesome
          name={ACTION_ICONS[entry.action] as never}
          size={14}
          color="#0d9488"
        />
      </View>
      <View className="flex-1">
        <Text className="text-base text-gray-900 dark:text-gray-100">
          {describeActivity(entry)}
        </Text>
        <Text className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
          {when}
        </Text>
      </View>
    </View>
  );
}

/** Append-only per-group feed (v1.1) — live via realtime while on screen. */
export default function ActivityScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { data: entries, isPending, error, refetch } = useActivity(groupId);
  useActivityRealtime(groupId);

  return (
    <View className="flex-1 bg-gray-50 px-4 pt-4 dark:bg-gray-950">
      <Stack.Screen options={{ title: "Activity" }} />

      {error ? (
        <View className="mt-8 items-center">
          <Text className="mb-2 text-center text-base text-red-500">
            Couldn't load activity.
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text className="font-semibold text-teal-600">Try again</Text>
          </Pressable>
        </View>
      ) : isPending ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => <ActivityRow entry={item} />}
          ListEmptyComponent={
            <View className="items-center px-8 pt-16">
              <FontAwesome name="history" size={40} color="#d1d5db" />
              <Text className="mb-2 mt-4 text-center text-xl font-semibold text-gray-900 dark:text-gray-100">
                Nothing yet
              </Text>
              <Text className="text-center text-base text-gray-500 dark:text-gray-400">
                Group activity — expenses added, edited, members joining —
                shows up here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
