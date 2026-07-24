/**
 * Currency support (v1.3). Scoped PER GROUP — every expense/settlement in a
 * group is denominated in that group's currency (see supabase/phase9.sql),
 * so lib/balances.ts never needs to know about currency at all: it only
 * ever sums numbers that are already in the same unit.
 *
 * Cross-group aggregation (the Groups list "Your balance" total) is the one
 * place amounts from different currencies meet — that conversion lives in
 * lib/exchangeRates.ts, kept separate from this formatting-only module.
 */

export interface CurrencyMeta {
  code: string;
  symbol: string;
  name: string;
  /** BCP 47 locale used for digit grouping, e.g. "en-IN" gives 12,34,567. */
  locale: string;
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "en-IE" },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", locale: "zh-CN" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", locale: "ar-AE" },
  { code: "THB", symbol: "฿", name: "Thai Baht", locale: "th-TH" },
  { code: "NPR", symbol: "₨", name: "Nepalese Rupee", locale: "ne-NP" },
];

const BY_CODE: Record<string, CurrencyMeta> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c]),
);

/** Falls back to INR for legacy rows or an unrecognized code. */
export function currencyMeta(code: string | null | undefined): CurrencyMeta {
  return (code && BY_CODE[code]) || BY_CODE.INR;
}

/** JPY has no minor unit — "¥500", not "¥500.00". Everything else does. */
function decimalsFor(code: string): number {
  return code === "JPY" ? 0 : 2;
}

/** "₹1,234.50" / "$1,234.50" / "¥500" — symbol + locale-correct grouping. */
export function formatMoney(amount: number, currencyCode: string): string {
  const meta = currencyMeta(currencyCode);
  const decimals = decimalsFor(meta.code);
  return `${meta.symbol}${Math.abs(amount).toLocaleString(meta.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}
