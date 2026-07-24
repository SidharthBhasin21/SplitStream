import { currencyMeta, formatMoney } from "../currency";

describe("currencyMeta", () => {
  it("finds a known currency", () => {
    expect(currencyMeta("USD").symbol).toBe("$");
  });

  it("falls back to INR for null/unknown codes", () => {
    expect(currencyMeta(null).code).toBe("INR");
    expect(currencyMeta(undefined).code).toBe("INR");
    expect(currencyMeta("XYZ").code).toBe("INR");
  });
});

describe("formatMoney", () => {
  it("formats with two decimals and locale grouping by default", () => {
    expect(formatMoney(1234.5, "INR")).toBe("₹1,234.50");
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
  });

  it("uses Indian digit grouping (lakh/crore) for INR", () => {
    expect(formatMoney(1234567.5, "INR")).toBe("₹12,34,567.50");
    expect(formatMoney(0, "INR")).toBe("₹0.00");
  });

  it("uses the absolute value (sign is conveyed by the caller)", () => {
    expect(formatMoney(-99.9, "USD")).toBe("$99.90");
  });

  it("JPY has no minor unit", () => {
    expect(formatMoney(500, "JPY")).toBe("¥500");
    expect(formatMoney(500.4, "JPY")).toBe("¥500");
  });

  it("unknown currency code falls back to INR formatting", () => {
    expect(formatMoney(10, "ZZZ")).toBe("₹10.00");
  });
});
