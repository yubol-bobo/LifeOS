# LifeOS setup guide

**English** · [中文](SETUP.zh-CN.md)

This guide lists **every ID, API key and setting** LifeOS can use, in order. Almost all of it is optional: with nothing configured, LifeOS still runs fully in your browser.

> The one-line version: Fork → turn on Pages → open your site. Want Google Scholar auto-sync too? Add a SerpAPI key and your Scholar ID.

---

## Overview

| # | What | Required? | Where to get it | Where it goes |
|---|---|---|---|---|
| 1 | GitHub Pages | To use it online | — | Repo Settings → Pages |
| 2 | Previewing a dev branch | Optional | — | Run the workflow in Actions + Settings → Environments |
| 3 | **Google Scholar ID** | Optional | Your Scholar profile URL | Repo variable `SCHOLAR_ID` |
| 4 | **SerpAPI key** | Optional (goes with #3) | serpapi.com | Repo secret `SERPAPI_KEY` |
| 5 | OpenAlex / Semantic Scholar ID | Optional | openalex.org / semanticscholar.org | Entered in LifeOS |
| 6 | Exchange rates | No key needed | Built in, one-click online update | In LifeOS |
| 7 | Browser notifications | Optional | — | One click in LifeOS to allow |
| 8 | **Multi-device sync**: GitHub token (`gist` scope only) + sync password | If you use more than one device | github.com/settings/tokens | **Only in LifeOS** (once on each device) |
| 9 | **AI pet**: an API key from OpenAI / Claude / DeepSeek / Kimi / GLM | Optional | The provider's console | **Only in LifeOS** (Settings → AI) |

> 🔒 **Rule of thumb: keys never go into code, commits or chat messages.** Keys the deploy needs (SerpAPI) live only in GitHub Secrets. Your personal keys (sync token, AI key) are entered only in the LifeOS you open in your own browser. They're stored in that device's browser alone, never appear on the public site, and other visitors can't see them.

---

## 1. Turn on GitHub Pages

1. Fork this repo (or use your own).
2. Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push any commit to `main` and wait for Actions to finish (about a minute).
4. Open `https://<your-username>.github.io/<repo-name>/`.

Only want to run it locally? Skip this step:

```bash
npm install
```

```bash
npm run dev
```

## 2. Preview a dev branch (optional)

**Only merging into `main` updates your site.** Changes on a dev branch don't touch the version you use every day.

To try a dev branch before merging:

1. Allow the branch to deploy (once): **Settings → Environments → `github-pages` → Deployment branches and tags → Add deployment branch or tag rule**, and enter the branch name or a pattern such as `claude/*`.
2. **Actions → Deploy to GitHub Pages → Run workflow**, pick the branch in the dropdown, and run it.

⚠️ A repo has only one Pages site, so the preview **temporarily replaces** your live site until the next update to `main` (or until you run the workflow on `main` again). Your records are unaffected, because they live in your browser, not on the site.

---

## 3. Google Scholar ID

**What it is**: the string after `user=` in your Google Scholar profile URL.

```
https://scholar.google.com/citations?user=hgN6B6kAAAAJ&hl=en
                                          ^^^^^^^^^^^^
                                          this is the Scholar ID
```

**Where it goes (recommended)**: repo **Settings → Secrets and variables → Actions → Variables** tab → **New repository variable**, name `SCHOLAR_ID`, value your ID.

That keeps the ID out of the code, so people who fork your repo don't inherit it (otherwise their site would fetch your profile).

**Other settings** live in `lifeos.config.json` at the repo root (leave `id` empty; the variable takes priority):

```json
{
  "scholar": {
    "id": "",
    "intervalHours": 8,
    "monthlyLimit": 100,
    "timezone": "UTC"
  }
}
```

| Field | Meaning | Default |
|---|---|---|
| `id` | Your Scholar ID (best left empty in favour of the `SCHOLAR_ID` variable) | — |
| `intervalHours` | Minimum hours between two fetches | `8` |
| `monthlyLimit` | Maximum SerpAPI calls per calendar month | `100` |
| `timezone` | Time zone used to decide what "today" is, e.g. `America/New_York`, `Asia/Shanghai` | `UTC` |

A Scholar ID is public information anyway; the variable just stops forks from inheriting it.

**Scholar data on the site only goes into a LifeOS that has been "bound"**: the first time you open Research on your own site, click **It's mine — bind it**. Visitors to your site only see a notice; your papers are never merged into their LifeOS.

## 4. SerpAPI key (Google Scholar auto-sync)

Google Scholar has no official API, so LifeOS reads your Scholar profile through [SerpAPI](https://serpapi.com).

**Get a key**

1. Sign up at [serpapi.com](https://serpapi.com) (the free plan is enough).
2. After logging in, copy the key from **Dashboard → Your Private API Key**.

**Add the key**

1. Open repo **Settings → Secrets and variables → Actions**.
2. On the **Secrets** tab, click **New repository secret**.
3. Name it `SERPAPI_KEY`, paste your key as the secret, and save.

**What happens**

- The workflow wakes up every hour (on `main` only) and fetches once `intervalHours` have passed since the last fetch: each paper's citation count, new and removed papers, total citations, h-index, i10 and citations per year. Hourly runs that don't fetch finish in seconds and don't redeploy the site. GitHub sometimes starts scheduled runs late, so expect a little slack.
- **Fetch now**: Research → Sync citations → Google Scholar → **Fetch now (run on GitHub)** opens **Actions → Deploy to GitHub Pages → Run workflow**. A manual run fetches right away, ignoring the interval (the monthly limit still applies). Come back after 1–2 minutes and click **Check for new data**.
- **Per-paper charts**: every fetch records each paper's count, so each paper gets its own day-by-day curve. Its citations per year come from the paper's own Scholar page, which costs one extra call per paper; these are fetched only from spare budget (after reserving enough for the regular fetches until the month ends), up to `SCHOLAR_PAPER_GRAPHS` (default 3) papers per run, and refreshed monthly. Set `SCHOLAR_PAPER_GRAPHS` to `0` to turn them off.
- Safeguards keep you within quota: fetches are at least `intervalHours` apart; if that pace would use up `monthlyLimit` before the month ends, fetches are spaced out a little more; and calls per month never exceed `monthlyLimit`. Up to 100 papers costs 1 call per fetch: every 8 h is about 90 calls a month, within the free tier of 100; every 6 h would be about 120, so on the free tier it ends up nearer every 7 h.
- Data is stored on the repo's `scholar-data` branch and bundled into the site at deploy time. LifeOS merges it into Research when you open it, and shows each paper's 7- and 30-day changes.

**Check that it works**: repo **Actions** → the latest *Deploy to GitHub Pages* run → the *Sync Google Scholar* step's log:

| Log line | Meaning |
|---|---|
| `Fetched N papers in 1 call(s) …` | Success ✅ |
| `Last fetch 2.1 h ago (< 8 h) — skipping.` | Normal: not time for the next fetch yet |
| `Monthly budget reached` | This month's quota is used up; resets next month |
| `SCHOLAR_ID not set` | No Scholar ID found → check step 3 |
| `SERPAPI_KEY not set` | No key found → check step 4 (the name must match exactly) |
| `SerpAPI: Invalid API key` | The key is wrong; copy it again |

> Key leaked? Regenerate it in the SerpAPI dashboard and overwrite `SERPAPI_KEY` in Secrets.

## 5. OpenAlex / Semantic Scholar (an alternative citation source)

Don't want SerpAPI, or want to compare sources? In LifeOS open **Research → Sync citations**, pick a source and enter your ID. No key is needed; it syncs straight from the browser.

- **OpenAlex**: search your name on [openalex.org](https://openalex.org); the `A50…` in your author page URL is the ID. You can also enter `orcid:0000-0000-0000-0000`.
- **Semantic Scholar**: the number at the end of your author page URL.

## 6. Exchange rates (Assets)

No key needed. LifeOS ships with reference rates for common currencies. Edit them via **Assets → the currency button at the top right of an account card**, or click **Fetch latest rates** (from the free open.er-api.com endpoint).

## 7. Browser notifications (pet reminders)

**Settings → Desktop Pet → Browser notifications**. Turning it on asks for permission once. After that, water, stretch and pomodoro reminders pop up even while you're on another tab.

> Reminders only run while a LifeOS page is open (a browser limitation).

## 8. Sync between devices

Your data is **end-to-end encrypted** and stored in a **secret Gist** under your own GitHub account. Changes on any device show up on the others automatically.

**First device**

1. Open the [new token page](https://github.com/settings/tokens/new?scopes=gist&description=LifeOS%20sync) (classic token), **tick only `gist`**, optionally set an expiry, generate it and copy it.
2. In LifeOS → **Settings → Sync**: paste the token, choose a **sync password** (at least 6 characters), and click **Connect & sync**.

**Other devices**

- A new device: open the site → click **Sync from another device** in the setup wizard, and enter **the same token and the same sync password**. Your data appears.
- A device already in use: Settings → Sync, enter the same details. If both sides have data, you'll be asked to **Use the cloud copy** or **Merge both**.

**How it avoids losing data**

- Encryption happens in the browser (AES-256-GCM, with the key derived from your sync password via PBKDF2). GitHub only stores ciphertext, and the sync password is never uploaded.
- It syncs when the page opens, when you return to the tab, every minute, and a few seconds after each change. The cloud icon in the menu bar shows the status (green = synced, red = error).
- **Merged record by record**: if two devices change different things (say, adding a quest on the computer and checking in on the phone), both are kept. Only when the same item is changed on both sides does the newer one win. Deletions sync too, and changes made offline merge once you're back online.

**Notes**

- 🔑 **The token and sync password go only into LifeOS**, never into code or repo Secrets (sync talks directly from your browser to GitHub and has nothing to do with Actions). They're stored only on each device and are never synced or exported.
- 🔒 **If you forget the sync password, the cloud data can't be decrypted** (that's the price of encryption). In that case, on a device that has all your data, click **Disconnect this device**, delete the Gist (the one named `LifeOS sync` on [gist.github.com](https://gist.github.com)), and reconnect with a new password.
- Token leaked or expired: delete the old token on GitHub, create a new one, then disconnect and reconnect under Sync on each device.

---

## 9. AI pet (day summary)

Let your pet read your day and write a short, fun day summary that you can edit and save into that day's review. **It works without AI too**: with no key, the pet writes an offline version.

1. Pick a provider and create an API key:

   | Provider | Get a key | Default model (changeable) | Notes |
   |---|---|---|---|
   | Claude (Anthropic) | console.anthropic.com → API Keys | `claude-opus-5-5` | Built-in web search; for lower cost switch to `claude-sonnet-5-5` or `claude-haiku-5-5` |
   | OpenAI | platform.openai.com/api-keys | `gpt-5-mini` | Built-in web search |
   | DeepSeek | platform.deepseek.com/api_keys | `deepseek-chat` | No built-in search; news comes from Wikipedia |
   | Kimi (Moonshot) | platform.moonshot.cn → API Key | `moonshot-v1-8k` | Built-in web search (a model with a larger context, e.g. `kimi-latest`, works better with it). For international accounts set the base URL to `https://api.moonshot.ai/v1` |
   | GLM (Zhipu) | open.bigmodel.cn → API Keys | `glm-4-flash` | Built-in web search |

2. Open your LifeOS → **Settings → AI**, pick the provider, paste the key, and click **Test connection**.
   - Optional: turn on **Go online for inspiration**. The browser fetches a few recent news stories and "on this day" events from Wikipedia (free, works with every provider), and providers with built-in web search can also look things up (costs a little more). If a provider's search doesn't work with your model, the summary is simply written without it.
3. It's a good idea to **set a spending limit** on the key in the provider's console. A summary uses a few hundred to about a thousand tokens, so once a day costs very little.

**What gets sent?** Only when a summary is generated, the browser sends a digest of that day (names of completed quests, focus time and projects, income, XP, mood and notes, water and stretch breaks, this week's plan and goal progress, upcoming countdowns, and the review you wrote that day) directly to the provider you chose. Neither your key nor your data passes through any server in between.

**Test connection failed?**
- "Invalid key" → copy the key again and check for extra spaces.
- "Connection failed" → a network problem, or the provider doesn't allow direct browser calls (CORS). You can enter your own proxy (for example a Cloudflare Worker that forwards requests) under **Base URL (optional)**.

---

## 10. Use it yourself while others fork it (privacy)

**Bottom line: it's safe to make this repo public. Your records are never in the repo.**

| What | Where it's stored | Can a fork or the public see it? |
|---|---|---|
| Quests, reviews, mood, assets, focus sessions… all personal records | Your browser's localStorage | ❌ Not in the repo; forks can't take it and visitors can't see it |
| Multi-device sync data | Your own **secret Gist**, AES-256-GCM encrypted | ❌ Not in the repo; the Gist holds ciphertext that can't be read without your sync password |
| Sync token, sync password, AI key | Only in your browser | ❌ |
| SerpAPI key | Repo Secrets | ❌ Secrets aren't copied to forks and are masked in logs |
| Scholar ID | Repo variable `SCHOLAR_ID` | ❌ Variables aren't copied to forks |
| Google Scholar citation history | The `scholar-data` branch | ⚠️ Visible in a public repo (it's the same public info as your Scholar profile); a fork copies only the main branch by default, so it isn't taken |
| Demo data (a day in Alex's life) | In the code | Fictional, fine for anyone to see |

**Your site (e.g. `<you>.github.io/LifeOS`) is safe too**: every visitor sees the LifeOS **in their own browser** (empty, or with demo data they loaded), never your records. Your Scholar data only goes into a LifeOS you have bound.

**A few habits**

1. **Never commit exported backup files to the repo.** `.gitignore` already ignores `lifeos-backup*.json`; don't force-add them.
2. **Use a strong sync password** that you don't reuse elsewhere. A Gist marked "secret" is unlisted, not private: anyone with the link can see the ciphertext.
3. **Keep personal settings in Secrets / Variables, not in files.** Code should only contain defaults that suit everyone.
4. For others who want to use it, recommend **Fork**: when you publish updates, they click **Sync fork** on GitHub to get them (see section 11). Alternatively, tick **Template repository** under **Settings → General**; people who click **Use this template** get a clean new repo, but have to merge your updates by hand afterwards.

**What someone does after forking** (the same as you did): turn on Pages (step 1) → optionally add their own `SCHOLAR_ID` variable and `SERPAPI_KEY` secret → open the site and start. Scheduled workflows are disabled in a new fork; enable them once on the Actions page.

---

## 11. Updating a fork and extending LifeOS

### If you forked: getting new versions

1. Open your fork's front page and click **Sync fork → Update branch**.
2. GitHub redeploys your site automatically (any update to `main` deploys).
3. Open your site; the version number is at the bottom of **Settings → General**. Check [CHANGELOG.md](CHANGELOG.md) for any ⚠️ steps you need to take by hand.

Your records live in your own browser and Gist, so **updating never touches them**. A new version upgrades old data to the new format automatically.

If you used **Use this template**: locally run `git remote add upstream https://github.com/yubol-bobo/LifeOS.git`, then `git pull upstream main` to merge.

> To keep updates conflict-free, put your personal settings (Scholar ID, SerpAPI key) in Variables / Secrets and **don't edit code files**. As long as you haven't changed the same files, Sync fork won't conflict.

### If you maintain it or want to add features

- **Work on a dev branch**; only merging into `main` goes live (section 2).
- **Old data must upgrade automatically**: give new fields defaults in `migrate()` in `src/store/store.ts`. Don't rename or delete fields outright; if you must, move the old values over in `migrate()`. Export a backup before big changes.
- **Nothing personal goes into the repo**: personal settings belong in Secrets / Variables or the browser; code files hold only general defaults.
- **For every release**:
  1. Bump `version` in `package.json`.
  2. Add what changed to the top of [CHANGELOG.md](CHANGELOG.md), marking any manual steps with ⚠️.
  3. (Optional) Create a tag or Release on GitHub so people who forked know it's time to sync.

---

## Where is my data?

- Your quests, goals, mood, assets and so on are stored in the current browser (localStorage). **With sync on**, an encrypted copy is also kept in your own secret Gist for multi-device use.
- Without sync, before switching computers or clearing your browser: **Settings → General → Export backup**, then **Import backup** on the new device.
- Only Google Scholar sync data is stored in the repo, on the `scholar-data` branch (it's the same public info as your profile).

## FAQ

**Deploy fails in Actions with "Ensure GitHub Pages has been enabled"?** → Step 1: set the Pages source to GitHub Actions.

**The deploy job fails in 2 seconds with no log?** → The branch isn't allowed to deploy; see step 2.

**Scholar data never updates?** → The scheduled job only runs on the default branch `main`. Make sure the code is merged into `main`, and compare with the log table in step 4.
