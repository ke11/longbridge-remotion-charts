#!/usr/bin/env node
// `npm run render` — renders videos from the command line, no Studio needed.
//
//   npm run render                          both charts → out/
//   npm run render -- PortfolioLineChart    one chart  → out/
//   npm run render -- CompareLineChart out/my.mp4 --props=my-props.json
//
// Everything after the chart name is passed to `remotion render` as-is.

import { fail, preflight, runRemotion, startProxy } from "./lib.mjs";

const CHARTS = ["PortfolioLineChart", "CompareLineChart"];

await preflight();
let server;
try {
  server = await startProxy();
} catch (err) {
  fail(err.message);
  process.exit(1);
}

const args = process.argv.slice(2);
const jobs =
  args.length === 0 ? CHARTS.map((id) => [id]) : [args];

let code = 0;
for (const job of jobs) {
  code = await runRemotion(["render", ...job]);
  if (code !== 0) break;
}
server?.close();
process.exit(code);
