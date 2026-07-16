import { spendByCategory, spendByMonth } from "../stats";

describe("spendByCategory", () => {
  it("sums per category, largest first, omitting empty categories", () => {
    const result = spendByCategory([
      { amount: 100, category: "food" },
      { amount: 250, category: "travel" },
      { amount: 50, category: "food" },
    ]);
    expect(result).toEqual([
      { category: "travel", total: 250 },
      { category: "food", total: 150 },
    ]);
  });

  it("maps unknown/legacy categories to 'other'", () => {
    expect(spendByCategory([{ amount: 10, category: "helicopters" }])).toEqual([
      { category: "other", total: 10 },
    ]);
  });

  it("returns [] for no expenses", () => {
    expect(spendByCategory([])).toEqual([]);
  });
});

describe("spendByMonth", () => {
  const now = new Date(2026, 6, 15); // 15 Jul 2026

  it("buckets into the last N months, oldest first, empty months included", () => {
    const result = spendByMonth(
      [
        { amount: 100, created_at: "2026-07-01T10:00:00Z" },
        { amount: 40, created_at: "2026-07-20T10:00:00Z" },
        { amount: 75, created_at: "2026-05-03T10:00:00Z" },
      ],
      3,
      now,
    );
    expect(result).toEqual([
      { key: "2026-05", label: "May", total: 75 },
      { key: "2026-06", label: "Jun", total: 0 },
      { key: "2026-07", label: "Jul", total: 140 },
    ]);
  });

  it("ignores expenses older than the window", () => {
    const result = spendByMonth(
      [{ amount: 999, created_at: "2025-01-01T00:00:00Z" }],
      3,
      now,
    );
    expect(result.every((m) => m.total === 0)).toBe(true);
  });

  it("spans a year boundary correctly", () => {
    const result = spendByMonth(
      [{ amount: 10, created_at: "2025-12-25T00:00:00Z" }],
      3,
      new Date(2026, 0, 15), // Jan 2026 → window Nov/Dec 2025, Jan 2026
    );
    expect(result.map((m) => m.label)).toEqual(["Nov", "Dec", "Jan"]);
    expect(result[1].total).toBe(10);
  });
});
