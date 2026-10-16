import type { CalculateMetadataFunction } from "remotion";
import { LAYOUT } from "../../theme/layout";
import { fetchPortfolio } from "./data";
import {
  portfolioLineChartSchema,
  type PortfolioLineChartProps,
} from "./schema";
import { portfolioTimeline } from "./timeline";

export const calculatePortfolioLineChartMetadata: CalculateMetadataFunction<
  PortfolioLineChartProps
> = async ({ props }) => {
  // `--props` replaces a group wholesale — `{"style":{"theme":"dark"}}` arrives
  // with no title, logoUrl or attribution flag. Parsing fills each gap from the
  // schema defaults, so a partial override can never reach the component.
  const parsed = portfolioLineChartSchema.parse(props);
  const { config } = parsed;
  const data = await fetchPortfolio(parsed.holdings, {
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
    defaultOutName: `portfolio-${data.interval}-${data.dates[0]}-to-${data.dates[data.dates.length - 1]}`,
  };
};
