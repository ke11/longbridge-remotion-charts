import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
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
  linePath,
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
} from "../PortfolioLineChart/format";
import { holdingColor, themeColors, TYPE } from "../PortfolioLineChart/theme";
import { portfolioTimeline, windowDays } from "../PortfolioLineChart/timeline";
import { SplitBar } from "../PortfolioLineChart/SplitBar";
import type { CompareLineChartProps } from "./schema";

const PLOT: Box = { x: 170, y: 424, w: 1630, h: 416 };

/** `3.8×`; past 10× the second decimal is noise. */
const multiple = (m: number) => `${m.toFixed(m >= 10 ? 1 : 2)}×`;

/** A money figure with the cents set small, so the dollars carry the read. */
const Figure: React.FC<{ value: string; style: React.CSSProperties }> = ({
  value,
  style,
}) => {
  const [whole, cents] = value.split(".");
  return (
    <span style={style}>
      {whole}
      {cents && (
        <span style={{ fontSize: "0.58em", letterSpacing: "-0.02em" }}>
          .{cents}
        </span>
      )}
    </span>
  );
};

export const CompareLineChart: React.FC<CompareLineChartProps> = ({
  style,
  config,
  data,
}) => {
  const frame = useCurrentFrame();
  const { title, logoUrl, showAttribution } = style;
  const C = themeColors(style.theme, style.gainColor);
  const { fps } = useVideoConfig();

  const pts = useMemo(
    () =>
      data
        ? data.series.map((s) => toPoints(data.dates, s.values, s.closes))
        : [],
    [data],
  );

  if (!data || pts.length < 2 || data.dates.length < 2) {
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

  const { currency, amount, series, dates } = data;
  const themeName = style.theme === "light" ? "light" : "dark";
  const colors = series.map((s, si) => holdingColor(s, si, themeName));
  const logoSrc = logoUrl?.trim()
    ? /^(https?:|data:)/.test(logoUrl.trim())
      ? logoUrl.trim()
      : staticFile(logoUrl.trim())
    : null;
  const count = dates.length;
  const lastIdx = count - 1;
  const T = portfolioTimeline(
    count,
    fps,
    config.durationSeconds,
    data.interval,
  );
  const WINDOW = windowDays(count);

  // ── Camera — the same move as PortfolioLineChart ────────────
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

  const zoomDomain = windowDomain(pts, winLo, winLo + WINDOW, 6, WINDOW / 3);
  const fullDomain = paddedDomain(series.flatMap((s) => s.values));
  const domain: [number, number] = [
    interpolate(zoomOut, [0, 1], [zoomDomain[0], fullDomain[0]]),
    interpolate(zoomOut, [0, 1], [zoomDomain[1], fullDomain[1]]),
  ];

  const xAt = (i: number) => PLOT.x + ((i - viewLo) / span) * PLOT.w;
  const { yAt } = makeScales(PLOT, count, domain);
  const baseline = PLOT.y + PLOT.h;
  const headX = xAt(head);

  const { ticks, step } = yTicks(domain[0], domain[1]);

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
  // The first ticker is the pick; it is measured against whichever of the
  // others is worth most right now, so with two tickers that is simply B.
  const now = pts.map((p) => valueAt(p, head));
  const rivalAt = (values: number[]) =>
    values.reduce((best, v, i) => (i > 0 && v > values[best] ? i : best), 1);
  const rival = rivalAt(now);
  const gap = now[0] - now[rival];
  const ahead = gap >= 0;
  const hero = money(now[0], currency);

  const startY = yAt(amount);
  // A round stake reads as "$100", not "$100.00".
  const stake = Number.isInteger(amount)
    ? `${PREFIX[currency]}${amount.toLocaleString("en-US")}`
    : money(amount, currency);
  // The head tags own the right edge once the playhead gets there.
  const startLabel = interpolate(
    headX,
    [PLOT.x + PLOT.w - 460, PLOT.x + PLOT.w - 300],
    [1, 0],
    CLAMP,
  );
  const strokeWidth = interpolate(zoomOut, [0, 1], [6, 4]);
  const pulse = (frame % 60) / 60;

  // Head tags sit above their dots. Where two lines run close the upper tag
  // is pushed up, so both stay readable instead of printing over each other.
  const TAG_GAP = 34;
  const tagY = now.map((v) => yAt(v) - 28);
  [...tagY.keys()]
    .sort((a, b) => tagY[b] - tagY[a])
    .forEach((si, k, order) => {
      if (k > 0) tagY[si] = Math.min(tagY[si], tagY[order[k - 1]] - TAG_GAP);
    });

  // ── Finale: what the stake became ───────────────────────────
  const final = series.map((s) => s.values[lastIdx]);
  const finalRival = rivalAt(final);
  const finalGap = final[0] - final[finalRival];
  const verdict = interpolate(
    frame,
    [T.MARKERS_IN, T.MARKERS_IN + 30],
    [0, 1],
    { ...CLAMP, easing: Easing.out(Easing.cubic) },
  );

  // Drawn back to front, so the pick's line is the one on top.
  const order = series.map((_, si) => si).reverse();

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

      {/* ── The pick's value, and its lead over the rival ────── */}
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
          fontSize: hero.length > 9 ? 100 : TYPE.hero.fontSize,
          color: C.ink,
          ...fadeUp(frame, T.COUNTER_IN),
        }}
      >
        {hero}
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
          color: ahead ? C.up : C.down,
          background: ahead ? C.upWash : C.downWash,
          ...fadeUp(frame, T.COUNTER_IN + 8),
        }}
      >
        <svg width={18} height={16} viewBox="0 0 18 16">
          <path
            d={ahead ? "M9 1 L17 15 L1 15 Z" : "M9 15 L17 1 L1 1 Z"}
            fill="currentColor"
          />
        </svg>
        <span>
          {ahead ? "+" : "−"}
          {money(gap, currency)} vs {series[rival].label}
        </span>
        <span style={{ opacity: 0.75 }}>{multiple(now[0] / now[rival])}</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 328,
          ...TYPE.clock,
          color: C.ink,
          whiteSpace: "nowrap",
          ...fadeUp(frame, T.COUNTER_IN + 14),
        }}
      >
        {formatFull(periodAt(pts[0], head))}
        <span style={{ color: C.inkDim, fontWeight: 400 }}>
          {"  "}
          {stake} in {series[0].label} since {formatFull(dates[0])}
        </span>
      </div>

      {/* ── One card per ticker ──────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          right: 90,
          top: 64,
          width: 1048,
          display: "flex",
          justifyContent: "flex-end",
          gap: 16,
        }}
      >
        {series.map((s, si) => {
          const s01 = spring({
            frame: frame - (T.CARDS_IN + si * T.CARD_STAGGER),
            fps,
            config: { damping: 16, mass: 0.6, stiffness: 170 },
          });
          const sPct = (now[si] / amount - 1) * 100;
          return (
            <div
              key={s.symbol}
              style={{
                width: 250,
                padding: "16px 20px 18px",
                background: C.card,
                // Longhand on purpose; see PortfolioLineChart.
                borderStyle: "solid",
                borderWidth: "4px 1.5px 1.5px",
                borderColor: `${colors[si]} ${C.cardRule} ${C.cardRule}`,
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
                <span style={{ ...TYPE.ticker, color: colors[si] }}>
                  {s.label}
                </span>
                <span
                  style={{
                    ...TYPE.cardDelta,
                    color: sPct >= 0 ? C.up : C.down,
                  }}
                >
                  {percent(sPct)}
                </span>
              </div>
              <div style={{ marginTop: 8, ...TYPE.cardValue, color: C.ink }}>
                {money(now[si], currency)}
              </div>
              <div
                style={{
                  marginTop: 6,
                  ...TYPE.detail,
                  color: C.inkMuted,
                  whiteSpace: "nowrap",
                }}
              >
                {quantity(s.quantity)} × {PREFIX[s.currency]}
                {closeAt(pts[si], head).toFixed(2)}
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
          <clipPath id="cmp-clip">
            <rect
              x={PLOT.x}
              y={PLOT.y - 40}
              width={PLOT.w}
              height={PLOT.h + 40}
            />
          </clipPath>
          {series.map((s, si) => (
            <linearGradient
              key={s.symbol}
              id={`cmp-area-${si}`}
              x1="0"
              x2="0"
              y1={PLOT.y}
              y2={baseline}
              gradientUnits="userSpaceOnUse"
            >
              <stop
                offset="0%"
                stopColor={colors[si]}
                // The pick carries the wash; the others only hint at one, or
                // the overlaps turn to mud.
                stopOpacity={C.areaOpacity * (si === 0 ? 0.7 : 0.25)}
              />
              <stop offset="100%" stopColor={colors[si]} stopOpacity={0} />
            </linearGradient>
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

        <g clipPath="url(#cmp-clip)">
          {/* The stake — where every line starts. */}
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
                opacity={startLabel}
              >
                START {stake}
              </text>
            </g>
          )}

          {order.map((si) => {
            const drawn = sliceToHead(pts[si], head);
            if (drawn.length < 2) return null;
            // The last entry of `drawn` is the synthesised point at the
            // fractional playhead; placing it by index would overshoot.
            const idx = (i: number) => xAt(i === drawn.length - 1 ? head : i);
            const d = linePath(drawn, idx, yAt);
            return (
              <React.Fragment key={series[si].symbol}>
                <path
                  d={areaPath(drawn, idx, yAt, baseline)}
                  fill={`url(#cmp-area-${si})`}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={colors[si]}
                  strokeWidth={strokeWidth * 3}
                  strokeLinejoin="round"
                  opacity={C.glowOpacity * (si === 0 ? 1 : 0.6)}
                  style={{ filter: "blur(14px)" }}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={colors[si]}
                  strokeWidth={strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </React.Fragment>
            );
          })}
        </g>

        {/* Head dots and tags — outside the clip so they are whole at both
            plot edges. */}
        <g opacity={gridOpacity}>
          {order.map((si) => {
            const y = yAt(now[si]);
            const tag = `${series[si].label} ${money(now[si], currency)}`;
            // Rough width of the tag in Geist Mono, to keep it on the plot.
            const half = (tag.length * 14.6) / 2;
            return (
              <g key={series[si].symbol}>
                {si === 0 &&
                  [pulse, (pulse + 0.5) % 1].map((p, k) => (
                    <circle
                      key={k}
                      cx={headX}
                      cy={y}
                      r={10 + p * 34}
                      fill="none"
                      stroke={colors[si]}
                      strokeWidth={3}
                      opacity={(1 - p) * 0.6}
                    />
                  ))}
                <circle
                  cx={headX}
                  cy={y}
                  r={si === 0 ? 10 : 8}
                  fill="#ffffff"
                  stroke={colors[si]}
                  strokeWidth={5}
                />
                <text
                  x={Math.min(
                    PLOT.x + PLOT.w - half,
                    Math.max(PLOT.x + half, headX),
                  )}
                  y={tagY[si]}
                  textAnchor="middle"
                  style={TYPE.ticker}
                  fill={colors[si]}
                  stroke={C.bg}
                  strokeWidth={8}
                  paintOrder="stroke"
                >
                  {tag}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Who holds how much of the combined total, day by day ─ */}
      <div
        style={{
          position: "absolute",
          left: PLOT.x,
          top: 936,
          width: PLOT.w,
          opacity: gridOpacity * (1 - verdict),
        }}
      >
        <SplitBar
          width={PLOT.w}
          textColor={C.inkMuted}
          items={series.map((s, si) => ({
            key: s.symbol,
            label: s.label,
            color: colors[si],
            value: now[si],
            text: money(now[si], currency),
          }))}
        />
      </div>

      {/* ── The result on one line: both outcomes, then the gap ─ */}
      <div
        style={{
          position: "absolute",
          left: PLOT.x,
          top: 926,
          width: PLOT.w,
          display: "flex",
          alignItems: "baseline",
          // Wide between groups, tight inside them, so each label reads as
          // belonging to the figure that follows it.
          gap: 40,
          whiteSpace: "nowrap",
          opacity: verdict,
          transform: `translateY(${(1 - verdict) * 18}px)`,
        }}
      >
        {[0, finalRival].map((si, k) => (
          <React.Fragment key={series[si].symbol}>
            {k > 0 && (
              <span style={{ ...TYPE.resultLabel, color: C.inkDim }}>vs</span>
            )}
            <span style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ ...TYPE.resultLabel, color: C.inkMuted }}>
                {stake} in{" "}
                <span style={{ color: colors[si], fontWeight: 600 }}>
                  {series[si].label}
                </span>
              </span>
              <Figure
                value={money(final[si], currency)}
                // The pick is the subject; the rival is the reference.
                style={{ ...TYPE.result, color: k === 0 ? C.ink : C.inkMuted }}
              />
            </span>
          </React.Fragment>
        ))}
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "baseline",
            gap: 14,
          }}
        >
          <span style={{ ...TYPE.resultLabel, color: C.inkMuted }}>
            {finalGap >= 0 ? "ahead by" : "behind by"}
          </span>
          <Figure
            value={money(finalGap, currency)}
            style={{ ...TYPE.result, color: finalGap >= 0 ? C.up : C.down }}
          />
          <span
            style={{
              ...TYPE.delta,
              // Lifted to sit mid-height against the big figure.
              position: "relative",
              top: -9,
              marginLeft: 4,
              padding: "6px 14px",
              borderRadius: 8,
              color: finalGap >= 0 ? C.up : C.down,
              background: finalGap >= 0 ? C.upWash : C.downWash,
            }}
          >
            {multiple(final[0] / final[finalRival])}
          </span>
        </span>
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
