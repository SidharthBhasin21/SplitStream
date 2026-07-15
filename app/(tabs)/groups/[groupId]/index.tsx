import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useAuthStore } from "@/lib/authStore";
import { computeBalances, formatINR } from "@/lib/balances";
import { useGroup, useGroupMembers } from "@/lib/groups";
import {
  useExpenseRealtime,
  useExpenses,
  type CachedExpense,
} from "@/lib/expenseSync";

function BalanceRow({
  name,
  amount,
  isSelf,
}: {
  name: string;
  amount: number;
  isSelf: boolean;
}) {
  const label =
    amount > 0 ? "gets back" : amount < 0 ? "owes" : "settled up";
  const color =
    amount > 0 ? "text-green-600" : amount < 0 ? "text-red-500" : "text-gray-400";
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-base text-gray-900">
        {isSelf ? "You" : name}
      </Text>
      <Text className={`text-base font-semibold ${color}`}>
        {label}
        {amount !== 0 ? ` ${formatINR(amount)}` : ""}
      </Text>
    </View>
  );
}

function ExpenseRow({
  expense,
  payerName,
  isMine,
  groupId,
}: {
  expense: CachedExpense;
  payerName: string;
  isMine: boolean;
  groupId: string;
}) {
  const date = new Date(expense.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

  const content = (
    // Rows fade in on mount — most noticeably when a realtime insert from
    // another device lands in the list.
    <Animated.View entering={FadeInDown.duration(250)}>
      <View
        className={`mb-2 flex-row items-center justify-between rounded-xl bg-white p-4 ${
          expense._optimistic ? "opacity-60" : ""
        }`}
      >
        <View className="flex-1 pr-3">
          <Text
            className="text-base font-medium text-gray-900"
            numberOfLines={1}
          >
            {expense.description}
          </Text>
          <Text className="mt-0.5 text-sm text-gray-500">
            Paid by {payerName} · {date}
            {expense._optimistic ? " · Syncing…" : ""}
          </Text>
        </View>
        <Text className="text-base font-semibold text-gray-900">
          {formatINR(expense.amount)}
        </Text>
      </View>
    </Animated.View>
  );

  // Only the creator can edit (PRD 5.3) — and optimistic rows have no real
  // id to edit yet.
  if (!isMine || expense._optimistic) return content;

  return (
    <Link
      href={`/groups/${groupId}/add-expense?expenseId=${expense.id}`}
      asChild
    >
      <Pressable className="active:opacity-70">{content}</Pressable>
    </Link>
  );
}

export default function GroupDetailScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: group } = useGroup(groupId);
  const { data: members } = useGroupMembers(groupId);
  const { data: expenses, isPending, error, refetch } = useExpenses(groupId);
  // Live-merge other members' changes into the list while this screen is open.
  useExpenseRealtime(groupId);

  const nameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of members ?? []) map[m.user_id] = m.profiles.name;
    return map;
  }, [members]);

  // Pure function over the cached expense list — recomputes on every change,
  // including optimistic ones, so balances react instantly too (PRD 5.5).
  const balances = useMemo(
    () =>
      computeBalances(expenses ?? [], (members ?? []).map((m) => m.user_id)),
    [expenses, members],
  );

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

      {error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-2 text-center text-base text-red-500">
            Couldn't load this group's expenses.
          </Text>
          <Pressable onPress={() => refetch()}>
            <Text className="font-semibold text-teal-600">Try again</Text>
          </Pressable>
        </View>
      ) : isPending || !members ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          className="px-4 pt-4"
          data={expenses}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => (
            <ExpenseRow
              expense={item}
              payerName={
                item.paid_by === userId
                  ? "you"
                  : (nameById[item.paid_by ?? ""] ?? "someone")
              }
              isMine={item.created_by === userId}
              groupId={groupId}
            />
          )}
          ListHeaderComponent={
            <View className="mb-4 rounded-2xl border border-gray-200 bg-white px-4 py-3">
              <Text className="mb-1 text-sm font-medium uppercase tracking-wide text-gray-400">
                Balances
              </Text>
              {(members ?? []).map((m) => (
                <BalanceRow
                  key={m.user_id}
                  name={m.profiles.name}
                  amount={balances[m.user_id] ?? 0}
                  isSelf={m.user_id === userId}
                />
              ))}
            </View>
          }
          ListEmptyComponent={
            <View className="items-center px-8 pt-16">
              <FontAwesome name="money" size={40} color="#d1d5db" />
              <Text className="mb-2 mt-4 text-center text-xl font-semibold text-gray-900">
                No expenses yet
              </Text>
              <Text className="text-center text-base text-gray-500">
                Add the first expense and SplitStream will keep the balances
                straight.
              </Text>
            </View>
          }
        />
      )}

      <View className="px-4 pb-6 pt-2">
        <Link href={`/groups/${groupId}/add-expense`} asChild>
          <Pressable className="items-center rounded-xl bg-teal-600 py-3.5 active:bg-teal-700">
            <Text className="text-base font-semibold text-white">
              Add expense
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
