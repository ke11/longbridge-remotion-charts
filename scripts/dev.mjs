#!/usr/bin/env node
// `npm run dev` — starts the price proxy, then Remotion Studio in the browser.
// Extra arguments go to `remotion studio` (e.g. `npm run dev -- --port 3001`).

import { fail, preflight, runRemotion, startProxy } from "./lib.mjs";

await preflight();
try {
  await startProxy();
} catch (err) {
  fail(err.message);
  process.exit(1);
}
const code = await runRemotion(["studio", ...process.argv.slice(2)]);
process.exit(code);
