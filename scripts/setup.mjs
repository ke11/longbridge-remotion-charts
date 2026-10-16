#!/usr/bin/env node
// `npm run setup` — checks everything the charts need and fixes what it can.
//
//   npm run setup            check, and offer to log in if needed
//   npm run setup -- --check check only; never prompts (for scripts and AI agents)
//
// Exits 0 when the project is ready to run, 1 otherwise.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { BIN } from "./longbridge-proxy.mjs";
import {
  bold,
  checkCli,
  checkLogin,
  checkNode,
  fail,
  installCliHint,
  MIN_NODE_MAJOR,
  ok,
} from "./lib.mjs";

const checkOnly = process.argv.includes("--check");
const interactive = process.stdin.isTTY && process.stdout.isTTY && !checkOnly;

console.log(bold("\nChecking your setup…\n"));

let ready = true;

// 1. Node.js
const node = checkNode();
if (node.ok) ok(`Node.js ${node.version}`);
else {
  fail(
    `Node.js ${node.version} is too old — install ${MIN_NODE_MAJOR} or newer (LTS) from https://nodejs.org`,
  );
  ready = false;
}

// 2. npm install
if (existsSync(new URL("../node_modules/remotion", import.meta.url))) {
  ok("Project dependencies installed");
} else {
  fail(`Dependencies missing — run ${bold("npm install")} first`);
  ready = false;
}

// 3. Longbridge CLI
const cli = await checkCli();
if (cli.ok) ok(`Longbridge CLI (${cli.version})`);
else {
  fail("Longbridge CLI not found. Install it with:");
  console.log(`\n    ${installCliHint()}\n`);
  console.log(
    "  Then open a NEW terminal window and run this again.\n" +
      "  More options: https://open.longbridge.com/docs/cli/install\n",
  );
  process.exit(1);
}

// 4. Logged in
let login = await checkLogin();
if (!login.ok && interactive) {
  console.log(
    `\n  You are not logged in to Longbridge yet. Starting ${bold("longbridge auth login")}…\n` +
      "  Open the link it prints, sign in, and enter the code.\n",
  );
  await new Promise((resolve) =>
    spawn(BIN, ["auth", "login"], { stdio: "inherit" }).on("exit", resolve),
  );
  login = await checkLogin();
}
if (login.ok) ok("Logged in to Longbridge");
else {
  fail(
    `Not logged in to Longbridge (status: ${login.status}). Run ${bold("longbridge auth login")}, ` +
      "open the link it prints, sign in, and enter the code.",
  );
  ready = false;
}

if (ready) {
  console.log(
    `\n${bold("All set!")} Start the editor with ${bold("npm run dev")}\n`,
  );
} else {
  console.log(`\nFix the ${bold("✗")} items above, then run ${bold("npm run setup")} again.\n`);
}
process.exit(ready ? 0 : 1);
