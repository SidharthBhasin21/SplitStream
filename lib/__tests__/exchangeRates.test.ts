import { convertToBase } from "../exchangeRates";

describe("convertToBase", () => {
  // rates are "1 base unit = N of that currency" (as the API returns them),
  // e.g. base=INR, 1 INR = 0.012 USD.
  const rates = { INR: 1, USD: 0.012, EUR: 0.011 };

  it("converts a non-base currency into the base currency", () => {
    // 12 USD at 0.012 USD/INR => 1000 INR
    expect(convertToBase(12, "USD", rates)).toBeCloseTo(1000, 5);
  });

  it("returns the same amount when already in the base currency", () => {
    expect(convertToBase(500, "INR", rates)).toBe(500);
  });

  it("returns null when rates haven't loaded yet", () => {
    expect(convertToBase(100, "USD", undefined)).toBeNull();
  });

  it("returns null for a currency the provider doesn't cover", () => {
    expect(convertToBase(100, "ZZZ", rates)).toBeNull();
  });
});
