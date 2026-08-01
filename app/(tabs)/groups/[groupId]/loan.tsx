import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { CircleAvatar, entityTint } from "@/components/ui/CircleAvatar";
import { AmountCell, ListRow } from "@/components/ui/ListRow";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useAuthStore } from "@/lib/authStore";
import { computeBalances } from "@/lib/balances";
import { currencyMeta } from "@/lib/currency";
import {
  useAddSettlement,
  useExpenses,
  useSettlements,
} from "@/lib/expenseSync";
import { useGroup, useGroupMembers } from "@/lib/groups";

type Direction = "i_lent" | "they_lent";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Record a loan (v1.5): cash handed to another member OUTSIDE the shared
 * expenses — "they ran out of cash so I lent them ₹2,000". Settle-up
 * deliberately locks its direction to debtor→creditor, so this screen is
 * the free-direction counterpart. A loan is the same ledger primitive as a
 * settlement (the lender's net rises, the borrower's falls — money moved
 * hands directly), so it writes the same settlements table; no new schema.
 */
export default function LoanScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: group } = useGroup(groupId);
  const { data: members } = useGroupMembers(groupId);
  const { data: expenses } = useExpenses(groupId);
  const { data: settlements } = useSettlements(groupId);
  const addSettlement = useAddSettlement(groupId);

  // Current positions, shown as context beside each member (same as settle).
  const balances = useMemo(
    () =>
      computeBalances(
        expenses ?? [],
        (members ?? []).map((m) => m.user_id),
        settlements ?? [],
      ),
    [expenses, members, settlements],
  );

  const others = useMemo(
    () => (members ?? []).filter((m) => m.user_id !== userId),
    [members, userId],
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>("i_lent");
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const submitted = useRef(false);

  const selectedMember = others.find((m) => m.user_id === selected);
  const firstName = selectedMember?.profiles.name.split(/\s+/)[0] ?? "them";
  const currency = group?.currency ?? "INR";

  const onSubmit = () => {
    if (submitted.current || !selected || !userId) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setAmountError("Enter an amount greater than 0");
      return;
    }
    if (value > 99_999_999.99) {
      setAmountError("That amount is too large");
      return;
    }
    submitted.current = true;
    // The LENDER is from_user: a settlement raises from_user's net (they're
    // owed more) and lowers to_user's — exactly what handing cash over does.
    addSettlement.mutate({
      from_user: direction === "i_lent" ? userId : selected,
      to_user: direction === "i_lent" ? selected : userId,
      amount: Math.round(value * 100) / 100,
      kind: "loan",
    });
    router.back();
  };

  return (
    <ScrollView
      className="flex-1 bg-paper px-6 pt-6 dark:bg-gray-950"
      contentContainerClassName="pb-40"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Record a loan" }} />

      <Text className="mb-4 text-sm text-gray-400 dark:text-gray-500">
        Cash handed over directly — outside any shared expense. The lender is
        owed this amount back, and it shows up in the group's balances.
      </Text>

      <Text className="mb-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
        Loan with
      </Text>
      <View className="mb-4 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {others.map((m, i) => {
          const tint = entityTint(m.user_id);
          const net = balances[m.user_id] ?? 0;
          return (
            <Pressable
              key={m.user_id}
              className={`px-4 ${
                i > 0 ? "border-t border-gray-100 dark:border-gray-800" : ""
              } ${selected === m.user_id ? "bg-ledger/5" : "bg-transparent"}`}
              onPress={() => {
                setSelected(m.user_id);
                setAmountError(null);
              }}
            >
              <ListRow
                avatar={
                  <CircleAvatar
                    initials={initials(m.profiles.name)}
                    bg={tint.bg}
                    fg={tint.fg}
                    size={40}
                  />
                }
                title={m.profiles.name}
                subtitle={selected === m.user_id ? "selected" : undefined}
                right={
                  <AmountCell
                    amount={net}
                    currency={currency}
                    topLine={
                      net < 0 ? "owes:" : net > 0 ? "gets back:" : undefined
                    }
                  />
                }
              />
            </Pressable>
          );
        })}
        {others.length === 0 ? (
          <Text className="px-4 py-6 text-center text-sm text-gray-400">
            Nobody else is in this group yet.
          </Text>
        ) : null}
      </View>

      {selectedMember ? (
        <>
          <Text className="mb-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
            Direction
          </Text>
          <SegmentedControl
            options={[
              { value: "i_lent" as Direction, label: `You lent ${firstName}` },
              {
                value: "they_lent" as Direction,
                label: `${firstName} lent you`,
              },
            ]}
            value={direction}
            onChange={setDirection}
          />

          <Text className="mb-1.5 mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">
            Amount ({currencyMeta(currency).symbol})
          </Text>
          <TextInput
            className={`rounded-2xl border bg-white px-4 py-3.5 text-base text-ink dark:bg-gray-900 dark:text-gray-100 ${
              amountError ? "border-rust" : "border-gray-200 dark:border-gray-800"
            }`}
            placeholder="0.00"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              setAmountError(null);
            }}
          />
          {amountError ? (
            <Text className="mt-1 text-xs text-rust">{amountError}</Text>
          ) : null}
          <Text className="mt-1.5 text-sm text-gray-400">
            {direction === "i_lent"
              ? `${firstName} will owe you this on top of any expense shares.`
              : `You'll owe ${firstName} this on top of any expense shares.`}
          </Text>

          <Pressable
            className="mt-6 items-center rounded-full bg-ink py-4 active:opacity-80 dark:bg-white"
            onPress={onSubmit}
          >
            <Text className="text-base font-semibold text-white dark:text-ink">
              Record loan
            </Text>
          </Pressable>
        </>
      ) : (
        <Text className="mt-2 text-center text-sm text-gray-400">
          Pick who the loan is with to continue.
        </Text>
      )}
    </ScrollView>
  );
}
