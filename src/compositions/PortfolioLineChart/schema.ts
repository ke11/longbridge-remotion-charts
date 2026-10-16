import { z } from "zod/v4";
import type { PortfolioData } from "./data";

// Three groups, by what a change costs: `config` and `holdings` decide what
// is fetched and how long the video runs; `style` only repaints. Studio lists
// them in this order.
//
// Every node carries a `.default(…)` so Studio renders concrete editable
// controls.

const HOLDING = { symbol: "", quantity: 0, label: "", color: "" };

const holdingSchema = z
  .object({
    /** Longbridge symbol: `NVDA.US`, `0700.HK`. Bare `NVDA` / `700` also work. */
    symbol: z.string().default(HOLDING.symbol),
    /** Shares held for the whole window. */
    quantity: z.number().nonnegative().default(HOLDING.quantity),
    /** Blank → the symbol without its market suffix. */
    label: z.string().default(HOLDING.label),
    /** Blank → next colour in the theme's palette. */
    color: z.string().default(HOLDING.color),
  })
  .default(HOLDING);

const STYLE = {
  theme: "dark" as const,
  gainColor: "green" as const,
  title: "WhaleAgent",
  logo: "whaleagent.png",
  showAttribution: true,
};

export const styleSchema = z
  .object({
    theme: z.enum(["dark", "light"]).default(STYLE.theme),
    /** Colour of a gain: `green` (losses red) or `red` (losses green, the HK / mainland convention). */
    gainColor: z.enum(["green", "red"]).default(STYLE.gainColor),
    title: z.string().default(STYLE.title),
    /** Drawn left of the title. A file in `public/` or a URL; blank → none. */
    logo: z.string().default(STYLE.logo),
    /** The "Market data provided by Longbridge AI" credit, bottom right. */
    showAttribution: z.boolean().default(STYLE.showAttribution),
  })
  .default(STYLE);

const CONFIG = {
  startDate: "2026-01-02",
  interval: "day" as const,
  displayCurrency: "USD" as const,
  usdHkd: 7.8,
  durationSeconds: 0,
};

const configSchema = z
  .object({
    /** `YYYY-MM-DD`. The chart runs from here to today. */
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .default(CONFIG.startDate),
    /** One point per trading day, or one per month (the month's last close). */
    interval: z.enum(["day", "month"]).default(CONFIG.interval),
    /** Currency the total is reported in. */
    displayCurrency: z.enum(["USD", "HKD"]).default(CONFIG.displayCurrency),
    /** Only used when holdings span both markets. HKD is pegged 7.75–7.85. */
    usdHkd: z.number().min(7).max(8.5).default(CONFIG.usdHkd),
    /** Whole-video length. 0 → paced automatically from the number of points. */
    durationSeconds: z.number().min(0).max(180).default(CONFIG.durationSeconds),
  })
  .default(CONFIG);

export const portfolioLineChartSchema = z.object({
  config: configSchema,
  holdings: z.array(holdingSchema).default([]),
  style: styleSchema,
});

// `data` is filled by calculateMetadata and added via a TS intersection only —
// Studio cannot produce a sensible editor for an opaque blob.
export type PortfolioLineChartProps = z.infer<
  typeof portfolioLineChartSchema
> & {
  data?: PortfolioData;
};
