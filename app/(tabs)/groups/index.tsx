import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { CircleAvatar, entityTint } from "@/components/ui/CircleAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { AmountCell } from "@/components/ui/ListRow";
import { PressableScale } from "@/components/ui/PressableScale";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useAuthStore } from "@/lib/authStore";
import { computeMyNet, formatINR } from "@/lib/balances";
import {
  useGroupExpenseSummaries,
  useGroups,
  type GroupListItem,
} from "@/lib/groups";

type Filter = "overall" | "iowe" | "owedtome";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "overall", label: "Overall" },
  { value: "iowe", label: "I owe" },
  { value: "owedtome", label: "Owed to me" },
];

function groupInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function GroupCard({
  group,
  net,
  index,
  onPress,
}: {
  group: GroupListItem;
  net: number;
  index: number;
  onPress: () => void;
}) {
  const tint = entityTint(group.id);
  const memberCount = group.group_members[0]?.count ?? 0;
  return (
    // Subtle entrance: a gentle fade with a small stagger — no big slide.
    <Animated.View entering={FadeIn.delay(index * 35).duration(260)}>
      <PressableScale className="mb-4" onPress={onPress}>
        <Card className="flex-row items-center px-4 py-4">
          <CircleAvatar
            initials={groupInitials(group.name)}
            bg={tint.bg}
            fg={tint.fg}
            size={52}
          />
          <View className="ml-3.5 flex-1 pr-2">
            <Text
              className="text-lg font-bold text-ink dark:text-gray-100"
              numberOfLines={1}
            >
              {group.name}
            </Text>
            <Text className="mt-0.5 text-sm text-gray-400">
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </Text>
          </View>
          <AmountCell amount={net} />
        </Card>
      </PressableScale>
    </Animated.View>
  );
}

export default function GroupsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id) ?? "";
  const { data: groups, isPending, error, refetch, isRefetching } = useGroups();
  const { data: summaries } = useGroupExpenseSummaries();
  const [filter, setFilter] = useState<Filter>("overall");

  // Live net per group (my perspective), derived from the summary query —
  // expenses split equally, settlements shifted pairwise (v1.2).
  const withNet = useMemo(
    () =>
      (groups ?? []).map((group: GroupListItem) => ({
        group,
        net: computeMyNet(
          summaries?.expenses?.[group.id] ?? [],
          group.group_members[0]?.count ?? 0,
          userId,
          summaries?.settlements?.[group.id] ?? [],
        ),
      })),
    [groups, summaries, userId],
  );

  const total = useMemo(
    () => Math.round(withNet.reduce((sum, g) => sum + g.net, 0) * 100) / 100,
    [withNet],
  );

  const visible = useMemo(() => {
    if (filter === "iowe") return withNet.filter((g) => g.net < 0);
    if (filter === "owedtome") return withNet.filter((g) => g.net > 0);
    return withNet;
  }, [withNet, filter]);

  return (
    <View
      className="flex-1 bg-paper dark:bg-gray-950"
      style={{ paddingTop: insets.top }}
    >
      <FlatList
        className="px-5"
        contentContainerClassName="pb-40"
        data={visible}
        keyExtractor={({ group }) => group.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListHeaderComponent={
          <View className="pb-1 pt-3">
            <Text className="mb-6 text-2xl font-extrabold text-ink dark:text-gray-50">
              Groups
            </Text>

            {/* Summary — total you're owed / owe across all groups */}
            <Text className="text-base font-medium text-gray-400">
              Your balance
            </Text>
            <Text
              className={`mt-1 text-[44px] font-extrabold leading-tight ${
                total < 0
                  ? "text-rust dark:text-rust"
                  : "text-ink dark:text-gray-50"
              }`}
            >
              {total < 0 ? "-" : ""}
              {formatINR(total)}
            </Text>

            <View className="mb-5 mt-5">
              <SegmentedControl
                options={FILTERS}
                value={filter}
                onChange={setFilter}
              />
            </View>
          </View>
        }
        renderItem={({ item: { group, net }, index }) => (
          <GroupCard
            group={group}
            net={net}
            index={index}
            onPress={() => router.push(`/groups/${group.id}`)}
          />
        )}
        ListEmptyComponent={
          isPending ? (
            <ActivityIndicator className="mt-16" />
          ) : error ? (
            <View className="mt-16 items-center px-8">
              <Text className="mb-2 text-center text-base text-rust">
                Couldn't load your groups.
              </Text>
              <Pressable onPress={() => refetch()}>
                <Text className="font-semibold text-ledger">Try again</Text>
              </Pressable>
            </View>
          ) : filter === "overall" ? (
            <EmptyState
              icon="users"
              title="No groups yet"
              message="Create a group for your trip or flat, or join one with an invite code."
              ctaLabel="Create a group"
              onCta={() => router.push("/groups/create")}
            />
          ) : (
            <Text className="pt-12 text-center text-sm text-gray-400">
              {filter === "iowe"
                ? "You don't owe anything. Nice."
                : "Nobody owes you right now."}
            </Text>
          )
        }
      />
    </View>
  );
}
