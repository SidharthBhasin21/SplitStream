import { asCategory, type Category } from "./categories";
import type { Expense } from "./types";

/**
 * Pure aggregations behind the stats screen (v1.1). Like lib/balances.ts:
 * no I/O, unit tested, fed from the same cached expense list the group
 * screen already holds — so the charts update live too.
 */

export interface CategorySpend {
  category: Category;
  total: number;
}

/** Total spend per category, largest first, zero-spend categories omitted. */
export function spendByCategory(
  expenses: Pick<Expense, "amount" | "category">[],
): CategorySpend[] {
  const totals = new Map<Category, number>();
  for (const e of expenses) {
    const cat = asCategory(e.category);
    totals.set(cat, (totals.get(cat) ?? 0) + e.amount);
  }
  return [...totals.entries()]
    .map(([category, total]) => ({
      category,
      total: Math.round(total * 100) / 100,
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
}

export interface MonthSpend {
  /** e.g. "Jul" — label of the month bucket */
  label: string;
  /** "2026-07" — sortable key, also used as the React list key */
  key: string;
  total: number;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Total spend for each of the last `months` calendar months (oldest first),
 * including empty months so the chart's time axis has no gaps. `now` is a
 * parameter so tests are deterministic.
 */
export function spendByMonth(
  expenses: Pick<Expense, "amount" | "created_at">[],
  months = 6,
  now: Date = new Date(),
): MonthSpend[] {
  const buckets: MonthSpend[] = [];
  const byKey = new Map<string, MonthSpend>();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = { key, label: MONTH_LABELS[d.getMonth()], total: 0 };
    buckets.push(bucket);
    byKey.set(key, bucket);
  }

  for (const e of expenses) {
    const d = new Date(e.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.total += e.amount; // older than the window: ignored
  }

  for (const b of buckets) b.total = Math.round(b.total * 100) / 100;
  return buckets;
}
