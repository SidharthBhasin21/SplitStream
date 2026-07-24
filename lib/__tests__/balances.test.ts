import { computeBalances, computeMyNet } from "../balances";

const A = "user-a";
const B = "user-b";
const C = "user-c";

function expense(
  amount: number,
  paid_by: string | null,
  split_among?: string[] | null,
) {
  return { amount, paid_by, split_among };
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

  it("skips expenses with no payer — they can't move money between members", () => {
    expect(computeBalances([expense(90, null)], [A, B, C])).toEqual({
      [A]: 0,
      [B]: 0,
      [C]: 0,
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

describe("computeBalances with partial splits (v1.4)", () => {
  it("only debits the named participants, not the whole group", () => {
    // A pays 90 for dinner with just A+B (C wasn't there): 45 each.
    const balances = computeBalances(
      [expense(90, A, [A, B])],
      [A, B, C],
    );
    expect(balances).toEqual({ [A]: 45, [B]: -45, [C]: 0 });
  });

  it("treats a null split_among the same as everyone (backward compatible)", () => {
    expect(computeBalances([expense(300, A, null)], [A, B, C])).toEqual(
      computeBalances([expense(300, A)], [A, B, C]),
    );
  });

  it("treats an empty split_among array the same as everyone", () => {
    expect(computeBalances([expense(300, A, [])], [A, B, C])).toEqual(
      computeBalances([expense(300, A)], [A, B, C]),
    );
  });

  it("still credits the payer in full even if they didn't participate", () => {
    // A fronts the bill for B+C only — A gets the whole 100 back.
    const balances = computeBalances([expense(100, A, [B, C])], [A, B, C]);
    expect(balances).toEqual({ [A]: 100, [B]: -50, [C]: -50 });
  });

  it("keeps exact zero-sum across mixed full and partial splits", () => {
    const balances = computeBalances(
      [expense(300, A), expense(90, B, [B, C]), expense(11.11, C, [A, C])],
      [A, B, C],
    );
    const totalPaise = Object.values(balances).reduce(
      (s, v) => s + Math.round(v * 100),
      0,
    );
    expect(totalPaise).toBe(0);
  });
});

function settlement(amount: number, from_user: string, to_user: string) {
  return { amount, from_user, to_user };
}

describe("computeBalances with settlements", () => {
  it("a full settlement zeroes both parties out", () => {
    // A paid 100 for A+B → B owes A 50. B pays A 50 → settled.
    const balances = computeBalances(
      [expense(100, A)],
      [A, B],
      [settlement(50, B, A)],
    );
    expect(balances).toEqual({ [A]: 0, [B]: 0 });
  });

  it("a PARTIAL settlement shifts exactly the paid amount", () => {
    // B owes A 50, pays back only 20 → still owes 30.
    const balances = computeBalances(
      [expense(100, A)],
      [A, B],
      [settlement(20, B, A)],
    );
    expect(balances).toEqual({ [A]: 30, [B]: -30 });
  });

  it("settlements preserve exact zero-sum", () => {
    const balances = computeBalances(
      [expense(100, A), expense(33.33, B)],
      [A, B, C],
      [settlement(11.11, C, A), settlement(5, B, C)],
    );
    const totalPaise = Object.values(balances).reduce(
      (s, v) => s + Math.round(v * 100),
      0,
    );
    expect(totalPaise).toBe(0);
  });

  it("works with settlements and no expenses (recording an old debt)", () => {
    expect(computeBalances([], [A, B], [settlement(75, A, B)])).toEqual({
      [A]: 75,
      [B]: -75,
    });
  });
});

describe("computeMyNet", () => {
  it("credits me in full and debits my share when I pay", () => {
    expect(computeMyNet([expense(100, A)], 2, A)).toBe(50);
  });

  it("debits only my share when someone else pays", () => {
    expect(computeMyNet([expense(100, B)], 2, A)).toBe(-50);
  });

  it("nets multiple expenses and matches computeBalances", () => {
    const expenses = [expense(300, A), expense(150, B)];
    const viaFull = computeBalances(expenses, [A, B, C])[A];
    expect(computeMyNet(expenses, 3, A)).toBe(viaFull);
  });

  it("skips null payers and handles zero members", () => {
    expect(computeMyNet([expense(90, null)], 3, A)).toBe(0);
    expect(computeMyNet([expense(90, A)], 0, A)).toBe(0);
  });

  it("applies settlements involving me and ignores others'", () => {
    // I paid 100 (net +50), then B settles 20 back to me (net +30)…
    expect(
      computeMyNet([expense(100, A)], 2, A, [settlement(20, B, A)]),
    ).toBe(30);
    // …while a settlement purely between B and C doesn't touch my net.
    expect(computeMyNet([], 3, A, [settlement(40, B, C)])).toBe(0);
  });

  it("ignores an expense I wasn't part of (v1.4 partial split)", () => {
    // B pays 90 for a dinner with just B+C — doesn't touch my balance at all.
    expect(computeMyNet([expense(90, B, [B, C])], 3, A)).toBe(0);
  });

  it("still credits me in full as payer even when I opted out of the split", () => {
    expect(computeMyNet([expense(100, A, [B, C])], 3, A)).toBe(100);
  });

  it("matches computeBalances for a partial split", () => {
    const expenses = [expense(90, A, [A, B])];
    const viaFull = computeBalances(expenses, [A, B, C])[A];
    expect(computeMyNet(expenses, 3, A)).toBe(viaFull);
  });
});
