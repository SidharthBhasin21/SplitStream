import type { Expense, Settlement } from "./types";

/** The slice of a settlement the balance math needs. */
export type SettlementLike = Pick<Settlement, "amount" | "from_user" | "to_user">;

/** The slice of an expense the balance math needs. `split_among` is
 *  optional here (not just nullable) so existing callers/tests that predate
 *  partial splits — always "everyone" — still type-check unchanged. */
export type ExpenseLike = Pick<Expense, "amount" | "paid_by"> & {
  split_among?: string[] | null;
};

/** The participants of an expense: its own split list if set, else every
 *  current member (the pre-v1.4 default, and the fallback for null/[]). */
function participantsOf(expense: ExpenseLike, memberIds: string[]): string[] {
  return expense.split_among && expense.split_among.length > 0
    ? expense.split_among
    : memberIds;
}

/**
 * Pure balance calculation (PRD 5.5). No I/O, no state — given the expense
 * list and the group's member ids, returns each member's net position:
 *   positive = the group owes them money, negative = they owe the group.
 *
 * v1 is equal-split only: every expense is shared evenly by ALL current
 * members, and the payer is credited the full amount. Net = paid − share.
 * Balances always sum to (approximately) zero by construction.
 *
 * v1.4 narrows "all current members" to a per-expense participant list
 * (`split_among`) — e.g. 3 of a 5-person trip group went to a dinner. The
 * share is amount / participants.length, and only participants are debited;
 * everyone else's balance is untouched by that expense. A null/empty list
 * (every expense before v1.4, or one nobody edited) still means everyone.
 *
 * Settlements (v1.2) shift money directly between two members: the payer's
 * net RISES by the amount (their debt shrinks / credit grows) and the
 * receiver's net FALLS (they've been paid back). A partial payment is just
 * a smaller shift — nothing else changes. Settlements always sum to zero
 * pairwise, so the zero-sum invariant is untouched.
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
  expenses: ExpenseLike[],
  memberIds: string[],
  settlements: SettlementLike[] = [],
): Record<string, number> {
  const net: Record<string, number> = {};
  for (const id of memberIds) net[id] = 0;
  if (memberIds.length === 0) return net;

  for (const expense of expenses) {
    // An expense with no payer can't move money between members — skip it.
    // (Can't happen through the v1 UI; defensive against bad data.)
    if (expense.paid_by === null) continue;

    // Defensive: a payer no longer in the member list (shouldn't happen in
    // v1 — there's no "leave group") still gets credited rather than dropped.
    if (!(expense.paid_by in net)) {
      net[expense.paid_by] = 0;
    }
    net[expense.paid_by] += expense.amount;

    const participants = participantsOf(expense, memberIds);
    const share = expense.amount / participants.length;
    for (const id of participants) {
      // Same defensive-key rationale as the payer above — a participant who
      // has since left the member list still gets debited, not dropped.
      if (!(id in net)) net[id] = 0;
      net[id] -= share;
    }
  }

  for (const s of settlements) {
    // Defensive key creation, same as for unknown payers above.
    if (!(s.from_user in net)) net[s.from_user] = 0;
    if (!(s.to_user in net)) net[s.to_user] = 0;
    net[s.from_user] += s.amount;
    net[s.to_user] -= s.amount;
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

/**
 * The current user's net position in one group, from that group's expenses
 * and member count alone (the groups LIST doesn't load full member rows,
 * only counts — see useGroupExpenseSummaries). Same semantics as
 * computeBalances: payer is credited in full, participants owe amount/n,
 * null-payer rows are skipped. `memberCount` is only the fallback divisor
 * for expenses with no explicit `split_among` (still "everyone"); for a
 * partial split we don't need the full member list — just whether I'm one
 * of the named participants.
 */
export function computeMyNet(
  expenses: ExpenseLike[],
  memberCount: number,
  userId: string,
  settlements: SettlementLike[] = [],
): number {
  if (memberCount <= 0) return 0;
  let net = 0;
  for (const expense of expenses) {
    if (expense.paid_by === null) continue;
    if (expense.paid_by === userId) net += expense.amount;

    const participants = expense.split_among;
    const isEveryone = !participants || participants.length === 0;
    const n = isEveryone ? memberCount : participants.length;
    const amIIn = isEveryone || participants.includes(userId);
    if (amIIn) net -= expense.amount / n;
  }
  for (const s of settlements) {
    if (s.from_user === userId) net += s.amount;
    if (s.to_user === userId) net -= s.amount;
  }
  return Math.round(net * 100) / 100;
}
