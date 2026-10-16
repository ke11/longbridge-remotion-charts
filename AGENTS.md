# AGENTS.md: install and run guide for AI coding agents

You are helping a user, probably non-technical, get this project running and make a video. Follow these steps in order. Run commands yourself where you can; the user only has to act at the two points marked **USER**.

## What this project is

Two Remotion video compositions for HK and US stocks:

- `PortfolioLineChart`: total value of a set of holdings over time.
- `CompareLineChart`: the same amount invested in 2 to 4 tickers on the same day.

Prices come from the **Longbridge CLI** (`longbridge`) through a local proxy (`scripts/longbridge-proxy.mjs`, `127.0.0.1:3011`; set `LONGBRIDGE_PROXY_PORT` to use another port) that `npm run dev` and `npm run render` start automatically. There are **no API keys** in this project. Never ask the user for a key, secret or token, and never create a `.env` file for Longbridge.

> **Required: the Longbridge account must have its quote permissions activated *before* the CLI login.** A login made while it has none stays without them, and **every price request fails**. **Whenever fetching a quote fails** (permission denied, quota / out of limit, no quote permission, or any other Longbridge quote error **except `invalid symbol`**, which is a typo in the ticker), suspect this first: run `npm run setup -- --check`. If it reports `✗ No quote permissions`, walk the user through Step 4: check https://open.longbridge.com/dashboard → Quote permissions shows them activated (a new account shows 6), then `longbridge auth login` again.

## Step 1: Node.js

```bash
node --version
```

You need v18 or newer. If it's missing or older, tell the user to install the LTS version from https://nodejs.org (the installer asks for their computer password), then open a new terminal. Don't install Node with `sudo` or system package managers unless the user asks.

**Windows:** if PowerShell says "running scripts is disabled on this system", use `npm.cmd` instead of `npm` (e.g. `npm.cmd install`, `npm.cmd run render -- …`), or, with the user's OK, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (no admin needed). Set environment variables as `$env:NAME="value"; npm.cmd run …`. The `NAME=value npm …` form is macOS/Linux only.

## Step 2: Install dependencies

From the repository root:

```bash
npm install
```

Warnings are normal, including `npm warn install-scripts … esbuild … npm install-scripts approve` and `npm audit` advice. Don't approve anything and don't run `npm audit fix --force`; rendering works without them. Only stop on a non-zero exit code. If you get `EACCES`, the folder belongs to another user (probably cloned with `sudo`). Don't use `sudo npm`; ask the user to download the project into their home folder again.

## Step 3: Longbridge CLI

```bash
longbridge --version
```

If it isn't found, install it for the user's OS:

| OS | Command |
|---|---|
| macOS with Homebrew | `brew install --cask longbridge/tap/longbridge-terminal` |
| macOS / Linux | `curl -sSL https://open.longbridge.com/longbridge/longbridge-terminal/install \| sh` |
| Windows PowerShell | `iwr -useb https://open.longbridge.com/longbridge/longbridge-terminal/install.ps1 \| iex` |

Ask the user before running an install script.

