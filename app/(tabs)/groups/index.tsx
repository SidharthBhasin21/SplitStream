import { Link, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircleAvatar, entityTint } from "@/components/ui/CircleAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { AmountCell, ListRow } from "@/components/ui/ListRow";
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
      className="flex-1 bg-paper px-5 dark:bg-gray-950"
      style={{ paddingTop: insets.top }}
    >
      {/* Summary header (design-ref screen 1) */}
      <View className="pt-4">
        <Text className="text-sm font-medium text-gray-400">Summary</Text>
        <Text
          className={`mt-1 text-5xl font-bold ${
            total < 0
              ? "text-rust dark:text-rust"
              : "text-ink dark:text-gray-50"
          }`}
        >
          {total < 0 ? "-" : ""}
          {formatINR(total)}
        </Text>
      </View>

      <View className="mt-5">
        <SegmentedControl
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />
      </View>

      {isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-2 text-center text-base text-rust">
            Couldn't load your groups.
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text className="font-semibold text-ledger">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          className="mt-2"
          data={visible}
          keyExtractor={({ group }) => group.id}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item: { group, net } }) => {
            const tint = entityTint(group.id);
            const memberCount = group.group_members[0]?.count ?? 0;
            return (
              <ListRow
                avatar={
                  <CircleAvatar
                    initials={groupInitials(group.name)}
                    bg={tint.bg}
                    fg={tint.fg}
                  />
                }
                title={group.name}
                subtitle={`${memberCount} ${memberCount === 1 ? "member" : "members"}`}
                right={<AmountCell amount={net} />}
                onPress={() => router.push(`/groups/${group.id}`)}
              />
            );
          }}
          ListEmptyComponent={
            filter === "overall" ? (
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
      )}

      <View className="flex-row gap-3 pb-6 pt-2">
        <Link href="/groups/join" asChild>
          <Pressable className="flex-1 items-center rounded-full border border-ink/20 bg-transparent py-3.5 active:bg-gray-100 dark:border-gray-600 dark:active:bg-gray-800">
            <Text className="text-base font-semibold text-ink dark:text-gray-100">
              Join with code
            </Text>
          </Pressable>
        </Link>
        <Link href="/groups/create" asChild>
          <Pressable className="flex-1 items-center rounded-full bg-ink py-3.5 active:opacity-80 dark:bg-white">
            <Text className="text-base font-semibold text-white dark:text-ink">
              Create group
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
