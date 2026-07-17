import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/ui/EmptyState";
import { formatINR } from "@/lib/balances";
import { CATEGORY_META } from "@/lib/categories";
import { useExpenses } from "@/lib/expenseSync";
import { spendByCategory, spendByMonth } from "@/lib/stats";

/**
 * Spend charts (v1.1). Deliberately hand-rolled with plain Views — two bar
 * charts don't justify a charting dependency, and the aggregation logic is
 * pure + unit-tested in lib/stats.ts.
 */

function CategoryBars({
  data,
}: {
  data: ReturnType<typeof spendByCategory>;
}) {
  const max = data[0]?.total ?? 0;
  return (
    <View className="rounded-3xl bg-white p-5 dark:bg-gray-900">
      <Text className="mb-3 text-sm font-medium text-gray-400">
        By category
      </Text>
      {data.map(({ category, total }) => {
        const meta = CATEGORY_META[category];
        return (
          <View key={category} className="mb-3">
            <View className="mb-1 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <FontAwesome
                  name={meta.icon as never}
                  size={13}
                  color={meta.tint.fg}
                />
                <Text className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                  {meta.label}
                </Text>
              </View>
              <Text className="text-sm font-bold text-ink dark:text-gray-100">
                {formatINR(total)}
              </Text>
            </View>
            <View className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${max > 0 ? (total / max) * 100 : 0}%`,
                  backgroundColor: meta.tint.fg,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Pixel height of the tallest month bar. Computed heights (not CSS
// percentages) because a percentage needs a parent with a definite height,
// which flex columns here don't have.
const CHART_HEIGHT = 128;

function MonthBars({ data }: { data: ReturnType<typeof spendByMonth> }) {
  const max = Math.max(...data.map((m) => m.total), 1);
  return (
    <View className="mt-4 rounded-3xl bg-white p-5 dark:bg-gray-900">
      <Text className="mb-3 text-sm font-medium text-gray-400">
        Last 6 months
      </Text>
      <View className="flex-row items-end justify-between">
        {data.map((m) => (
          <View key={m.key} className="flex-1 items-center justify-end">
            <View
              className={`w-6 rounded-t-md ${
                m.total > 0
                  ? "bg-ledger dark:bg-ledger"
                  : "bg-gray-100 dark:bg-gray-800"
              }`}
              // Zero months keep a 3px stub so the axis reads as continuous.
              style={{
                height: Math.max((m.total / max) * CHART_HEIGHT, 3),
              }}
            />
            <Text className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              {m.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function StatsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { data: expenses, isPending } = useExpenses(groupId);

  const byCategory = useMemo(() => spendByCategory(expenses ?? []), [expenses]);
  const byMonth = useMemo(() => spendByMonth(expenses ?? []), [expenses]);
  const total = useMemo(
    () => (expenses ?? []).reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  return (
    <ScrollView className="flex-1 bg-paper px-5 pt-4 dark:bg-gray-950">
      <Stack.Screen options={{ title: "Stats" }} />

      {isPending ? (
        <ActivityIndicator className="mt-8" />
      ) : (expenses ?? []).length === 0 ? (
        <EmptyState
          icon="bar-chart"
          title="No data yet"
          message="Charts appear once the group has expenses."
        />
      ) : (
        <>
          <View className="mb-4 items-center rounded-3xl bg-white p-5 dark:bg-gray-900">
            <Text className="text-sm font-medium text-gray-400">
              Total group spend
            </Text>
            <Text className="mt-1 text-4xl font-bold text-ink dark:text-gray-50">
              {formatINR(total)}
            </Text>
          </View>
          <CategoryBars data={byCategory} />
          <MonthBars data={byMonth} />
          <View className="h-8" />
        </>
      )}
    </ScrollView>
  );
}
