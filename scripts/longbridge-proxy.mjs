#!/usr/bin/env node
// Local CORS-enabled bridge to the `longbridge` CLI.
//
// Why this exists: `calculateMetadata` runs in a *browser* context — both in
// Studio and during a headless render. A browser cannot spawn a local binary,
// so the fetcher has no way to call the Longbridge CLI directly.
//
// So: one tiny loopback server that shells out to the CLI and answers with
// `Access-Control-Allow-Origin: *`. Both Studio and the render bundle hit it
// over plain fetch. `npm run dev` and `npm run render` start it for you.
//
// Auth lives in the CLI's own token store (`longbridge auth login`). No key,
// secret or token is read, written or forwarded by this project.

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);

export const DEFAULT_PORT = Number(process.env.LONGBRIDGE_PROXY_PORT || 3011);
export const BIN = process.env.LONGBRIDGE_BIN || "longbridge";
const VALID_PERIODS = new Set(["day", "week", "month", "year"]);

/**
 * Longbridge stamps a bar at the exchange-local *start* of its period,
 * expressed in UTC — an HK monthly bar for August 2026 arrives as
 * `2026-07-31T16:00:00Z`, a US daily bar for 3 Aug as `2026-08-03T04:00:00Z`.
 * Reading those stamps as UTC dates puts HK bars one bucket early.
 *
 * Shift by +8h (HKT), then re-emit at UTC midnight of the period start, so the
 * chart code — which reads UTC fields — lands on the true period. US stamps
 * (04:00Z or 05:00Z) stay on their own date after the shift.
 */
function hkAlignedMs(iso, period) {
  const hk = new Date(Date.parse(iso) + 8 * 3600 * 1000);
  const y = hk.getUTCFullYear();
  const m = hk.getUTCMonth();
  const d = hk.getUTCDate();
  if (period === "month") return Date.UTC(y, m, 1);
  if (period === "year") return Date.UTC(y, 0, 1);
  return Date.UTC(y, m, d);
}

/** One CLI call. Longbridge caps a single response at 1000 candles. */
const PAGE_CAP = 1000;

/**
 * `--adjust forward` is not optional for any multi-year window.
 *
 * The CLI defaults to `none`, which returns the raw printed price of the day.
 * Across AAPL's four splits that reads as four crashes the stock never had:
 * 2014-05 $633 → 2014-06 $92.93 (7:1), 2020-07 $425 → 2020-08 $129 (4:1).
 * Normalising those to a $100 stake would report a ~99% loss on a 2,549×
 * gain. Forward adjustment restitches the series into one continuous scale.
 */
async function runCli({ symbol, period, start, end }) {
  const args = [
    "kline", "history", symbol,
    "--period", period,
    "--adjust", "forward",
    "--format", "json",
  ];
  if (start && end) args.push("--start", start, "--end", end);

  const { stdout } = await execFileAsync(BIN, args, {
    maxBuffer: 32 * 1024 * 1024,
    timeout: 60_000,
  });
  const parsed = JSON.parse(stdout);
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed.candlesticks || parsed.data || Object.values(parsed)[0];
  if (!Array.isArray(rows)) {
    throw new Error("unexpected CLI payload shape");
  }
  return rows;
}

const dayBefore = (iso) =>
  new Date(Date.parse(iso) - 86_400_000).toISOString().slice(0, 10);

/**
 * Run the CLI and return bars as `{ t, o, h, l, c, v }`, ascending.
 *
 * A single request tops out at 1000 candles and fills *backwards* from `end`,
 * so a five-year daily window (~1230 bars) silently returns only its most
 * recent four years. Page backwards until the requested start is covered,
 * a page comes back short (data begins), or the guard trips.
 */
export async function fetchKline({ symbol, period = "month", start, end }) {
  if (!symbol) throw new Error("symbol is required");
  if (!VALID_PERIODS.has(period)) {
    throw new Error(`invalid period "${period}"`);
  }
  // Every value reaches the CLI as an argv entry via execFile (never a shell),
  // so nothing can break out into a command. Still pin each one to its exact
  // shape: a symbol must start alphanumeric and dates must be real dates, so
  // nothing like `--help` can be read by the CLI as a flag.
  if (!/^[A-Za-z0-9][A-Za-z0-9.\-]{0,19}$/.test(symbol)) {
    throw new Error(`invalid symbol "${symbol}"`);
  }
  for (const [name, value] of [["start", start], ["end", end]]) {
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))
    ) {
      throw new Error(`invalid ${name} date "${value}" — use YYYY-MM-DD`);
    }
  }

  const startMs = start ? Date.parse(`${start}T00:00:00Z`) : -Infinity;
  const seen = new Map();
  let cursorEnd = end;

  for (let page = 0; page < 12; page++) {
    const rows = await runCli({ symbol, period, start, end: cursorEnd });
    if (!rows.length) break;
    for (const r of rows) seen.set(r.time, r);

    const earliest = rows[0].time;
    // Shifting to HKT before comparing keeps the boundary test in the same
    // timezone the stamps are expressed in.
    if (Date.parse(earliest) + 8 * 3600 * 1000 <= startMs) break;
    if (rows.length < PAGE_CAP) break; // ran out of history
    const next = dayBefore(earliest.slice(0, 10));
    if (next === cursorEnd) break;
    cursorEnd = next;
  }

  return [...seen.values()]
    .map((r) => ({
      t: hkAlignedMs(r.time, period),
      c: Number(r.close),
      o: Number(r.open),
      h: Number(r.high),
      l: Number(r.low),
      v: Number(r.volume ?? 0),
    }))
    .filter((b) => b.t >= startMs - 86_400_000)
    .sort((a, b) => a.t - b.t);
}

// Studio and the headless render both load the bundle from localhost. Only
// those pages get CORS headers, so a random website open in the same browser
// cannot read prices through the user's login (and spend their symbol quota).
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function corsFor(req) {
  const origin = req.headers.origin;
  if (!origin || !LOCAL_ORIGIN.test(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "*",
    Vary: "Origin",
  };
}

export function createProxy() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const origin = req.headers.origin;
    if (origin && !LOCAL_ORIGIN.test(origin)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "only local pages may use this proxy" }));
      return;
    }
    const CORS = corsFor(req);
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS).end();
      return;
    }
    if (url.pathname === "/health") {
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname !== "/kline") {
      res.writeHead(404, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    try {
      const bars = await fetchKline({
        symbol: url.searchParams.get("symbol"),
        period: url.searchParams.get("period") || "month",
        start: url.searchParams.get("start"),
        end: url.searchParams.get("end"),
      });
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ bars }));
    } catch (err) {
      const msg = err?.stderr?.toString?.().trim() || err.message || String(err);
      res.writeHead(502, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: msg }));
    }
  });
}

// Started directly (not imported) → listen.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const port = DEFAULT_PORT;
  createProxy().listen(port, "127.0.0.1", () => {
    console.log(`[longbridge-proxy] listening on http://127.0.0.1:${port}`);
  });
  const bye = () => process.exit(0);
  process.on("SIGINT", bye);
  process.on("SIGTERM", bye);
}
