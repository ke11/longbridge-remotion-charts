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
  PERMISSIONS_URL,
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

// 4. Logged in — with quote permissions already activated, or quotes are denied
let login = await checkLogin();
if (!login.ok && interactive) {
  console.log(
    `\n  You are not logged in to Longbridge yet.\n\n` +
      `  ${bold("First")}, open ${PERMISSIONS_URL}, sign in, and check that\n` +
      `  Quote permissions shows them activated (a new account shows 6).\n` +
      `  Logging in without them means every price request is denied.\n\n` +
      `  Then press Enter to start ${bold("longbridge auth login")}: open the link it\n` +
      "  prints, sign in, and enter the code.\n",
  );
  await new Promise((resolve) => {
    process.stdin.once("data", resolve);
    process.stdin.once("end", resolve); // Ctrl+D also continues
  });
  process.stdin.pause();
  await new Promise((resolve) =>
    spawn(BIN, ["auth", "login"], { stdio: "inherit" }).on("exit", resolve),
  );
  login = await checkLogin();
}
if (login.ok) ok("Logged in to Longbridge");
else {
  fail(
    `Not logged in to Longbridge (status: ${login.status}). First check that ` +
      `${PERMISSIONS_URL} shows Quote permissions activated, then run ${bold("longbridge auth login")}, ` +
      "open the link it prints, sign in, and enter the code.",
  );
  ready = false;
}

// 5. Quote permissions — a login made while the account had none keeps none,
// and every price request is denied.
if (login.ok) {
  if (login.quotePermissions > 0) {
    ok(`Quote permissions: ${login.quotePermissions} activated`);
  } else {
    fail(
      "No quote permissions on this login — prices will be denied. " +
        `Check that ${PERMISSIONS_URL} shows Quote permissions activated (a new ` +
        `account shows 6), then run ` +
        `${bold("longbridge auth login")} again. Still no permissions? Run ` +
        `${bold("longbridge auth logout")}, then ${bold("longbridge auth login")}.`,
    );
    ready = false;
  }
}

if (ready) {
  console.log(
    `\n${bold("All set!")} Start the editor with ${bold("npm run dev")}\n`,
  );
} else {
  console.log(`\nFix the ${bold("✗")} items above, then run ${bold("npm run setup")} again.\n`);
}
process.exit(ready ? 0 : 1);
