import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { BalanceHero } from "@/components/ui/BalanceHero";
import { CircleAvatar } from "@/components/ui/CircleAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { AmountCell, ListRow } from "@/components/ui/ListRow";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useAuthStore } from "@/lib/authStore";
import { computeBalances, formatINR } from "@/lib/balances";
import { asCategory, CATEGORY_META } from "@/lib/categories";
import {
  useDeleteSettlement,
  useExpenses,
  useGroupRealtime,
  useSettlements,
  type CachedExpense,
  type CachedSettlement,
} from "@/lib/expenseSync";
import { useGroup, useGroupMembers } from "@/lib/groups";

type Filter = "all" | "iowe" | "owedtome";

type Txn =
  | { kind: "expense"; row: CachedExpense }
  | { kind: "settlement"; row: CachedSettlement };

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "iowe", label: "You owe" },
  { value: "owedtome", label: "Owed to you" },
];

function MemberBalanceRow({
  name,
  amount,
  isSelf,
}: {
  name: string;
  amount: number;
  isSelf: boolean;
}) {
  const label = amount > 0 ? "gets back" : amount < 0 ? "owes" : "settled up";
  const color =
    amount > 0 ? "text-ledger" : amount < 0 ? "text-rust" : "text-gray-400";
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-base text-ink dark:text-gray-100">
        {isSelf ? "You" : name}
      </Text>
      <Text className={`text-base font-semibold ${color}`}>
        {label}
        {amount !== 0 ? ` ${formatINR(amount)}` : ""}
      </Text>
    </View>
  );
}

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: group } = useGroup(groupId);
  const { data: members } = useGroupMembers(groupId);
  const { data: expenses, isPending } = useExpenses(groupId);
  const { data: settlements } = useSettlements(groupId);
  const deleteSettlement = useDeleteSettlement(groupId);
  // Live-merge other members' changes into the list while this screen is open.
  useGroupRealtime(groupId);

  const [filter, setFilter] = useState<Filter>("all");

  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of members ?? []) map[m.user_id] = m.profiles.name;
    return map;
  }, [members]);

  // Pure function over the cached expense list — recomputes on every change,
  // including optimistic ones, so balances react instantly too (PRD 5.5).
  const balances = useMemo(
    () =>
      computeBalances(
        expenses ?? [],
        (members ?? []).map((m) => m.user_id),
        settlements ?? [],
      ),
    [expenses, members, settlements],
  );
  const myNet = userId ? (balances[userId] ?? 0) : 0;
  const memberCount = members?.length ?? 0;

  // One mixed, newest-first transaction list. Settlements only appear under
  // "All" — the owe/owed filters are about splitting expenses.
  const transactions = useMemo<Txn[]>(() => {
    let expenseList = expenses ?? [];
    if (filter === "iowe") {
      expenseList = expenseList.filter(
        (e) => e.paid_by !== null && e.paid_by !== userId,
      );
    } else if (filter === "owedtome") {
      expenseList = expenseList.filter((e) => e.paid_by === userId);
    }
    const rows: Txn[] = expenseList.map((e) => ({ kind: "expense", row: e }));
    if (filter === "all") {
      for (const s of settlements ?? []) {
        rows.push({ kind: "settlement", row: s });
      }
    }
    return rows.sort((a, b) =>
      b.row.created_at.localeCompare(a.row.created_at),
    );
  }, [expenses, settlements, filter, userId]);

  const shareInvite = () => {
    if (!group) return;
    Share.share({
      message: `Join "${group.name}" on SplitStream with invite code: ${group.invite_code}`,
    });
  };

  const renderExpense = ({ item }: { item: CachedExpense }) => {
    const meta = CATEGORY_META[asCategory(item.category)];
    const date = new Date(item.created_at).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
    const payer =
      item.paid_by === userId
        ? "You"
        : (nameById[item.paid_by ?? ""] ?? "Someone");
    // My net impact of this row: payer is credited in full, everyone owes a
    // share — same equal-split semantics as lib/balances.ts.
    const share = memberCount > 0 ? item.amount / memberCount : 0;
    const impact =
      item.paid_by === null
        ? 0
        : Math.round(
            (item.paid_by === userId ? item.amount - share : -share) * 100,
          ) / 100;
    const isMine = item.created_by === userId && !item._optimistic;

    return (
      <Animated.View entering={FadeInDown.duration(250)}>
        <ListRow
          avatar={
            <CircleAvatar icon={meta.icon} bg={meta.tint.bg} fg={meta.tint.fg} />
          }
          title={item.description}
          subtitle={`${payer} paid ${formatINR(item.amount)}${
            item._optimistic ? " · Syncing…" : ""
          }`}
          right={<AmountCell amount={impact} topLine={date} />}
          dimmed={item._optimistic}
          onPress={
            isMine
              ? () =>
                  router.push(
                    `/groups/${groupId}/add-expense?expenseId=${item.id}`,
                  )
              : undefined
          }
        />
      </Animated.View>
    );
  };

  const renderSettlement = (item: CachedSettlement) => {
    const date = new Date(item.created_at).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
    const fromName =
      item.from_user === userId
        ? "You"
        : (nameById[item.from_user] ?? "Someone");
    const toName =
      item.to_user === userId ? "you" : (nameById[item.to_user] ?? "someone");
    const canDelete = item.created_by === userId && !item._optimistic;

    const confirmDelete = () => {
      Alert.alert("Delete this payment?", "Balances will shift back.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteSettlement.mutate(item.id),
        },
      ]);
    };

    return (
      <Animated.View entering={FadeInDown.duration(250)}>
        <ListRow
          avatar={
            <CircleAvatar icon="handshake-o" bg="#D9EFE7" fg="#2F5D50" />
          }
          title={`${fromName} paid ${toName}`}
          subtitle={`Payment${item._optimistic ? " · Syncing…" : ""}`}
          right={
            <View className="items-end">
              <Text className="text-xs text-gray-400 dark:text-gray-500">
                {date}
              </Text>
              <Text className="text-base font-bold text-gray-500 dark:text-gray-400">
                {formatINR(item.amount)}
              </Text>
            </View>
          }
          dimmed={item._optimistic}
          onPress={canDelete ? confirmDelete : undefined}
        />
      </Animated.View>
    );
  };

  const renderTxn = ({ item }: { item: Txn }) =>
    item.kind === "expense"
      ? renderExpense({ item: item.row })
      : renderSettlement(item.row);

  return (
    <View className="flex-1 bg-paper dark:bg-gray-950">
      <Stack.Screen options={{ headerShown: false }} />
      {/* Hero card is navy in both themes — force light status bar icons. */}
      <StatusBar style="light" />

      <BalanceHero
        label="Your balance in this group"
        amount={myNet}
        subtitle={
          myNet > 0 ? "you're owed" : myNet < 0 ? "you owe" : "all settled up"
        }
        topBar={
          <View className="flex-row items-center justify-between">
            <Pressable
              hitSlop={12}
              // Deep links (push-notification taps, direct URLs) can land
              // here with no history — fall back to the groups list.
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/groups")
              }
            >
              <FontAwesome name="chevron-left" size={18} color="white" />
            </Pressable>
            <Text
              className="flex-1 px-3 text-center text-lg font-bold text-white"
              numberOfLines={1}
            >
              {group?.name ?? ""}
            </Text>
            <Link href={`/groups/${groupId}/members`} asChild>
              <Pressable hitSlop={12}>
                <FontAwesome name="users" size={18} color="white" />
              </Pressable>
            </Link>
          </View>
        }
        actions={[
          {
            icon: "plus",
            label: "Add expense",
            onPress: () => router.push(`/groups/${groupId}/add-expense`),
          },
          {
            icon: "handshake-o",
            label: "Settle up",
            onPress: () => router.push(`/groups/${groupId}/settle`),
          },
          { icon: "share-alt", label: "Share", onPress: shareInvite },
        ]}
      />

      {isPending || !members ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          className="mt-4 px-5"
          data={transactions}
          keyExtractor={(t) => t.row.id}
          renderItem={renderTxn}
          ListHeaderComponent={
            <View>
              {members.length > 0 && (expenses?.length ?? 0) > 0 ? (
                <View className="mb-4 rounded-2xl bg-white px-4 py-3 dark:bg-gray-900">
                  {members.map((m) => (
                    <MemberBalanceRow
                      key={m.user_id}
                      name={m.profiles.name}
                      amount={balances[m.user_id] ?? 0}
                      isSelf={m.user_id === userId}
                    />
                  ))}
                </View>
              ) : null}

              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-lg font-bold text-ink dark:text-gray-100">
                  Transactions
                </Text>
                <View className="flex-row gap-5">
                  <Link href={`/groups/${groupId}/activity`} asChild>
                    <Pressable hitSlop={8}>
                      <FontAwesome name="history" size={17} color="#9ca3af" />
                    </Pressable>
                  </Link>
                  <Link href={`/groups/${groupId}/stats`} asChild>
                    <Pressable hitSlop={8}>
                      <FontAwesome name="bar-chart" size={16} color="#9ca3af" />
                    </Pressable>
                  </Link>
                </View>
              </View>

              <View className="mb-2">
                <SegmentedControl
                  options={FILTERS}
                  value={filter}
                  onChange={setFilter}
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            filter === "all" ? (
              <EmptyState
                icon="money"
                title="No expenses yet"
                message="Add the first expense and SplitStream will keep the balances straight."
                ctaLabel="Add expense"
                onCta={() => router.push(`/groups/${groupId}/add-expense`)}
              />
            ) : (
              <Text className="pt-10 text-center text-sm text-gray-400">
                Nothing here for this filter.
              </Text>
            )
          }
          contentContainerClassName="pb-8"
        />
      )}
    </View>
  );
}
