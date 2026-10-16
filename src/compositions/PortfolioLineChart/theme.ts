import type React from "react";
import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadGeistMono } from "@remotion/google-fonts/GeistMono";

// Only the weights the scale below uses — every extra one is another request
// a headless render has to wait on.
const SANS = `${
  loadGeist("normal", { weights: ["500", "600"], subsets: ["latin"] })
    .fontFamily
}, system-ui, sans-serif`;
const MONO = `${
  loadGeistMono("normal", {
    weights: ["400", "500", "600"],
    subsets: ["latin"],
  }).fontFamily
}, ui-monospace, Menlo, monospace`;

/**
 * Every text style in the composition, by role. Two voices: Geist carries the
 * values a viewer reads as amounts, Geist Mono carries everything that labels
 * or measures them — tickers, dates, axes, deltas. Sizes are px on the
 * 1920×1080 canvas.
 */
export const TYPE = {
  eyebrow: {
    fontFamily: MONO,
    fontSize: 24,
    fontWeight: 500,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  hero: {
    fontFamily: SANS,
    fontSize: 128,
    lineHeight: "128px",
    fontWeight: 600,
    letterSpacing: "-0.045em",
  },
  delta: {
    fontFamily: MONO,
    fontSize: 26,
    fontWeight: 500,
    letterSpacing: "-0.01em",
  },
  clock: { fontFamily: MONO, fontSize: 28, fontWeight: 500 },
  ticker: {
    fontFamily: MONO,
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: "0.06em",
  },
  cardDelta: { fontFamily: MONO, fontSize: 19, fontWeight: 500 },
  cardValue: {
    fontFamily: SANS,
    fontSize: 40,
    lineHeight: "44px",
    fontWeight: 600,
    letterSpacing: "-0.025em",
  },
  result: {
    fontFamily: SANS,
    fontSize: 60,
    lineHeight: "66px",
    fontWeight: 600,
    letterSpacing: "-0.035em",
  },
  resultLabel: {
    fontFamily: SANS,
    fontSize: 30,
    fontWeight: 500,
    letterSpacing: "-0.01em",
  },
  detail: { fontFamily: MONO, fontSize: 17, fontWeight: 400 },
  axis: { fontFamily: MONO, fontSize: 22, fontWeight: 500 },
  rule: {
    fontFamily: MONO,
    fontSize: 19,
    fontWeight: 500,
    letterSpacing: "0.08em",
  },
  marker: { fontFamily: SANS, fontSize: 22, fontWeight: 600 },
  share: { fontFamily: MONO, fontSize: 20, fontWeight: 500 },
  credit: { fontFamily: SANS, fontSize: 18, fontWeight: 500 },
} satisfies Record<string, React.CSSProperties>;

// Gains are red and losses green — the Hong Kong / mainland convention,
// the reverse of the US one.
export const THEMES = {
  dark: {
    bg: "#06080d",
    glow: ["rgba(94,234,212,0.13)", "rgba(167,139,250,0.14)"],
    ink: "#f4f6fb",
    inkMuted: "#8a93a6",
    inkDim: "#6b7588",
    grid: "rgba(255,255,255,0.09)",
    card: "rgba(255,255,255,0.045)",
    cardRule: "rgba(255,255,255,0.1)",
    up: "#ff4d4d",
    upWash: "rgba(255,77,77,0.15)",
    down: "#22c55e",
    downWash: "rgba(34,197,94,0.15)",
    // The total line takes one of these depending on which side of the
    // starting value it is on; each runs left to right across the plot.
    lineUp: ["#ff6b6b", "#ff3b3b", "#ff1744"],
    lineDown: ["#4ade80", "#22c55e", "#00c853"],
    glowOpacity: 0.55,
    areaOpacity: 0.42,
    // For tickers with no brand colour (see BRAND_COLORS). No greens or
    // reds: those two mean loss and gain everywhere else on the frame.
    holdings: [
      "#ff7a1a",
      "#60a5fa",
      "#a78bfa",
      "#fbbf24",
      "#38bdf8",
      "#e879f9",
      "#818cf8",
      "#94a3b8",
    ],
  },
  // Same hues a few steps darker: the dark set is tuned to glow on black and
  // washes out as text on a light ground.
  light: {
    bg: "#f5f6f8",
    glow: ["rgba(13,148,136,0.10)", "rgba(124,58,237,0.09)"],
    ink: "#0f172a",
    inkMuted: "#5b6779",
    inkDim: "#7b8698",
    grid: "rgba(15,23,42,0.09)",
    card: "#ffffff",
    cardRule: "rgba(15,23,42,0.1)",
    up: "#e01414",
    upWash: "rgba(224,20,20,0.1)",
    down: "#078536",
    downWash: "rgba(7,133,54,0.12)",
    lineUp: ["#ff4d4d", "#f01d1d", "#d50000"],
    lineDown: ["#1fd66b", "#00b84a", "#009a3e"],
    glowOpacity: 0.28,
    areaOpacity: 0.32,
    holdings: [
      "#f26a0f",
      "#2563eb",
      "#7c3aed",
      "#ca8a04",
      "#0284c7",
      "#c026d3",
      "#4f46e5",
      "#475569",
    ],
  },
} as const;

/**
 * A company's own colour, where it has one a viewer would recognise. Keyed
 * by Longbridge symbol with HK leading zeros dropped (`0700.HK` → `700.HK`).
 * A pair is [dark theme, light theme], for marks too pale or too dark to
 * work on both grounds.
 *
 * These deliberately override the no-green-no-red rule the fallback palette
 * keeps: NVIDIA is green and Tesla is red whatever the P&L colours are.
 */
const BRAND_COLORS: Record<string, string | readonly [string, string]> = {
  "NVDA.US": "#76b900",
  "AMD.US": ["#2dd4bf", "#0d9488"],
  // Tesla's red reads as "gain" here; its charcoal wordmark colour does not.
  "TSLA.US": ["#d4d7dc", "#393c41"],
  "AAPL.US": ["#a2aaad", "#6e6e73"],
  "MSFT.US": "#00a4ef",
  "GOOGL.US": "#4285f4",
  "GOOG.US": "#4285f4",
  "AMZN.US": "#ff9900",
  "META.US": "#0866ff",
  "NFLX.US": "#e50914",
  "INTC.US": "#0071c5",
  "AVGO.US": "#cc092f",
  "ORCL.US": "#c74634",
  "COIN.US": "#0052ff",
  "BABA.US": "#ff6a00",
  "700.HK": "#0052d9",
  "9988.HK": "#ff6a00",
  "1810.HK": "#ff6900",
  "3690.HK": "#ffd100",
  "9618.HK": "#e1251b",
  "5.HK": "#db0011",
};

/** Props colour, else the brand's, else the next one in the theme palette. */
export function holdingColor(
  holding: { symbol: string; color: string },
  index: number,
  theme: keyof typeof THEMES,
): string {
  if (holding.color) return holding.color;
  const brand = BRAND_COLORS[holding.symbol.replace(/^0+(?=\d+\.HK$)/, "")];
  if (brand) {
    return typeof brand === "string" ? brand : brand[theme === "light" ? 1 : 0];
  }
  const palette = THEMES[theme].holdings;
  return palette[index % palette.length];
}
