import { Stack, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { CircleAvatar } from "@/components/ui/CircleAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import {
  describeActivity,
  useActivity,
  useActivityRealtime,
  type ActivityWithActor,
} from "@/lib/activity";
import { useGroup } from "@/lib/groups";

/** Icon + pastel tint per action, matching the category avatar language. */
const ACTION_STYLE: Record<
  ActivityWithActor["action"],
  { icon: string; bg: string; fg: string }
> = {
  expense_added: { icon: "plus", bg: "#D9EFE7", fg: "#2F5D50" },
  expense_edited: { icon: "pencil", bg: "#D8E9FC", fg: "#3B82C4" },
  expense_deleted: { icon: "trash", bg: "#F5DDD8", fg: "#B54A3A" },
  member_joined: { icon: "user-plus", bg: "#E9E0F8", fg: "#7C5CBF" },
  settled_up: { icon: "handshake-o", bg: "#D9EFE7", fg: "#2F5D50" },
  settlement_deleted: { icon: "handshake-o", bg: "#F5DDD8", fg: "#B54A3A" },
};

function ActivityRow({
  entry,
  currency,
}: {
  entry: ActivityWithActor;
  currency: string;
}) {
  const style = ACTION_STYLE[entry.action];
  const when = new Date(entry.created_at).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <ListRow
      avatar={<CircleAvatar icon={style.icon} bg={style.bg} fg={style.fg} />}
      title={describeActivity(entry, currency)}
      subtitle={when}
    />
  );
}

/** Append-only per-group feed (v1.1) — live via realtime while on screen. */
export default function ActivityScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { data: group } = useGroup(groupId);
  const { data: entries, isPending, error, refetch } = useActivity(groupId);
  useActivityRealtime(groupId);

  return (
    <View className="flex-1 bg-paper px-5 pt-2 dark:bg-gray-950">
      <Stack.Screen options={{ title: "Activity" }} />

      {error ? (
        <View className="mt-8 items-center">
          <Text className="mb-2 text-center text-base text-rust">
            Couldn't load activity.
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text className="font-semibold text-ledger">Try again</Text>
          </Pressable>
        </View>
      ) : isPending ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => (
            <ActivityRow entry={item} currency={group?.currency ?? "INR"} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="history"
              title="Nothing yet"
              message="Group activity — expenses added, edited, members joining — shows up here."
            />
          }
        />
      )}
    </View>
  );
}
