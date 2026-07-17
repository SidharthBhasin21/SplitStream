import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { z } from "zod";

import FontAwesome from "@expo/vector-icons/FontAwesome";

import { FormInput } from "@/components/FormInput";
import { useAuthStore } from "@/lib/authStore";
import {
  asCategory,
  CATEGORIES,
  CATEGORY_META,
  type Category,
} from "@/lib/categories";
import {
  useAddExpense,
  useDeleteExpense,
  useExpenses,
  useUpdateExpense,
} from "@/lib/expenseSync";
import { useGroupMembers } from "@/lib/groups";

const expenseSchema = z.object({
  description: z.string().trim().min(1, "What was this expense for?"),
  // Kept as a string in the form (TextInput), validated as money here and
  // converted once on submit.
  amount: z
    .string()
    .refine((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0;
    }, "Enter an amount greater than 0")
    .refine((v) => Number(v) <= 99_999_999.99, "That amount is too large"),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

export default function AddExpenseScreen() {
  const { groupId, expenseId } = useLocalSearchParams<{
    groupId: string;
    expenseId?: string;
  }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: members } = useGroupMembers(groupId);
  const { data: expenses } = useExpenses(groupId);
  // Editing reuses this screen: the row comes from the already-loaded cache.
  const existing = expenseId
    ? expenses?.find((e) => e.id === expenseId)
    : undefined;

  const addExpense = useAddExpense(groupId);
  const updateExpense = useUpdateExpense(groupId);
  const deleteExpense = useDeleteExpense(groupId);

  const [paidBy, setPaidBy] = useState<string>(
    existing?.paid_by ?? userId ?? "",
  );
  const [category, setCategory] = useState<Category>(
    existing ? asCategory(existing.category) : "other",
  );

  const { control, handleSubmit } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: existing?.description ?? "",
      amount: existing ? String(existing.amount) : "",
    },
  });

  // Guards against a double-tap on Save firing the mutation twice in the
  // instant before the modal dismisses (which would create two expenses).
  const submitted = useRef(false);

  // Fire-and-forget on purpose: the optimistic row (with its "Syncing…"
  // badge) is the submit feedback, and awaiting here would hang the modal
  // when offline — paused mutations don't settle until reconnect. Failures
  // roll back and toast from the sync layer (lib/expenseSync.ts).
  const onSubmit = ({ description, amount }: ExpenseForm) => {
    if (submitted.current) return;
    submitted.current = true;
    const patch = {
      description: description.trim(),
      amount: Math.round(Number(amount) * 100) / 100,
      paid_by: paidBy,
      category,
    };
    if (existing) {
      updateExpense.mutate({ expense: existing, patch });
    } else {
      addExpense.mutate(patch);
    }
    router.back();
  };

  const confirmDelete = () => {
    Alert.alert("Delete expense?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (expenseId) deleteExpense.mutate(expenseId);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-paper px-6 pt-6 dark:bg-gray-950"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{ title: existing ? "Edit expense" : "Add expense" }}
      />

      <FormInput
        control={control}
        name="description"
        label="Description"
        placeholder="Dinner at Baga"
        autoFocus={!existing}
      />
      <FormInput
        control={control}
        name="amount"
        label="Amount (₹)"
        placeholder="0.00"
        keyboardType="decimal-pad"
      />

      <Text className="mb-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
        Category
      </Text>
      <View className="mb-4 flex-row flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const selected = category === c;
          return (
            <Pressable
              // Remount on selection flip — see SegmentedControl for why
              // (NativeWind can't upgrade mounted components' style features).
              key={`${c}-${selected}`}
              className={`flex-row items-center rounded-full border px-3 py-2 ${
                selected
                  ? "border-ledger bg-ledger"
                  : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
              }`}
              onPress={() => setCategory(c)}
            >
              <FontAwesome
                name={CATEGORY_META[c].icon as never}
                size={12}
                color={selected ? "#ffffff" : "#2F5D50"}
              />
              <Text
                className={`ml-1.5 text-sm ${
                  selected
                    ? "font-semibold text-white"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {CATEGORY_META[c].label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="mb-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
        Paid by
      </Text>
      <View className="mb-4 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {(members ?? []).map((m, i) => (
          <Pressable
            key={m.user_id}
            className={`flex-row items-center justify-between px-4 py-3 active:bg-gray-50 dark:active:bg-gray-800 ${
              i > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""
            }`}
            onPress={() => setPaidBy(m.user_id)}
          >
            <Text className="text-base text-ink dark:text-gray-100">
              {m.user_id === userId ? "You" : m.profiles.name}
            </Text>
            {paidBy === m.user_id ? (
              <Text className="text-base font-bold text-ledger">✓</Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      <Text className="mb-4 text-sm text-gray-400 dark:text-gray-500">
        Split equally between all {members?.length ?? "…"} members
      </Text>

      <Pressable
        className="items-center rounded-full bg-ink py-4 active:opacity-80 dark:bg-white"
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="text-base font-semibold text-white dark:text-ink">
          {existing ? "Save changes" : "Add expense"}
        </Text>
      </Pressable>

      {existing ? (
        <Pressable
          className="mt-3 items-center rounded-full border border-rust/30 py-4 active:bg-rust/10 dark:border-rust/50"
          onPress={confirmDelete}
        >
          <Text className="text-base font-semibold text-rust">
            Delete expense
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
