import {
  fetchPortfolio,
  type DisplayCurrency,
  type HoldingSeries,
  type PortfolioInterval,
} from "../PortfolioLineChart/data";

export const MAX_TICKERS = 4;

export type TickerInput = { symbol?: string; label?: string; color?: string };

export type CompareData = {
  interval: PortfolioInterval;
  currency: DisplayCurrency;
  /** What went into each ticker on the first date, display currency. */
  amount: number;
  dates: string[];
  /**
   * One per ticker, in props order — the first is the pick, the rest are
   * what it is measured against. `quantity` is the shares `amount` bought on
   * the first date; `values` is what they are worth on each date.
   */
  series: HoldingSeries[];
};

/**
 * The same stake in every ticker on the same day. Rides on `fetchPortfolio`
 * for the calendar, forward-fill and FX — one share of each — then rescales
 * each line so it opens at `amount`.
 */
export async function fetchComparison(
  inputs: TickerInput[],
  opts: {
    amount: number;
    startDate: string;
    interval: PortfolioInterval;
    currency: DisplayCurrency;
    usdHkd: number;
  },
): Promise<CompareData> {
  if (!(opts.amount > 0)) {
    throw new Error("amount must be greater than zero.");
  }
  const data = await fetchPortfolio(
    inputs.slice(0, MAX_TICKERS).map((t) => ({ ...t, quantity: 1 })),
    opts,
  );
  if (data.holdings.length < 2) {
    throw new Error("Add at least two different tickers to compare.");
  }
  return {
    interval: data.interval,
    currency: data.currency,
    amount: opts.amount,
    dates: data.dates,
    series: data.holdings.map((h) => {
      const shares = opts.amount / h.values[0];
      return {
        ...h,
        quantity: shares,
        values: h.values.map((v) => v * shares),
      };
    }),
  };
}
