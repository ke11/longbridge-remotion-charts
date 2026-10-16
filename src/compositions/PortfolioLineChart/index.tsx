import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  interpolateColors,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  areaPath,
  closeAt,
  formatAxis,
  formatFull,
  makeScales,
  paddedDomain,
  periodAt,
  sliceToHead,
  valueAt,
  windowDomain,
  type Box,
} from "../shared/geometry";
import {
  axisMoney,
  CLAMP,
  fadeUp,
  money,
  percent,
  PREFIX,
  quantity,
  toPoints,
  yTicks,
} from "./format";
import type { PortfolioLineChartProps } from "./schema";
import { SplitBar } from "./SplitBar";
import { holdingColor, THEMES, TYPE } from "./theme";
import { portfolioTimeline, windowDays } from "./timeline";

const PLOT: Box = { x: 170, y: 424, w: 1630, h: 416 };
const MAX_CARDS = 8;

/**
 * The line as two paths: the stretches at or above `level`, and the ones
 * below it, cut exactly where it crosses.
 *
 * Clipping one stroke at the level instead looks the same until the line
 * runs *along* the level — then the cut goes down the middle of the stroke
 * and it renders half one colour, half the other.
 */
function splitLine(
  values: number[],
  level: number,
  xAt: (i: number) => number,
  yAt: (v: number) => number,
) {
  const d = { up: "", down: "" };
  const pen: Record<"up" | "down", string | null> = { up: null, down: null };
  const at = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;
  const seg = (side: "up" | "down", from: string, to: string) => {
    d[side] += `${pen[side] === from ? "" : `M${from}`} L${to}`;
    pen[side] = to;
  };
  const sideOf = (v: number) => (v >= level ? "up" : "down");

  for (let i = 1; i < values.length; i++) {
    const [a, b] = [values[i - 1], values[i]];
    const from = at(xAt(i - 1), yAt(a));
    const to = at(xAt(i), yAt(b));
    if (sideOf(a) === sideOf(b)) {
      seg(sideOf(a), from, to);
      continue;
    }
    const t = (level - a) / (b - a);
    const cross = at(xAt(i - 1) + (xAt(i) - xAt(i - 1)) * t, yAt(level));
    seg(sideOf(a), from, cross);
    seg(sideOf(b), cross, to);
  }
  return d;
}

