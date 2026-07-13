import type { Expense } from "./types";

/**
 * Pure balance calculation (PRD 5.5). No I/O, no state — given the expense
 * list and the group's member ids, returns each member's net position:
 *   positive = the group owes them money, negative = they owe the group.
 *
 * v1 is equal-split only: every expense is shared evenly by ALL current
 * members, and the payer is credited the full amount. Net = paid − share.
 * Balances always sum to (approximately) zero by construction.
 *
 * Money math note: amounts are floats (numeric(10,2) over JSON), so shares
 * like 100/3 produce repeating decimals. We accumulate at full float
 * precision and round once at the end, which keeps per-member error under
 * half a paisa regardless of how many expenses there are. Because each
 * member is rounded independently, the rounded balances could drift a paisa
 * or two off zero-sum — so the residual is assigned to the member with the
 * largest balance (largest-remainder method), where one paisa is
 * proportionally least visible. The zero-sum invariant is therefore exact.
 */
export function computeBalances(
  expenses: Pick<Expense, "amount" | "paid_by">[],
  memberIds: string[],
): Record<string, number> {
  const net: Record<string, number> = {};
  for (const id of memberIds) net[id] = 0;
  if (memberIds.length === 0) return net;

  for (const expense of expenses) {
    // Defensive: a payer no longer in the member list (shouldn't happen in
    // v1 — there's no "leave group") still gets credited rather than dropped.
    if (expense.paid_by !== null && !(expense.paid_by in net)) {
      net[expense.paid_by] = 0;
    }
    if (expense.paid_by !== null) {
      net[expense.paid_by] += expense.amount;
    }
    const share = expense.amount / memberIds.length;
    for (const id of memberIds) {
      net[id] -= share;
    }
  }

  // Round to whole paise, tracking the residual the rounding introduces.
  const ids = Object.keys(net);
  let sumPaise = 0;
  for (const id of ids) {
    net[id] = Math.round(net[id] * 100) / 100;
    sumPaise += Math.round(net[id] * 100);
  }

  // Force exact zero-sum: park the residual paise on the largest balance.
  if (sumPaise !== 0 && ids.length > 0) {
    let target = ids[0];
    for (const id of ids) {
      if (Math.abs(net[id]) > Math.abs(net[target])) target = id;
    }
    net[target] = (Math.round(net[target] * 100) - sumPaise) / 100;
  }

  return net;
}

/** "₹1,234.50" — always two decimals, Indian digit grouping. */
export function formatINR(amount: number): string {
  return `₹${Math.abs(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
