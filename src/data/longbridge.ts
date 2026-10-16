export type Bar = {
  /** Period start, UTC midnight of the exchange-local date. */
  t: number;
  c: number;
  o: number;
  h: number;
  l: number;
  v?: number;
};

export type Interval = "day" | "week" | "month";

export type SeriesPoint = {
  /** Period key — `YYYY-MM` for monthly, `YYYY-MM-DD` otherwise. */
  period: string;
  close: number;
  normalized: number;
  /** Shares traded in the period. 0 when the source omits it. */
  volume: number;
};

// Remotion only exposes `REMOTION_*` variables to the bundle; `npm run dev` and
// `npm run render` copy `LONGBRIDGE_PROXY_PORT` into this one.
const LONGBRIDGE_PROXY = `http://127.0.0.1:${
  process.env.REMOTION_LONGBRIDGE_PROXY_PORT || 3011
}`;

type LongbridgeProxyResponse = {
  bars?: Bar[];
  error?: string;
};

// Prices come from the Longbridge CLI, reached through the local proxy in
// `scripts/longbridge-proxy.mjs`. `calculateMetadata` runs in a browser
// context in BOTH Studio and a headless CLI render, so the fetcher cannot
// spawn the CLI itself and cannot call a no-CORS origin — the loopback proxy
// solves both, and keeps the login on the user's machine.
export async function fetchLongbridgeSeries(
  symbol: string,
  interval: Interval,
  from: string,
  to: string,
): Promise<Bar[]> {
  const qs = new URLSearchParams({
    symbol,
    period: interval,
    start: from,
    end: to,
  });
  const url = `${LONGBRIDGE_PROXY}/kline?${qs}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(
      `Longbridge ${symbol}: cannot reach the local proxy at ${LONGBRIDGE_PROXY} ` +
        `(${err instanceof Error ? err.message : String(err)}). Start the ` +
        `project with \`npm run dev\` (or \`npm run render\`), which starts ` +
        `the proxy for you.`,
    );
  }
  const json = (await res.json().catch(() => ({}))) as LongbridgeProxyResponse;
  if (!res.ok || json.error) {
    const detail = json.error ?? `HTTP ${res.status}`;
    // `invalid symbol` is a typo in the ticker, not an account problem.
    const hint = /invalid symbol/i.test(detail)
      ? ""
      : /rate limit/i.test(detail)
        ? " — too many requests at once; wait a minute and try again."
      : /permission|denied|quota|out of limit|exceed/i.test(detail)
        ? " — check that https://open.longbridge.com/dashboard shows Quote " +
          "permissions activated, then run `longbridge auth login` again. " +
          "See Troubleshooting in the README."
        : /not authenticated|unauthori[sz]ed|token|login/i.test(detail)
          ? " — run `longbridge auth login`."
          : "";
    throw new Error(`Longbridge ${symbol}: ${detail}${hint}`);
  }
  return json.bars ?? [];
}
