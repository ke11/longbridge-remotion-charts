# AGENTS.md: install and run guide for AI coding agents

You are helping a user, probably non-technical, get this project running and make a video. Follow these steps in order. Run commands yourself where you can; the user only has to act at the two points marked **USER**.

## What this project is

Two Remotion video compositions for HK and US stocks:

- `PortfolioLineChart`: total value of a set of holdings over time.
- `CompareLineChart`: the same amount invested in 2 to 4 tickers on the same day.

Prices come from the **Longbridge CLI** (`longbridge`) through a local proxy (`scripts/longbridge-proxy.mjs`, `127.0.0.1:3011`; set `LONGBRIDGE_PROXY_PORT` to use another port) that `npm run dev` and `npm run render` start automatically. There are **no API keys** in this project. Never ask the user for a key, secret or token, and never create a `.env` file for Longbridge.

## Step 1: Node.js

```bash
node --version
```

You need v18 or newer. If it's missing or older, tell the user to install the LTS version from https://nodejs.org, then open a new terminal. Don't install Node with `sudo` or system package managers unless the user asks.

## Step 2: Install dependencies

From the repository root:

```bash
npm install
```

Warnings are normal. Only stop on a non-zero exit code.

## Step 3: Longbridge CLI

```bash
longbridge --version
```

If it isn't found, install it for the user's OS:

| OS | Command |
|---|---|
| macOS with Homebrew | `brew install --cask longbridge/tap/longbridge-terminal` |
| macOS / Linux | `curl -sSL https://open.longbridge.com/longbridge/longbridge-terminal/install \| sh` |
| Windows PowerShell | `iwr https://open.longbridge.com/longbridge/longbridge-terminal/install.ps1 \| iex` |

Ask the user before running an install script. After installing, `longbridge` may not be on PATH until a new shell starts. Check the install script's output for the binary location, or ask the user to open a new terminal.

## Step 4: Log in (**USER** action)

Check:

```bash
npm run setup -- --check
```

This never prompts. It exits `0` when everything is ready and `1` otherwise, with a `✗` line per problem.

If it reports **Not logged in**, the login is interactive (OAuth device flow), so the user has to complete it:

- If your environment can show live command output to the user, run `longbridge auth login` and relay the **URL and code** it prints. The user opens the URL, signs in to Longbridge and enters the code. The command then finishes on its own.
- Otherwise, ask the user to run `longbridge auth login` in their own terminal. In Claude Code they can type `! longbridge auth login`.

Then run `npm run setup -- --check` again until it exits 0.

The user needs a Longbridge account (sign up in the Longbridge app). If the login works but price requests fail with permission or quote errors, their OpenAPI quote access isn't enabled or this month's symbol limit is used up; send them to https://open.longbridge.com.

## Step 5: Verify with a test render

```bash
npm run render -- PortfolioLineChart out/test.mp4 --frames=0-60
```

Success ends with a line like `+ out/test.mp4 …kB`. This checks prices, the proxy and rendering end to end in under a minute.

## Step 6: Make the user's video

Ask the user for:

1. Which chart: their **portfolio** (symbols + share counts) or a **comparison** (2 to 4 symbols + an amount).
2. Start date, and `day` or `month` points (`month` for spans over about 2 years).
3. Display currency, `USD` or `HKD`.
4. Optional: title, `dark`/`light` theme, logo.

Symbols: `NVDA.US`, `0700.HK`. A bare `NVDA` means US and a bare `700` means HK. Only `.US` and `.HK` are supported.

**Interactive:** run `npm run dev` (it keeps running; start it in the background if your tool allows) and tell the user to open the Studio URL it prints (usually http://localhost:3000), choose the composition, edit the Props panel and click Render.

**Non-interactive:** write a props file and render it. Give every group in full. A missing group falls back to `src/Root.tsx`; a missing field inside a group falls back to the schema default in `src/compositions/*/schema.ts`, and the two don't always match.

```json
{
  "config": { "startDate": "2024-01-02", "interval": "day", "displayCurrency": "USD", "usdHkd": 7.8, "durationSeconds": 0 },
  "holdings": [
    { "symbol": "0700.HK", "quantity": 200, "label": "Tencent", "color": "" },
    { "symbol": "NVDA.US", "quantity": 30, "label": "", "color": "" }
  ],
  "style": { "theme": "dark", "title": "My Portfolio", "logo": "", "showAttribution": true }
}
```

```bash
npm run render -- PortfolioLineChart out/my-portfolio.mp4 --props=my-portfolio.json
```

For `CompareLineChart`, use `tickers` (no `quantity`) instead of `holdings`, and add `"amount": 1000` to `config`. The first ticker is the "pick" the others are measured against.

Rendering a multi-year daily chart takes a few minutes. Tell the user where the MP4 was saved: the path you passed, or, if you passed none, `out/` with a name built from the chart and its dates.

## Rules

- **Don't run `npx remotion …` directly.** Use `npm run dev` / `npm run render`; they start the proxy and pass the proxy port into the bundle. Without them, every chart fails with "cannot reach the local proxy".
- Don't add API keys, the Longbridge SDK or `.env` handling. Auth belongs to the CLI.
- Don't commit the user's props files or `out/` videos unless asked.
- Before changing chart code, run `npm run typecheck`.

## Errors

| Error | Action |
|---|---|
| `cannot reach the local proxy` | The chart was started without `npm run dev`/`npm run render`. Restart it through those. |
| `Port 3011 is used by another program` | Re-run with another port: `LONGBRIDGE_PROXY_PORT=3012 npm run dev` (PowerShell: `$env:LONGBRIDGE_PROXY_PORT=3012; npm run dev`). Same for `npm run render`. |
| `not authenticated` / token errors | Go back to Step 4. |
| `invalid symbol` | Wrong ticker. Fix the symbol; this is not a login problem. |
| `no daily bars since …` | Wrong symbol, or the stock wasn't listed yet on the start date. |
| `startDate … is not in the past.` | Use an earlier start date. |
| `only .US and .HK listings are supported` | Other markets have no FX conversion here; drop that symbol. |
| `Add at least two different tickers to compare.` | CompareLineChart needs 2 or more distinct symbols. |
