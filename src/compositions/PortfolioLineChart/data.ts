import { fetchLongbridgeSeries } from "../../data/longbridge";

export type DisplayCurrency = "USD" | "HKD";

export type HoldingInput = {
  symbol?: string;
  quantity?: number;
  label?: string;
  color?: string;
};

export type HoldingSeries = {
  symbol: string;
  label: string;
  /** Blank unless set on the props — the component then picks per theme. */
  color: string;
  quantity: number;
  /** Listing currency — what `closes` is quoted in. */
  currency: DisplayCurrency;
  /** Close per date, listing currency. */
  closes: number[];
  /** quantity × close per date, display currency. */
  values: number[];
};

export type PortfolioInterval = "day" | "month";

export type PortfolioData = {
  interval: PortfolioInterval;
  currency: DisplayCurrency;
  /** `YYYY-MM-DD` (daily) or `YYYY-MM` (monthly), ascending. Every array below is aligned to this. */
  dates: string[];
  totals: number[];
  holdings: HoldingSeries[];
};

/** `nvda` → `NVDA.US`, `700` → `700.HK`; anything already suffixed is kept. */
export function normalizeSymbol(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (/\.[A-Z]{2}$/.test(s)) return s;
  return /^\d+$/.test(s) ? `${s}.HK` : `${s}.US`;
}

function currencyOf(symbol: string): DisplayCurrency {
  if (symbol.endsWith(".HK")) return "HKD";
  if (symbol.endsWith(".US")) return "USD";
  throw new Error(
    `${symbol}: only .US and .HK listings are supported — there is no FX ` +
      `rate here for any other market.`,
  );
}

const fxRate = (from: DisplayCurrency, to: DisplayCurrency, usdHkd: number) =>
  from === to ? 1 : from === "USD" ? usdHkd : 1 / usdHkd;

/**
 * Studio re-runs `calculateMetadata` on every prop edit — it cannot know that
 * `theme` or `title` has nothing to do with the fetch. Bars are therefore kept
 * per symbol and window, so only a change that needs new prices (a new
 * symbol, start date or interval) reaches Longbridge. `today` is in the key,
 * so a session left open overnight picks up the new day.
 */
const barCache = new Map<string, ReturnType<typeof fetchLongbridgeSeries>>();

function cachedBars(
  symbol: string,
  interval: PortfolioInterval,
  from: string,
  to: string,
) {
  const key = [symbol, interval, from, to].join("|");
  let hit = barCache.get(key);
  if (!hit) {
    hit = fetchLongbridgeSeries(symbol, interval, from, to);
    barCache.set(key, hit);
    // A failed request must not be remembered as the answer.
    hit.catch(() => barCache.delete(key));
  }
  return hit;
}

export async function fetchPortfolio(
  inputs: HoldingInput[],
  opts: {
    startDate: string;
    interval: PortfolioInterval;
    currency: DisplayCurrency;
    usdHkd: number;
  },
): Promise<PortfolioData> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.startDate)) {
    throw new Error(`startDate must be YYYY-MM-DD, got "${opts.startDate}".`);
  }
  const today = new Date().toISOString().slice(0, 10);
  if (opts.startDate >= today) {
    throw new Error(`startDate ${opts.startDate} is not in the past.`);
  }

  // A monthly bar is stamped on the 1st, so a mid-month start would drop its
  // own month; keys shorten to `YYYY-MM` to match.
  const monthly = opts.interval === "month";
  const keyLen = monthly ? 7 : 10;
  const from = monthly ? `${opts.startDate.slice(0, 7)}-01` : opts.startDate;
  const fromKey = from.slice(0, keyLen);

  // The same symbol entered twice is one position.
  const merged = new Map<string, Required<HoldingInput>>();
  for (const h of inputs) {
    const qty = Number(h.quantity);
    if (!h.symbol?.trim() || !Number.isFinite(qty) || qty <= 0) continue;
    const symbol = normalizeSymbol(h.symbol);
    const prev = merged.get(symbol);
    merged.set(symbol, {
      symbol,
      quantity: (prev?.quantity ?? 0) + qty,
      label:
        h.label?.trim() || prev?.label || symbol.replace(/\.[A-Z]{2}$/, ""),
      color: h.color?.trim() || prev?.color || "",
    });
  }
  const positions = [...merged.values()];
  if (!positions.length) {
    throw new Error("Add at least one holding with a symbol and a quantity.");
  }

  const closeMaps = await Promise.all(
    positions.map(async (p) => {
      const bars = await cachedBars(p.symbol, opts.interval, from, today);
      const byDate = new Map<string, number>();
      for (const b of bars) {
        const d = new Date(b.t).toISOString().slice(0, keyLen);
        if (d >= fromKey) byDate.set(d, b.c);
      }
      if (!byDate.size) {
        throw new Error(
          `${p.symbol}: no ${monthly ? "monthly" : "daily"} bars since ${opts.startDate}. Check the symbol.`,
        );
      }
      return byDate;
    }),
  );

  // HK and US keep different holidays, so the calendar is the union of both
  // and a closed market carries its last close forward — the position is
  // still worth that on the day. The window opens on the first date every
  // holding has a price, so nothing is valued at zero before it listed.
  const firstDates = closeMaps.map((m) => [...m.keys()].sort()[0]);
  const windowStart = firstDates.reduce((a, b) => (a > b ? a : b));
  const dates = [...new Set(closeMaps.flatMap((m) => [...m.keys()]))]
    .filter((d) => d >= windowStart)
    .sort();
  if (dates.length < 2) {
    throw new Error(
      `Fewer than two ${monthly ? "months" : "trading days"} between ${opts.startDate} and today.`,
    );
  }

  const holdings: HoldingSeries[] = positions.map((p, i) => {
    const currency = currencyOf(p.symbol);
    const rate = fxRate(currency, opts.currency, opts.usdHkd);
    const byDate = closeMaps[i];
    let last = byDate.get(firstDates[i])!;
    const closes = dates.map((d) => (last = byDate.get(d) ?? last));
    return {
      symbol: p.symbol,
      label: p.label,
      color: p.color,
      quantity: p.quantity,
      currency,
      closes,
      values: closes.map((c) => c * p.quantity * rate),
    };
  });

  const totals = dates.map((_, di) =>
    holdings.reduce((sum, h) => sum + h.values[di], 0),
  );

  return {
    interval: opts.interval,
    currency: opts.currency,
    dates,
    totals,
    holdings,
  };
}
