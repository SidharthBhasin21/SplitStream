import { computeBalances, formatINR } from "../balances";

const A = "user-a";
const B = "user-b";
const C = "user-c";

function expense(amount: number, paid_by: string | null) {
  return { amount, paid_by };
}

describe("computeBalances", () => {
  it("returns zeros for a group with no expenses", () => {
    expect(computeBalances([], [A, B])).toEqual({ [A]: 0, [B]: 0 });
  });

  it("returns an empty record for no members", () => {
    expect(computeBalances([expense(100, A)], [])).toEqual({});
  });

  it("splits a single expense equally", () => {
    // A pays 300 for A+B+C: A's share is 100, so A is owed 200.
    expect(computeBalances([expense(300, A)], [A, B, C])).toEqual({
      [A]: 200,
      [B]: -100,
      [C]: -100,
    });
  });

  it("nets multiple expenses against each other", () => {
    // A pays 300, B pays 150, C pays nothing (total 450, share 150 each).
    const balances = computeBalances(
      [expense(300, A), expense(150, B)],
      [A, B, C],
    );
    expect(balances).toEqual({ [A]: 150, [B]: 0, [C]: -150 });
  });

  it("balances sum to exactly zero even when rounding is awkward", () => {
    const balances = computeBalances(
      [expense(100, A), expense(33.33, B), expense(0.01, C), expense(99.99, A)],
      [A, B, C],
    );
    const totalPaise = Object.values(balances).reduce(
      (s, v) => s + Math.round(v * 100),
      0,
    );
    expect(totalPaise).toBe(0);
  });

  it("handles indivisible amounts without accumulating float error", () => {
    // 100 / 3 = 33.333... — repeated many times to stress accumulation.
    // A's true net is 66666.67; the rounding residual (1 paisa) lands on A
    // as the largest balance, keeping the group at exactly zero.
    const expenses = Array.from({ length: 1000 }, () => expense(100, A));
    const balances = computeBalances(expenses, [A, B, C]);
    expect(balances[A]).toBe(66666.66);
    expect(balances[B]).toBe(-33333.33);
    expect(balances[C]).toBe(-33333.33);
  });

  it("ignores the payer credit for null paid_by but still splits the cost", () => {
    expect(computeBalances([expense(90, null)], [A, B, C])).toEqual({
      [A]: -30,
      [B]: -30,
      [C]: -30,
    });
  });

  it("credits a payer who is not in the member list (defensive)", () => {
    const balances = computeBalances([expense(100, C)], [A, B]);
    expect(balances).toEqual({ [A]: -50, [B]: -50, [C]: 100 });
  });

  it("treats a member with no expenses as owing their share", () => {
    const balances = computeBalances([expense(50, A)], [A, B]);
    expect(balances[B]).toBe(-25);
  });
});

describe("formatINR", () => {
  it("formats with two decimals and Indian grouping", () => {
    expect(formatINR(1234567.5)).toBe("₹12,34,567.50");
    expect(formatINR(0)).toBe("₹0.00");
  });

  it("uses the absolute value (sign is conveyed by the UI label)", () => {
    expect(formatINR(-99.9)).toBe("₹99.90");
  });
});