- **The macOS/Linux `curl … | sh` script may run `sudo`** (when `/usr/local/bin` isn't writable, common on a new Mac) and ask for the computer password, which you can't type. Ask the user to run it in their own terminal (in Claude Code: `! curl -sSL https://open.longbridge.com/longbridge/longbridge-terminal/install | sh`).
- Homebrew and the Windows install need no admin. Don't install Homebrew yourself; that needs admin too.

After installing, your shell may not see `longbridge` yet. Instead of asking the user to open a new terminal, point the project at the binary for this session with `LONGBRIDGE_BIN`: `/usr/local/bin/longbridge` (curl), `/opt/homebrew/bin/longbridge` (Homebrew on Apple Silicon), or on Windows `$env:LONGBRIDGE_BIN="$env:LOCALAPPDATA\Programs\longbridge\longbridge.exe"`. Then run `npm run setup -- --check` with it set.

## Step 4: Log in (**USER** action)

Check:

```bash
npm run setup -- --check
```

This never prompts. It exits `0` when everything is ready and `1` otherwise, with a `✗` line per problem.

If it reports **Not logged in** or **✗ No quote permissions**, stop and tell the user, word for word:

> "Before logging in, go to https://open.longbridge.com/dashboard, sign in, and check that **Quote permissions** shows them activated. A new account shows 6. If it shows none, follow the page's prompts to activate OpenAPI access. Tell me when it shows them."

**Wait until they confirm.** A command-line login made while the account has no quote permissions stays without them, and every price request is denied. Then log in, using one of these:

- **Preferred:** ask the user to open https://open.longbridge.com/connect, sign in, and paste you the code it shows. Run `longbridge auth login --auth-code <CODE>`. It's a single call, with no browser or polling.
- Or run `longbridge auth login` **in the background**, read the URL and code from its output, and give them to the user. It exits by itself once they approve. Don't run it in the foreground: it blocks until the user finishes, and they never see the URL.
- Or ask the user to run `longbridge auth login` in their own terminal (in Claude Code: `! longbridge auth login`).

From mainland China with a US account, prefix the login with `LONGBRIDGE_REGION=global`. If it reported ✗ No quote permissions and logging in again (after the permissions show as activated) doesn't fix it, run `longbridge auth logout` first, then log in.

Then run `npm run setup -- --check` again until it exits 0. A good login reports `✓ Quote permissions: N activated` (a new account has 6).

If quote permissions are fine and price requests still fail with permission or quote errors, their OpenAPI quote access isn't enabled or this month's symbol limit is used up; send them to https://open.longbridge.com.

## Step 5: Verify with a test render

```bash
npm run render -- PortfolioLineChart out/test.mp4 --frames=0-60
```

Success ends with a line like `+ out/test.mp4 …kB`. This checks prices, the proxy and rendering end to end. The first render also downloads a headless Chrome (~100 MB), so allow a few minutes.

If `npm run dev` / `npm run render` prints nothing after its first line for more than 30 seconds, stop it and re-run with `LONGBRIDGE_PROXY_PORT=3012`.

## Step 6: Make the user's video

Ask the user for:

1. Which chart: their **portfolio** (symbols + share counts) or a **comparison** (2 to 4 symbols + an amount).
2. Start date, and `day` or `month` points (`month` for spans over about 2 years).
3. Display currency, `USD` or `HKD`.
4. Optional: title (default `WhaleAgent`), `dark`/`light` theme, `logoUrl` (default: the WhaleAgent logo URL; any image URL, a file in `public/`, or blank for none), and `gainColor`: `green` (gains green, the default) or `red` (gains red; suggest this for Hong Kong / mainland China viewers).

Symbols: `NVDA.US`, `0700.HK`. A bare `NVDA` means US and a bare `700` means HK. Only `.US` and `.HK` are supported.

**Interactive:** run `npm run dev` (it keeps running; start it in the background if your tool allows) and tell the user to open the Studio URL it prints (usually http://localhost:3000), choose the composition, edit the Props panel and click Render. With the macOS firewall on, the user may see a "node: accept incoming connections?" dialog; denying it is fine.

**Non-interactive:** write a props file under `out/` (git-ignored) and render it. Give every group in full. A missing group falls back to `src/Root.tsx`; a missing field inside a group falls back to the schema default in `src/compositions/*/schema.ts`, and the two don't always match.

```json
{
  "config": { "startDate": "2024-01-02", "interval": "day", "displayCurrency": "USD", "usdHkd": 7.8, "durationSeconds": 0 },
  "holdings": [
    { "symbol": "0700.HK", "quantity": 200, "label": "Tencent", "color": "" },
    { "symbol": "NVDA.US", "quantity": 30, "label": "", "color": "" }
  ],
  "style": { "theme": "dark", "gainColor": "green", "title": "WhaleAgent", "logoUrl": "https://whaleagent.io/_emdash/api/media/file/01M1M2A4WW7NQN75CEQS3D96QT.png", "showAttribution": true }
}
```

Change only the fields the user asked for; keep `title`, `logoUrl` and `showAttribution` as above unless told otherwise.

```bash
npm run render -- PortfolioLineChart out/my-portfolio.mp4 --props=out/my-portfolio.json
```

For `CompareLineChart`, use `tickers` (no `quantity`) instead of `holdings`, and add `"amount": 1000` to `config`. The first ticker is the "pick" the others are measured against.

If the start date is before a stock listed, the chart starts on the first date every holding has a price, with no error; tell the user the actual start date shown in the video.

Rendering a multi-year daily chart takes a few minutes. Tell the user where the MP4 was saved: the path you passed, or, if you passed none, `out/` with a name built from the chart and its dates.

## Rules

- **Don't run `npx remotion …` directly.** Use `npm run dev` / `npm run render`; they start the proxy and pass the proxy port into the bundle. Without them, every chart fails with "cannot reach the local proxy".
- Don't add API keys, the Longbridge SDK or `.env` handling. Auth belongs to the CLI.
- Don't commit the user's props files or `out/` videos unless asked.
- Before changing chart code, run `npm run typecheck`.
- **When a quote fails, check the quote permissions first** (see the note at the top). Don't change the symbol, dates or code to work around a Longbridge permission or quota error.

## Errors

Read the line after `An error occurred:` (it starts with `Error`). Ignore `Was not able to close puppeteer page` / `ProtocolError` stack traces printed before it.

| Error | Action |
|---|---|
| `cannot reach the local proxy` | The chart was started without `npm run dev`/`npm run render`. Restart it through those. |
| `Port 3011 is used by another program`, or no output for 30+ seconds after starting | Re-run with another port: `LONGBRIDGE_PROXY_PORT=3012 npm run dev` (PowerShell: `$env:LONGBRIDGE_PROXY_PORT=3012; npm.cmd run dev`). Same for `npm run render`. |
| `not authenticated` / token errors | Go back to Step 4. |
| Quote permission denied, "no quote permission", quota / out-of-limit errors | Run `npm run setup -- --check`. If ✗ No quote permissions: the user logged in while the account had none; go back to Step 4. If ✓ Quote permissions: this month's symbol limit is probably used up; send them to https://open.longbridge.com. |
| `Request rate limit` | Too many requests at once. Wait a minute and retry; don't loop. |
| `invalid symbol` | Wrong ticker. Fix the symbol; this is not a login problem. |
| `no daily bars since …` / `no monthly bars since …` | No prices at all after the start date: wrong or delisted symbol. Fix the symbol. (A start date before listing doesn't error; see Step 6.) |
| `startDate … is not in the past.` | Use an earlier start date. |
| `only .US and .HK listings are supported` | Other markets have no FX conversion here; drop that symbol. |
| `Add at least two different tickers to compare.` | CompareLineChart needs 2 or more distinct symbols. |
