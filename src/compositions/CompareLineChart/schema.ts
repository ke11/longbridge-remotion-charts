import { z } from "zod/v4";
import { styleSchema } from "../PortfolioLineChart/schema";
import type { CompareData } from "./data";

// Same three groups as PortfolioLineChart: `config` and `tickers` decide
// what is fetched and how long the video runs; `style` only repaints.

const TICKER = { symbol: "", label: "", color: "" };

const tickerSchema = z
  .object({
    /** Longbridge symbol: `AAPL.US`, `0700.HK`. Bare `AAPL` / `700` also work. */
    symbol: z.string().default(TICKER.symbol),
    /** Blank → the symbol without its market suffix. */
    label: z.string().default(TICKER.label),
    /** Blank → the ticker's brand colour, else the theme palette. */
    color: z.string().default(TICKER.color),
  })
  .default(TICKER);

const CONFIG = {
  amount: 100,
  startDate: "2020-01-02",
  interval: "day" as const,
  displayCurrency: "USD" as const,
  usdHkd: 7.8,
  durationSeconds: 0,
};

const configSchema = z
  .object({
    /** Put into every ticker on the start date, in the display currency. */
    amount: z.number().positive().default(CONFIG.amount),
    /** `YYYY-MM-DD`. Each stake is bought here and held to today. */
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .default(CONFIG.startDate),
    /** One point per trading day, or one per month (the month's last close). */
    interval: z.enum(["day", "month"]).default(CONFIG.interval),
    displayCurrency: z.enum(["USD", "HKD"]).default(CONFIG.displayCurrency),
    /** Only used when a ticker is listed in the other currency. */
    usdHkd: z.number().min(7).max(8.5).default(CONFIG.usdHkd),
    /** Whole-video length. 0 → paced automatically from the number of points. */
    durationSeconds: z.number().min(0).max(180).default(CONFIG.durationSeconds),
  })
  .default(CONFIG);

export const compareLineChartSchema = z.object({
  config: configSchema,
  /** The first is the pick; the others (up to three) are what it is compared with. */
  tickers: z.array(tickerSchema).default([]),
  style: styleSchema,
});

export type CompareLineChartProps = z.infer<typeof compareLineChartSchema> & {
  data?: CompareData;
};
