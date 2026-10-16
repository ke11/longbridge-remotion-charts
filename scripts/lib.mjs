// Shared by setup, dev and render: environment checks and process plumbing.

import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { BIN, createProxy, DEFAULT_PORT } from "./longbridge-proxy.mjs";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

export const MIN_NODE_MAJOR = 18;

const color = (code) => (s) =>
  process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s;
export const green = color(32);
export const red = color(31);
export const yellow = color(33);
export const bold = color(1);

export const ok = (msg) => console.log(`${green("✓")} ${msg}`);
export const fail = (msg) => console.log(`${red("✗")} ${msg}`);
export const warn = (msg) => console.log(`${yellow("!")} ${msg}`);

export const INSTALL_CLI = {
  darwin: "brew install --cask longbridge/tap/longbridge-terminal",
  linux:
    "curl -sSL https://open.longbridge.com/longbridge/longbridge-terminal/install | sh",
  win32:
    "iwr https://open.longbridge.com/longbridge/longbridge-terminal/install.ps1 | iex",
};

export const installCliHint = () =>
  INSTALL_CLI[process.platform] ?? INSTALL_CLI.linux;

export function checkNode() {
  const major = Number(process.versions.node.split(".")[0]);
  return { ok: major >= MIN_NODE_MAJOR, version: process.versions.node };
}

/** `{ ok, version }` — ok is false when the CLI is not on PATH. */
export async function checkCli() {
  try {
    const { stdout } = await execFileAsync(BIN, ["--version"], {
      timeout: 15_000,
    });
    return { ok: true, version: stdout.trim() };
  } catch {
    return { ok: false, version: "" };
  }
}

/** `{ ok, status }` — ok only when the CLI reports a valid login token. */
export async function checkLogin() {
  try {
    const { stdout } = await execFileAsync(
      BIN,
      ["auth", "status", "--format", "json"],
      { timeout: 30_000 },
    );
    const status = JSON.parse(stdout)?.token?.status ?? "unknown";
    return { ok: status === "valid", status };
  } catch {
    return { ok: false, status: "not logged in" };
  }
}

/** Is a proxy (ours, from another terminal) already answering on the port? */
async function proxyAlreadyRunning(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    return res.ok && (await res.json()).ok === true;
  } catch {
    return false;
  }
}

/**
 * Start the price proxy in this process. If one is already running on the
 * port (say `npm run dev` in another terminal), reuse it instead of failing.
 */
export async function startProxy(port = DEFAULT_PORT) {
  if (await proxyAlreadyRunning(port)) {
    ok(`Price proxy already running on http://127.0.0.1:${port}`);
    return null;
  }
  const server = createProxy();
  await new Promise((resolve, reject) => {
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is used by another program. Close it, or set ` +
              `LONGBRIDGE_PROXY_PORT to another port (e.g. 3012) before ` +
              `npm run dev / npm run render. macOS/Linux: ` +
              `LONGBRIDGE_PROXY_PORT=3012 npm run dev — Windows PowerShell: ` +
              `$env:LONGBRIDGE_PROXY_PORT=3012; npm run dev`,
          ),
        );
      } else reject(err);
    });
    server.listen(port, "127.0.0.1", resolve);
  });
  ok(`Price proxy listening on http://127.0.0.1:${port}`);
  return server;
}

/**
 * Run the Remotion CLI with Node directly — no `npx`, no shell, so it behaves
 * the same on macOS, Linux and Windows. Resolves with the exit code.
 */
export function runRemotion(args) {
  // The package does not export its bin file, so locate it via package.json.
  const pkg = require.resolve("@remotion/cli/package.json");
  const cli = join(dirname(pkg), require(pkg).bin.remotion);
  const child = spawn(process.execPath, [cli, ...args], {
    stdio: "inherit",
    env: { ...process.env, REMOTION_LONGBRIDGE_PROXY_PORT: String(DEFAULT_PORT) },
  });
  const forward = (sig) => child.kill(sig);
  process.on("SIGINT", forward);
  process.on("SIGTERM", forward);
  return new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
}

/** Warn (not fail) when the CLI or login is missing — `npm run setup` fixes it. */
export async function preflight() {
  const cli = await checkCli();
  if (!cli.ok) {
    warn(
      `Longbridge CLI not found — charts cannot load prices. Run ${bold("npm run setup")}.`,
    );
    return;
  }
  const login = await checkLogin();
  if (!login.ok) {
    warn(
      `Longbridge CLI is not logged in — charts cannot load prices. Run ${bold("longbridge auth login")}.`,
    );
  }
}
