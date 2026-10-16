import type { CalculateMetadataFunction } from "remotion";
import { LAYOUT } from "../../theme/layout";
import { portfolioTimeline } from "../PortfolioLineChart/timeline";
import { fetchComparison } from "./data";
import { compareLineChartSchema, type CompareLineChartProps } from "./schema";

export const calculateCompareLineChartMetadata: CalculateMetadataFunction<
  CompareLineChartProps
> = async ({ props }) => {
  // Fills partial `--props` groups from the schema defaults; see
  // PortfolioLineChart/metadata.ts.
  const parsed = compareLineChartSchema.parse(props);
  const { config } = parsed;
  const data = await fetchComparison(parsed.tickers, {
    amount: config.amount,
    startDate: config.startDate.trim(),
    interval: config.interval,
    currency: config.displayCurrency,
    usdHkd: config.usdHkd,
  });

  return {
    props: { ...parsed, data },
    durationInFrames: portfolioTimeline(
      data.dates.length,
      LAYOUT.fps,
      config.durationSeconds,
      data.interval,
    ).DURATION,
    fps: LAYOUT.fps,
    width: LAYOUT.width,
    height: LAYOUT.height,
    defaultOutName: `compare-${data.series.map((s) => s.label).join("-vs-")}-${data.dates[0]}-to-${data.dates[data.dates.length - 1]}`,
  };
};
