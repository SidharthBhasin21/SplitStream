import { useQuery } from "@tanstack/react-query";

/**
 * Live exchange rates for the Groups list' cross-group "Your balance"
 * total (v1.3). This is the ONLY place Lumenz converts between
 * currencies — per-group balances and settle-up always stay in that
 * group's own currency (see lib/currency.ts), so a rate hiccup here can
 * never corrupt what anyone actually owes.
 *
 * Uses open.er-api.com: free, no API key, updated ~daily. Rates are cached
 * for an hour (staleTime) since they don't move fast enough to justify
 * refetching every screen focus, and the summary is explicitly an
 * approximation, not a settlement figure.
 */

interface RatesResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
}

export function useExchangeRates(baseCurrency: string) {
  return useQuery({
    queryKey: ["exchange-rates", baseCurrency],
    queryFn: async (): Promise<Record<string, number>> => {
      const res = await fetch(
        `https://open.er-api.com/v6/latest/${baseCurrency}`,
      );
      if (!res.ok) throw new Error("Failed to fetch exchange rates");
      const data: RatesResponse = await res.json();
      if (data.result !== "success") {
        throw new Error("Exchange rate provider returned an error");
      }
      return data.rates;
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // keep yesterday's rates around as a fallback
    retry: 1,
  });
}

/**
 * Convert `amount` from `fromCurrency` into the rates' base currency.
 * `rates` maps CODE -> (1 base unit = N of that currency), so converting
 * back to base is a division. Returns null if we don't have a rate for it
 * (offline, or a currency the provider doesn't cover) — callers should
 * treat that group as "can't convert" rather than silently using 1:1.
 */
export function convertToBase(
  amount: number,
  fromCurrency: string,
  rates: Record<string, number> | undefined,
): number | null {
  if (!rates) return null;
  const rate = rates[fromCurrency];
  if (!rate) return null;
  return amount / rate;
}
