import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { CircleAvatar } from "@/components/ui/CircleAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { PressableScale } from "@/components/ui/PressableScale";
import {
  describeActivity,
  useAllActivity,
  useAllActivityRealtime,
  type ActivityWithGroup,
} from "@/lib/activity";

/** Icon + pastel tint per action, matching the category avatar language. */
const ACTION_STYLE: Record<
  ActivityWithGroup["action"],
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
  onPress,
}: {
  entry: ActivityWithGroup;
  onPress?: () => void;
}) {
  const style = ACTION_STYLE[entry.action];
  const when = new Date(entry.created_at).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const group = entry.groups?.name;
  const currency = entry.groups?.currency ?? "INR";

  return (
    <PressableScale className="mb-3" onPress={onPress}>
      <Card shadow="sm" className="px-4">
        <ListRow
          avatar={<CircleAvatar icon={style.icon} bg={style.bg} fg={style.fg} />}
          title={describeActivity(entry, currency)}
          subtitle={group ? `${group} · ${when}` : when}
        />
      </Card>
    </PressableScale>
  );
}

/** Global cross-group activity feed (design v3 — the Activity tab). */
export default function ActivityTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: entries, isPending, error, refetch } = useAllActivity();
  useAllActivityRealtime();

  return (
    <View
      className="flex-1 bg-paper dark:bg-gray-950"
      style={{ paddingTop: insets.top }}
    >
      <FlatList
        className="px-5"
        contentContainerClassName="pb-40"
        data={entries}
        keyExtractor={(e) => e.id}
        onRefresh={refetch}
        refreshing={false}
        ListHeaderComponent={
          <Text className="pb-4 pt-3 text-2xl font-extrabold text-ink dark:text-gray-50">
            Activity
          </Text>
        }
        renderItem={({ item }) => (
          <ActivityRow
            entry={item}
            onPress={
              item.group_id
                ? () => router.push(`/groups/${item.group_id}`)
                : undefined
            }
          />
        )}
        ListEmptyComponent={
          isPending ? (
            <ActivityIndicator className="mt-16" />
          ) : error ? (
            <View className="mt-16 items-center px-8">
              <Text className="mb-2 text-center text-base text-rust">
                Couldn't load activity.
              </Text>
              <Pressable onPress={() => refetch()}>
                <Text className="font-semibold text-ledger">Try again</Text>
              </Pressable>
            </View>
          ) : (
            <EmptyState
              icon="history"
              title="No activity yet"
              message="Expenses, edits, payments and new members across all your groups show up here."
            />
          )
        }
      />
    </View>
  );
}
