import { Composition } from "remotion";
import { LAYOUT } from "./theme/layout";
import { PortfolioLineChart } from "./compositions/PortfolioLineChart";
import { portfolioLineChartSchema } from "./compositions/PortfolioLineChart/schema";
import { calculatePortfolioLineChartMetadata } from "./compositions/PortfolioLineChart/metadata";
import { CompareLineChart } from "./compositions/CompareLineChart";
import { compareLineChartSchema } from "./compositions/CompareLineChart/schema";
import { calculateCompareLineChartMetadata } from "./compositions/CompareLineChart/metadata";

// These are the starting values in Studio's props panel. Edit them there, or
// change them here to make them your defaults.

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PortfolioLineChart"
        component={PortfolioLineChart}
        schema={portfolioLineChartSchema}
        defaultProps={{
          config: {
            startDate: "2021-01-04",
            interval: "month" as const,
            displayCurrency: "USD" as const,
            usdHkd: 7.8,
            durationSeconds: 0,
          },
          holdings: [
            { symbol: "NVDA.US", quantity: 50, label: "", color: "" },
            { symbol: "TSLA.US", quantity: 10, label: "", color: "" },
            { symbol: "AAPL.US", quantity: 20, label: "", color: "" },
          ],
          style: {
            theme: "dark" as const,
            gainColor: "green" as const,
            title: "WhaleAgent",
            logoUrl: "https://whaleagent.io/_emdash/api/media/file/01M1M2A4WW7NQN75CEQS3D96QT.png",
            showAttribution: true,
          },
        }}
        calculateMetadata={calculatePortfolioLineChartMetadata}
        // Placeholder until calculateMetadata paces it from the day count.
        durationInFrames={1200}
        fps={LAYOUT.fps}
        width={LAYOUT.width}
        height={LAYOUT.height}
      />
      <Composition
        id="CompareLineChart"
        component={CompareLineChart}
        schema={compareLineChartSchema}
        defaultProps={{
          config: {
            amount: 1000,
            startDate: "2021-01-04",
            interval: "month" as const,
            displayCurrency: "USD" as const,
            usdHkd: 7.8,
            durationSeconds: 0,
          },
          tickers: [
            { symbol: "NVDA.US", label: "", color: "" },
            { symbol: "0700.HK", label: "Tencent", color: "" },
          ],
          style: {
            theme: "dark" as const,
            gainColor: "green" as const,
            title: "WhaleAgent",
            logoUrl: "https://whaleagent.io/_emdash/api/media/file/01M1M2A4WW7NQN75CEQS3D96QT.png",
            showAttribution: true,
          },
        }}
        calculateMetadata={calculateCompareLineChartMetadata}
        // Placeholder until calculateMetadata paces it from the point count.
        durationInFrames={1200}
        fps={LAYOUT.fps}
        width={LAYOUT.width}
        height={LAYOUT.height}
      />
    </>
  );
};
