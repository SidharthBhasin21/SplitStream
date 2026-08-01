import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { CircleAvatar, entityTint } from "@/components/ui/CircleAvatar";
import { AmountCell, ListRow } from "@/components/ui/ListRow";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useAuthStore } from "@/lib/authStore";
import { computeBalances } from "@/lib/balances";
import { currencyMeta, formatMoney } from "@/lib/currency";
import {
  useAddSettlement,
  useExpenses,
  useSettlements,
} from "@/lib/expenseSync";
import { useGroup, useGroupMembers } from "@/lib/groups";

type Direction = "i_paid" | "they_paid";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Record a payment (v1.2): pick the other member, choose direction, adjust
 * the amount — prefilled with the suggested settle-up figure, but freely
 * editable so PARTIAL payments ("I sent them half for now") work naturally.
 */
export default function SettleScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user.id);

  const { data: group } = useGroup(groupId);
  const { data: members } = useGroupMembers(groupId);
  const { data: expenses } = useExpenses(groupId);
  const { data: settlements } = useSettlements(groupId);
  const addSettlement = useAddSettlement(groupId);

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

  const others = useMemo(
    () => (members ?? []).filter((m) => m.user_id !== userId),
    [members, userId],
  );

  const [selected, setSelected] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>("i_paid");
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const submitted = useRef(false);

  const selectedMember = others.find((m) => m.user_id === selected);
  const theirNet = selected ? (balances[selected] ?? 0) : 0;

  // Suggested settle-up: only meaningful when our balances oppose — the
  // smaller of the two sides is the most that settles cleanly between us.
  const suggested = useMemo(() => {
    if (!selected || myNet === 0 || theirNet === 0) return null;
    if (myNet > 0 === theirNet > 0) return null;
    return Math.round(Math.min(Math.abs(myNet), Math.abs(theirNet)) * 100) / 100;
  }, [selected, myNet, theirNet]);

  // The suggestion settles things in exactly ONE direction: the debtor pays
  // the creditor. When it exists, signs oppose, so if I'm in the red the
  // settling direction is me → them; otherwise them → me. In that case the
  // direction is LOCKED — a payment the other way widens the gap, and cash
  // handovers between members are deliberately not this screen's job. The
  // toggle only appears when there's no settling direction (both owe, both
  // owed, or someone's at zero).
  const settlingDirection: Direction | null =
    suggested === null ? null : myNet < 0 ? "i_paid" : "they_paid";
  const effectiveDirection = settlingDirection ?? direction;

  const pickMember = (memberId: string) => {
    setSelected(memberId);
    const net = balances[memberId] ?? 0;
    // Default direction: if I'm in the red and they're owed, I'm the payer.
    setDirection(myNet < 0 && net > 0 ? "i_paid" : "they_paid");
    const suggestion =
      myNet !== 0 && net !== 0 && myNet > 0 !== net > 0
        ? Math.round(Math.min(Math.abs(myNet), Math.abs(net)) * 100) / 100
        : null;
    setAmount(suggestion ? String(suggestion) : "");
    setAmountError(null);
  };

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
    // Fire-and-forget, same as add-expense: the optimistic row in the
    // transactions list is the feedback; failures roll back + toast.
    addSettlement.mutate({
      from_user: effectiveDirection === "i_paid" ? userId : selected,
      to_user: effectiveDirection === "i_paid" ? selected : userId,
      amount: Math.round(value * 100) / 100,
      kind: "payment",
    });
    router.back();
  };

  const firstName = selectedMember?.profiles.name.split(/\s+/)[0] ?? "them";
  const currency = group?.currency ?? "INR";

  return (
    <ScrollView
      className="flex-1 bg-paper px-6 pt-6 dark:bg-gray-950"
      contentContainerClassName="pb-40"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Settle up" }} />

      <Text className="mb-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
        Settle with
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
              onPress={() => pickMember(m.user_id)}
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
                  // Their position, so label it from their side ("owes"),
                  // not with AmountCell's default first-person labels.
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
          {settlingDirection !== null ? (
            // Unambiguous: debtor pays creditor. Shown as a fact, not a
            // choice — the reverse direction can't settle anything.
            <View className="rounded-2xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
              <Text className="text-base font-semibold text-ink dark:text-gray-100">
                {settlingDirection === "i_paid"
                  ? `You pay ${firstName}`
                  : `${firstName} pays you`}
              </Text>
            </View>
          ) : (
            <SegmentedControl
              options={[
                { value: "i_paid" as Direction, label: `You paid ${firstName}` },
                { value: "they_paid" as Direction, label: `${firstName} paid you` },
              ]}
              value={direction}
              onChange={setDirection}
            />
          )}

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
          {suggested !== null ? (
            <Text className="mt-1.5 text-sm text-gray-400">
              {formatMoney(suggested, currency)} settles you up — enter less
              for a partial payment.
            </Text>
          ) : null}

          <Pressable
            className="mt-6 items-center rounded-full bg-ink py-4 active:opacity-80 dark:bg-white"
            onPress={onSubmit}
          >
            <Text className="text-base font-semibold text-white dark:text-ink">
              Record payment
            </Text>
          </Pressable>
        </>
      ) : (
        <Text className="mt-2 text-center text-sm text-gray-400">
          Pick who you're settling with to continue.
        </Text>
      )}

      {/* Cash handovers are deliberately NOT settle-ups (free direction) —
          they live on their own screen. Same replace pattern as join/scan. */}
      <Pressable
        className="mt-5 items-center py-2"
        onPress={() => router.replace(`/groups/${groupId}/loan`)}
      >
        <Text className="text-sm font-semibold text-ledger">
          Handed over cash instead? Record a loan
        </Text>
      </Pressable>
    </ScrollView>
  );
}
