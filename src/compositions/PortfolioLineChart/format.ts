import { Easing, interpolate } from "remotion";
import type { SeriesPoint } from "../../data/longbridge";
import type { DisplayCurrency } from "./data";

// Formatting and small motion helpers shared by PortfolioLineChart and
// CompareLineChart.

export const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const fadeUp = (frame: number, at: number, len = 26) => ({
  opacity: interpolate(frame, [at, at + len], [0, 1], CLAMP),
  transform: `translateY(${interpolate(frame, [at, at + len], [26, 0], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  })}px)`,
});

export const PREFIX: Record<DisplayCurrency, string> = { USD: "$", HKD: "HK$" };

export const money = (v: number, currency: DisplayCurrency) => {
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 0 : 2;
  return `${PREFIX[currency]}${abs.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
};

/** `+12.3%`; past 1,000% the decimal is noise, so it goes. */
export const percent = (p: number) => {
  const abs = Math.abs(p);
  const digits = abs >= 1000 ? 0 : 1;
  return `${p >= 0 ? "+" : "−"}${abs.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
};

export const quantity = (q: number) =>
  q.toLocaleString("en-US", { maximumFractionDigits: 4 });

/** Round tick values spanning a domain, plus the step they sit on. */
export function yTicks(min: number, max: number, target = 5) {
  const raw = (max - min) / Math.max(1, target - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  return { ticks, step };
}

/** `$12.5K` — decimals follow the tick step, so neighbours never read alike. */
export function axisMoney(
  v: number,
  step: number,
  max: number,
  cur: DisplayCurrency,
) {
  const [unit, suffix] =
    max >= 1e6 ? [1e6, "M"] : max >= 1e4 ? [1e3, "K"] : [1, ""];
  const decimals = Math.min(
    3,
    Math.max(0, Math.ceil(-Math.log10(step / unit))),
  );
  return `${PREFIX[cur]}${(v / unit).toFixed(decimals)}${suffix}`;
}

export const toPoints = (
  dates: string[],
  values: number[],
  closes: number[],
): SeriesPoint[] =>
  dates.map((period, i) => ({
    period,
    close: closes[i],
    normalized: values[i],
    volume: 0,
  }));
