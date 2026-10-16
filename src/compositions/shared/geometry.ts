import type { SeriesPoint } from "../../data/longbridge";

export type Box = { x: number; y: number; w: number; h: number };

/**
 * Round a raw domain out to human tick values. A $100 stake makes 100 the
 * line that matters — break-even — so it is always forced into the ticks
 * even when the domain would otherwise skip past it.
 */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return [0, 50, 100, 150, 200];
  }
  const raw = (max - min) / Math.max(1, target - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;

  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 0.5; v += step) {
    ticks.push(Number(v.toFixed(6)));
  }
  if (
    min <= 100 &&
    max >= 100 &&
    !ticks.some((t) => Math.abs(t - 100) < 1e-6)
  ) {
    ticks.push(100);
    ticks.sort((a, b) => a - b);
  }
  return ticks;
}

/** Pad a domain so the extremes don't graze the plot edges. */
export function paddedDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 200];
  const span = Math.max(1e-6, max - min);
  return [min - span * 0.12, max + span * 0.12];
}

export function makeScales(box: Box, count: number, domain: [number, number]) {
  const [d0, d1] = domain;
  const span = Math.max(1e-6, d1 - d0);
  const xAt = (i: number) =>
    count <= 1 ? box.x : box.x + (i / (count - 1)) * box.w;
  const yAt = (v: number) => box.y + box.h - ((v - d0) / span) * box.h;
  return { xAt, yAt };
}

/** Polyline through every point — no smoothing, so spikes stay honest. */
export function linePath(
  points: SeriesPoint[],
  xAt: (i: number) => number,
  yAt: (v: number) => number,
): string {
  return points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${xAt(i).toFixed(2)},${yAt(p.normalized).toFixed(2)}`,
    )
    .join(" ");
}

/** The same line, closed down to the baseline, for the area wash. */
export function areaPath(
  points: SeriesPoint[],
  xAt: (i: number) => number,
  yAt: (v: number) => number,
  baseline: number,
): string {
  if (!points.length) return "";
  const last = xAt(points.length - 1).toFixed(2);
  const first = xAt(0).toFixed(2);
  return `${linePath(points, xAt, yAt)} L${last},${baseline.toFixed(2)} L${first},${baseline.toFixed(2)} Z`;
}

/** Evenly sample `n` indices across the series, always keeping both ends. */
export function sampleIndices(length: number, n: number): number[] {
  if (length <= n) return Array.from({ length }, (_, i) => i);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.round((i / (n - 1)) * (length - 1)));
  }
  return [...new Set(out)];
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** `2026-08` → `Aug 26`; `2026-08-14` → `14 Aug`. */
export function formatPeriod(period: string): string {
  const parts = period.split("-");
  const month = MONTHS[Number(parts[1]) - 1] ?? "";
  if (parts.length === 2) return `${month} ${parts[0].slice(2)}`;
  return `${Number(parts[2])} ${month}`;
}

/**
 * Value at a fractional index — lets the playhead sit between two trading
 * days instead of snapping, so the head dot moves smoothly at any speed.
 */
export function valueAt(points: SeriesPoint[], head: number): number {
  if (!points.length) return 0;
  const lo = Math.max(0, Math.min(points.length - 1, Math.floor(head)));
  const hi = Math.min(points.length - 1, lo + 1);
  const f = head - lo;
  return (
    points[lo].normalized + (points[hi].normalized - points[lo].normalized) * f
  );
}

export function closeAt(points: SeriesPoint[], head: number): number {
  if (!points.length) return 0;
  const i = Math.max(0, Math.min(points.length - 1, Math.round(head)));
  return points[i].close;
}

export function periodAt(points: SeriesPoint[], head: number): string {
  if (!points.length) return "";
  const i = Math.max(0, Math.min(points.length - 1, Math.round(head)));
  return points[i].period;
}

/** Points up to the playhead, with a synthesised point at the exact head. */
export function sliceToHead(
  points: SeriesPoint[],
  head: number,
): SeriesPoint[] {
  const whole = Math.floor(head);
  const out = points.slice(0, Math.max(1, whole + 1));
  if (whole >= 0 && whole < points.length - 1) {
    const v = valueAt(points, head);
    out.push({
      period: points[whole].period,
      close: points[whole].close,
      normalized: v,
      volume: points[whole].volume,
    });
  }
  return out;
}

/**
 * Vertical extent of everything visible between two fractional indices.
 *
 * Sampled a few steps back and averaged: a domain computed only from the
 * current window snaps whenever a spike enters or leaves the frame, which
 * reads as the chart flinching. Averaging trailing samples turns those steps
 * into a glide without needing state across frames.
 */
export function windowDomain(
  seriesPoints: SeriesPoint[][],
  lo: number,
  hi: number,
  samples = 6,
  lookback = 26,
): [number, number] {
  let minSum = 0;
  let maxSum = 0;
  for (let k = 0; k < samples; k++) {
    const shift = (k / samples) * lookback;
    const l = Math.max(0, lo - shift);
    const h = Math.max(l + 1, hi - shift);
    let mn = Infinity;
    let mx = -Infinity;
    for (const pts of seriesPoints) {
      const a = Math.max(0, Math.floor(l));
      const b = Math.min(pts.length - 1, Math.ceil(h));
      for (let i = a; i <= b; i++) {
        const v = pts[i]?.normalized;
        if (v == null) continue;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    if (!Number.isFinite(mn) || !Number.isFinite(mx)) {
      mn = 90;
      mx = 110;
    }
    minSum += mn;
    maxSum += mx;
  }
  const min = minSum / samples;
  const max = maxSum / samples;
  const span = Math.max(6, max - min);
  return [min - span * 0.18, max + span * 0.18];
}

/** Long form for the travel clock, where the year is the point: `4 Jun 2024`. */
export function formatFull(period: string): string {
  const parts = period.split("-");
  const month = MONTHS[Number(parts[1]) - 1] ?? "";
  if (parts.length === 2) return `${month} ${parts[0]}`;
  return `${Number(parts[2])} ${month} ${parts[0]}`;
}

/**
 * Axis label that adapts to how much time is on screen. Zoomed in, the day is
 * what matters (`4 Jun`). Zoomed out to five years, six ticks all land near
 * the same day-of-year and read as six identical labels — there the year is
 * the only part carrying information (`Jun 22`).
 */
export function formatAxis(period: string, visibleDays: number): string {
  const parts = period.split("-");
  const month = MONTHS[Number(parts[1]) - 1] ?? "";
  if (visibleDays > 200 || parts.length === 2) {
    return `${month} ${parts[0].slice(2)}`;
  }
  return `${Number(parts[2])} ${month}`;
}