export const PortfolioLineChart: React.FC<PortfolioLineChartProps> = ({
  style,
  config,
  data,
}) => {
  const frame = useCurrentFrame();
  const { title, logo, showAttribution } = style;
  const C = THEMES[style.theme] ?? THEMES.dark;
  const { fps } = useVideoConfig();

  const totalPts = useMemo(
    () => (data ? toPoints(data.dates, data.totals, data.totals) : []),
    [data],
  );
  const holdingPts = useMemo(
    () =>
      data
        ? data.holdings.map((h) => toPoints(data.dates, h.values, h.closes))
        : [],
    [data],
  );

  if (!data || totalPts.length < 2) {
    return (
      <AbsoluteFill
        style={{
          background: C.bg,
          color: C.inkMuted,
          ...TYPE.clock,
          fontSize: 40,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Waiting for Longbridge data…
      </AbsoluteFill>
    );
  }

  const { currency, totals, holdings, dates } = data;
  const themeName = style.theme === "light" ? "light" : "dark";
  const colors = holdings.map((h, hi) => holdingColor(h, hi, themeName));
  const logoSrc = logo?.trim()
    ? /^(https?:|data:)/.test(logo.trim())
      ? logo.trim()
      : staticFile(logo.trim())
    : null;
  const count = totals.length;
  const lastIdx = count - 1;
  const T = portfolioTimeline(
    count,
    fps,
    config.durationSeconds,
    data.interval,
  );
  const WINDOW = windowDays(count);

  // ── Camera ──────────────────────────────────────────────────
  // A zoomed window rides the playhead one
  // trading day at a time, then pulls back to the whole run.
  const travel = interpolate(frame, [T.TRAVEL_START, T.TRAVEL_END], [0, 1], {
    ...CLAMP,
    easing: Easing.inOut(Easing.quad),
  });
  const head = travel * lastIdx;

  const zoomOut = interpolate(
    frame,
    [T.ZOOM_OUT_START, T.ZOOM_OUT_START + T.ZOOM_OUT_LEN],
    [0, 1],
    { ...CLAMP, easing: Easing.inOut(Easing.cubic) },
  );

  const maxLo = Math.max(0, lastIdx - WINDOW);
  const winLo = Math.min(Math.max(head - WINDOW / 2, 0), maxLo);
  const viewLo = interpolate(zoomOut, [0, 1], [winLo, 0]);
  const viewHi = interpolate(zoomOut, [0, 1], [winLo + WINDOW, lastIdx]);
  const span = Math.max(1e-6, viewHi - viewLo);

  const zoomDomain = windowDomain(
    [totalPts],
    winLo,
    winLo + WINDOW,
    6,
    WINDOW / 3,
  );
  const fullDomain = paddedDomain(totals);
  const domain: [number, number] = [
    interpolate(zoomOut, [0, 1], [zoomDomain[0], fullDomain[0]]),
    interpolate(zoomOut, [0, 1], [zoomDomain[1], fullDomain[1]]),
  ];

  const xAt = (i: number) => PLOT.x + ((i - viewLo) / span) * PLOT.w;
  const { yAt } = makeScales(PLOT, count, domain);
  const baseline = PLOT.y + PLOT.h;
  const headX = xAt(head);

  const { ticks, step } = yTicks(domain[0], domain[1]);

  // Date ticks sit on fixed trading days and scroll with the line. The step
  // only ever doubles, so pulling back thins the labels out instead of
  // reshuffling them.
  const xStep = Math.max(1, Math.pow(2, Math.ceil(Math.log2(span / 7))));
  const xTicks: number[] = [];
  for (
    let i = Math.ceil(viewLo / xStep) * xStep;
    i <= Math.min(lastIdx, viewHi);
    i += xStep
  ) {
    xTicks.push(i);
  }

  const gridOpacity = interpolate(
    frame,
    [T.GRID_IN, T.GRID_IN + T.GRID_LEN],
    [0, 1],
    CLAMP,
  );

  // ── Readouts at the playhead ────────────────────────────────
  const start = totals[0];
  const now = valueAt(totalPts, head);
  const pnl = now - start;
  const pct = (pnl / start) * 100;
  const up = pnl >= 0;
  const total = money(now, currency);

  const drawn = sliceToHead(totalPts, head);
  // The last entry of `drawn` is the synthesised point at the fractional
  // playhead; placing it by index would overshoot the head dot.
  const idx = (i: number) => xAt(i === drawn.length - 1 ? head : i);
  const strokeWidth = interpolate(zoomOut, [0, 1], [6, 4]);

  const pulse = (frame % 60) / 60;
  // The line is cut at the starting value: everything above it is drawn in
  // the gain gradient, everything below in the loss gradient. `splitY` is
  // that cut, held inside the plot so both clip rects stay valid when the
  // start line has scrolled out of view.
  const startY = yAt(start);
  const clipTop = PLOT.y - 40;
  const splitY = Math.min(baseline, Math.max(clipTop, startY));
  // Each wash fades from the line's furthest reach on its side back to
  // nothing at the cut, so the colour is densest where the gain or loss is.
  // Days already scrolled out of the window are held to the plot edge.
  const drawnValues = drawn.map((p) => p.normalized);
  const lineD = splitLine(drawnValues, start, idx, yAt);
  const peakY = Math.min(
    splitY - 1,
    Math.max(clipTop, yAt(Math.max(...drawnValues))),
  );
  const troughY = Math.max(
    splitY + 1,
    Math.min(baseline, yAt(Math.min(...drawnValues))),
  );
  const sides = [
    {
      id: "up" as const,
      stops: C.lineUp,
      y: clipTop,
      h: splitY - clipTop,
      fade: [peakY, splitY],
    },
    {
      id: "down" as const,
      stops: C.lineDown,
      y: splitY,
      h: baseline - splitY,
      fade: [troughY, splitY],
    },
  ];
  // Both gradients are fixed to the plot, so the dot takes whatever colour
  // its side of the line has where the head currently sits.
  const headColor = interpolateColors(
    (headX - PLOT.x) / PLOT.w,
    [0, 0.55, 1],
    [...(now >= start ? C.lineUp : C.lineDown)],
  );

  const tag = `TOTAL ${total}`;
  // Rough width of the tag in Geist Mono, to keep it on the plot.
  const tagHalf = (tag.length * 14.6) / 2;

  // ── Finale: peak and low of the whole run ───────────────────
  const peakIdx = totals.indexOf(Math.max(...totals));
  const lowIdx = totals.indexOf(Math.min(...totals));
  // A peak or low on the final point is labelled there in the finale, so
  // the head tag hands over to it instead of stacking the same figure twice.
  const tagOpacity =
    peakIdx === lastIdx || lowIdx === lastIdx
      ? interpolate(frame, [T.MARKERS_IN - 12, T.MARKERS_IN], [1, 0], CLAMP)
      : 1;
  const markers = [
    { i: peakIdx, name: "PEAK", above: true },
    { i: lowIdx, name: "LOW", above: false },
  ];

  return (
    <AbsoluteFill
      style={{ background: C.bg, fontVariantNumeric: "tabular-nums" }}
    >
      <AbsoluteFill
        style={{
          background:
            `radial-gradient(1100px 620px at 18% 0%, ${C.glow[0]}, transparent 70%),` +
            `radial-gradient(1000px 640px at 92% 100%, ${C.glow[1]}, transparent 70%)`,
        }}
      />

      {/* ── Total value ──────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 64,
          height: 40,
          display: "flex",
          alignItems: "center",
          gap: 16,
          ...TYPE.eyebrow,
          color: C.inkMuted,
          ...fadeUp(frame, T.TITLE_IN),
        }}
      >
        {logoSrc && <Img src={logoSrc} style={{ height: 40, width: "auto" }} />}
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          left: 84,
          top: 112,
          ...TYPE.hero,
          // Sized by character count so a seven-figure total still clears
          // the holding cards.
          fontSize: total.length > 9 ? 100 : TYPE.hero.fontSize,
          color: C.ink,
          ...fadeUp(frame, T.COUNTER_IN),
        }}
      >
        {total}
      </div>
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 258,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "8px 16px",
          borderRadius: 8,
          ...TYPE.delta,
          color: up ? C.up : C.down,
          background: up ? C.upWash : C.downWash,
          ...fadeUp(frame, T.COUNTER_IN + 8),
        }}
      >
        <svg width={18} height={16} viewBox="0 0 18 16">
          <path
            d={up ? "M9 1 L17 15 L1 15 Z" : "M9 15 L17 1 L1 1 Z"}
            fill="currentColor"
          />
        </svg>
        <span>
          {up ? "+" : "−"}
          {money(pnl, currency)}
        </span>
        <span style={{ opacity: 0.75 }}>{percent(pct)}</span>
      </div>
      {/* The clock for the whole travel. */}
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 328,
          ...TYPE.clock,
          color: C.ink,
          ...fadeUp(frame, T.COUNTER_IN + 14),
        }}
      >
        {formatFull(periodAt(totalPts, head))}
        <span style={{ color: C.inkDim, fontWeight: 400 }}>
          {"  "}since {formatFull(dates[0])}
        </span>
      </div>

      {/* ── Holding cards ────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          right: 90,
          top: 64,
          width: 1048,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: 16,
        }}
      >
        {holdings.slice(0, MAX_CARDS).map((h, hi) => {
          const s01 = spring({
            frame: frame - (T.CARDS_IN + hi * T.CARD_STAGGER),
            fps,
            config: { damping: 16, mass: 0.6, stiffness: 170 },
          });
          const v = valueAt(holdingPts[hi], head);
          const hPct = (v / h.values[0] - 1) * 100;
          return (
            <div
              key={h.symbol}
              style={{
                width: 250,
                padding: "16px 20px 18px",
                background: C.card,
                // Not `border` + `borderTop`: React patches only the style
                // keys that changed, so a theme switch re-applies the
                // shorthand and wipes the top colour of any card whose own
                // colour is the same in both themes.
                borderStyle: "solid",
                borderWidth: "4px 1.5px 1.5px",
                borderColor: `${colors[hi]} ${C.cardRule} ${C.cardRule}`,
                opacity: Math.min(1, s01 * 1.4),
                transform: `translateY(${(1 - s01) * 30}px) scale(${0.9 + s01 * 0.1})`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span style={{ ...TYPE.ticker, color: colors[hi] }}>
                  {h.label}
                </span>
                <span
                  style={{
                    ...TYPE.cardDelta,
                    color: hPct >= 0 ? C.up : C.down,
                  }}
                >
                  {percent(hPct)}
                </span>
              </div>
              <div style={{ marginTop: 8, ...TYPE.cardValue, color: C.ink }}>
                {money(v, currency)}
              </div>
              <div
                style={{
                  marginTop: 6,
                  ...TYPE.detail,
                  color: C.inkMuted,
                  whiteSpace: "nowrap",
                }}
              >
                {quantity(h.quantity)} × {PREFIX[h.currency]}
                {closeAt(holdingPts[hi], head).toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Chart ────────────────────────────────────────────── */}
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <clipPath id="pf-clip">
            <rect
              x={PLOT.x}
              y={PLOT.y - 40}
              width={PLOT.w}
              height={PLOT.h + 40}
            />
          </clipPath>
          {sides.map((side) => (
            <React.Fragment key={side.id}>
              <clipPath id={`pf-clip-${side.id}`}>
                <rect x={PLOT.x} y={side.y} width={PLOT.w} height={side.h} />
              </clipPath>
              <linearGradient
                id={`pf-line-${side.id}`}
                x1={PLOT.x}
                x2={PLOT.x + PLOT.w}
                y1="0"
                y2="0"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={side.stops[0]} />
                <stop offset="55%" stopColor={side.stops[1]} />
                <stop offset="100%" stopColor={side.stops[2]} />
              </linearGradient>
              <linearGradient
                id={`pf-area-${side.id}`}
                x1="0"
                x2="0"
                y1={side.fade[0]}
                y2={side.fade[1]}
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  offset="0%"
                  stopColor={side.stops[1]}
                  stopOpacity={C.areaOpacity}
                />
                <stop offset="100%" stopColor={side.stops[1]} stopOpacity={0} />
              </linearGradient>
            </React.Fragment>
          ))}
        </defs>

        <g opacity={gridOpacity}>
          {ticks.map((t) => {
            const y = yAt(t);
            if (y < PLOT.y - 8 || y > baseline + 2) return null;
            return (
              <g key={t}>
                <line
                  x1={PLOT.x}
                  x2={PLOT.x + PLOT.w}
                  y1={y}
                  y2={y}
                  stroke={C.grid}
                  strokeWidth={2}
                />
                <text
                  x={PLOT.x - 22}
                  y={y + 8}
                  textAnchor="end"
                  style={TYPE.axis}
                  fill={C.inkMuted}
                >
                  {axisMoney(t, step, domain[1], currency)}
                </text>
              </g>
            );
          })}
          {xTicks.map((i) => (
            <text
              key={i}
              x={xAt(i)}
              y={baseline + 46}
              textAnchor="middle"
              style={TYPE.axis}
              fill={C.inkMuted}
            >
              {formatAxis(dates[i], span)}
            </text>
          ))}
        </g>

        <g clipPath="url(#pf-clip)">
          {/* What you started with — the line every day is measured against. */}
          {startY > PLOT.y && startY < baseline && (
            <g opacity={gridOpacity}>
              <line
                x1={PLOT.x}
                x2={PLOT.x + PLOT.w}
                y1={startY}
                y2={startY}
                stroke={C.inkMuted}
                strokeWidth={2}
                strokeDasharray="4 12"
                strokeLinecap="round"
              />
              <text
                x={PLOT.x + PLOT.w - 12}
                y={startY - 12}
                textAnchor="end"
                style={TYPE.rule}
                fill={C.inkMuted}
              >
                START {money(start, currency)}
              </text>
            </g>
          )}

          {drawn.length > 1 &&
            sides.map((side) => (
              <React.Fragment key={side.id}>
                {/* The wash fills between the line and the starting value,
                    so it reads as the gain or loss itself. */}
                <path
                  d={areaPath(drawn, idx, yAt, startY)}
                  fill={`url(#pf-area-${side.id})`}
                  clipPath={`url(#pf-clip-${side.id})`}
                />
                <path
                  d={lineD[side.id]}
                  fill="none"
                  stroke={`url(#pf-line-${side.id})`}
                  strokeWidth={strokeWidth * 3}
                  strokeLinejoin="round"
                  opacity={C.glowOpacity}
                  style={{ filter: "blur(14px)" }}
                />
                <path
                  d={lineD[side.id]}
                  fill="none"
                  stroke={`url(#pf-line-${side.id})`}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                />
              </React.Fragment>
            ))}
        </g>

        {/* Peak and low, pinned once the whole run is on screen. */}
        {markers.map((m, k) => {
          const s01 = spring({
            frame: frame - (T.MARKERS_IN + k * 14),
            fps,
            config: { damping: 14, mass: 0.6, stiffness: 160 },
          });
          if (s01 <= 0.001) return null;
          const x = xAt(m.i);
          const y = yAt(totals[m.i]);
          const color = m.above ? C.up : C.down;
          // The label stands off its point and an arrow closes the gap:
          // above a peak, below a low. Two cases go beside the point instead
          // — the final point, where the label takes over from the head
          // dot's tag, and a low so near the floor that a label under it
          // would land on the date axis.
          const atHead = m.i === lastIdx;
          let beside = 0;
          let above = m.above;
          if (atHead) {
            beside = -1;
          } else if (!m.above && y + 76 > baseline + 14) {
            beside = x > PLOT.x + PLOT.w - 500 ? -1 : 1;
            // Beside only works where the line is not running through that
            // spot — a low on a flat stretch is labelled from above instead.
            const [l, r] = [x + beside * 60, x + beside * 430].sort(
              (p, q) => p - q,
            );
            const crossed = totals.some((v, i) => {
              const px = xAt(i);
              return px >= l && px <= r && Math.abs(yAt(v) - y) < 24;
            });
            if (crossed) {
              beside = 0;
              above = true;
            }
          }
          const dir = above ? -1 : 1;
          const labelX = beside
            ? x + beside * 70
            : Math.min(PLOT.x + PLOT.w - 175, Math.max(PLOT.x + 175, x));
          const labelY = beside ? y + 8 : y + (above ? -56 : 76);
          // Arrow from the label's near edge to just short of the point.
          const from = beside
            ? [x + beside * 60, y]
            : [x + Math.max(-40, Math.min(40, labelX - x)), y + dir * 46];
          const to = beside ? [x + beside * 20, y] : [x, y + dir * 18];
          const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
          const [ux, uy] = [(to[0] - from[0]) / len, (to[1] - from[1]) / len];
          const barb = (side: 1 | -1) =>
            `M${to[0] - 10 * ux + side * 6 * uy},${to[1] - 10 * uy - side * 6 * ux} L${to[0]},${to[1]}`;
          return (
            <g key={m.name} opacity={Math.min(1, s01)}>
              {!atHead && (
                <circle
                  cx={x}
                  cy={y}
                  r={9 * s01}
                  fill={C.bg}
                  stroke={color}
                  strokeWidth={4}
                />
              )}
              <path
                d={`M${from[0]},${from[1]} L${to[0]},${to[1]} ${barb(1)} ${barb(-1)}`}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor={
                  beside < 0 ? "end" : beside > 0 ? "start" : "middle"
                }
                style={TYPE.ticker}
                fill={color}
                stroke={C.bg}
                strokeWidth={8}
                paintOrder="stroke"
              >
                {m.name} {money(totals[m.i], currency)} ·{" "}
                {formatAxis(dates[m.i], 0)}
              </text>
            </g>
          );
        })}

        {/* Head dot — outside the clip so it is whole at both plot edges. */}
        <g opacity={gridOpacity}>
          {[pulse, (pulse + 0.5) % 1].map((p, k) => (
            <circle
              key={k}
              cx={headX}
              cy={yAt(now)}
              r={10 + p * 34}
              fill="none"
              stroke={headColor}
              strokeWidth={3}
              opacity={(1 - p) * 0.6}
            />
          ))}
          <circle
            cx={headX}
            cy={yAt(now)}
            r={10}
            fill="#ffffff"
            stroke={headColor}
            strokeWidth={5}
          />
          {/* Same tag as CompareLineChart's line heads. */}
          <text
            x={Math.min(
              PLOT.x + PLOT.w - tagHalf,
              Math.max(PLOT.x + tagHalf, headX),
            )}
            y={yAt(now) - 28}
            textAnchor="middle"
            style={TYPE.ticker}
            fill={headColor}
            opacity={tagOpacity}
            stroke={C.bg}
            strokeWidth={8}
            paintOrder="stroke"
          >
            {tag}
          </text>
        </g>
      </svg>

      {/* ── Allocation, re-weighted every day ────────────────── */}
      <div
        style={{
          position: "absolute",
          left: PLOT.x,
          top: 936,
          width: PLOT.w,
          opacity: gridOpacity,
        }}
      >
        <SplitBar
          width={PLOT.w}
          textColor={C.inkMuted}
          items={holdings.map((h, hi) => {
            const value = valueAt(holdingPts[hi], head);
            return {
              key: h.symbol,
              label: h.label,
              color: colors[hi],
              value,
              // A position under half a percent is small, not absent.
              text:
                value / now < 0.005
                  ? "<1%"
                  : `${((value / now) * 100).toFixed(0)}%`,
            };
          })}
        />
      </div>

      {showAttribution !== false && (
        <div
          style={{
            position: "absolute",
            right: 1920 - PLOT.x - PLOT.w,
            bottom: 30,
            ...TYPE.credit,
            color: C.inkMuted,
            opacity: gridOpacity,
          }}
        >
          Market data provided by Longbridge AI
        </div>
      )}
    </AbsoluteFill>
  );
};
