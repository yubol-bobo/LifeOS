# LifeOS feature guide

**English** · [中文](FEATURES.zh-CN.md)

> A detailed tour of every app, the desktop pets, how everything links together, and the XP rules. For a quick start see the [README](../README.md); for keys and sync see [SETUP.md](../SETUP.md).

**Contents**: [Apps](#apps) · [Desktop pets](#desktop-pets) · [How small things move big goals](#how-small-things-move-big-goals) · [Layout & system](#layout--system) · [Game rules](#game-rules-tweak-them) · [Tech stack](#tech-stack)

## Apps

LifeOS gathers the scattered systems of a life (daily to-dos, life milestones, papers and citations, work hours and income, body and reading data) into **one OS-style desktop**, and ties them together with game mechanics:

- **Desktop**: a greeting; a 3D "life planet" you can drag and spin (trees grow with your level, flags mark milestones you've reached, the moon orbits faster as your streak grows); today's quests; life progress bars (today / week / month / year / lifetime); attribute radar; XP heatmap.
- **Plans**: year → month → week → today. A plan can have a numeric target (e.g. "read 8 books"); each step forward, click **+1 & note** to record the details (which book, which film, how much your bench press went up). When a linked quest is completed, the plan gets +1 automatically and invites a note. Each level can be broken down from the one above it, and weekly items go to today's quests with one click (**To today**). Finishing lower levels pushes the higher ones forward; when everything is done the plan ticks itself and awards XP (week 30 / month 80 / year 200). Plans that fall behind the calendar are flagged. Year plans can link to goals, whose key-result progress counts toward them.
- **Countdowns**: deadlines, trips, birthdays (optionally yearly)… goal and project due dates appear automatically, and your pet reminds you 7, 3 and 1 day before, and on the day.
- **Projects**: research, work, life, or any category you define (editable). A project pulls together its quests, plans at every level, goals, papers, countdowns, focus time and income. Projects are also the "who you work for" list in Focus, each with its own optional rate.
- **Quests**: daily habits and one-off tasks, added in one line (start with `!` for a daily habit). XP depends on difficulty; finishing everything scheduled for the day triggers a **Perfect day** bonus. You can look back and catch up on earlier days.
- **Roadmap**: active goals (key results, live progress, countdowns, steps you can break down, rewards to claim), milestones you've reached, and **life in weeks**: about 4,400 squares, one per week of a life, with milestones marked on them. **Click any square you've lived** to open that week: XP, entries, days recorded, focus time, a 7-day strip (click a day for its full record) and every record of the week.
- **Research**: a paper board (idea → writing → submitted → under review → accepted → published, with XP at every step). **Drag a card to another column** to change its stage (on phones, press and hold, then drag); every stage change is recorded with its date, each card shows how long it has been in its current stage (e.g. "in review · 23 days"), the paper's editor lists the full stage history with editable dates, and the moves appear in the Timeline; total citations, h-index and i10 computed automatically; a citation chart; one-click sync of papers and citation counts from **OpenAlex** or **Semantic Scholar**.
- **Focus**: two modes. **Earn**: paid work; earnings roll up by the second, a coin drops every 15 minutes, and each project can have its own rate. **Projects**: everything else (papers, the gym, study…). Below the timer sits a **project board** with Planning / In progress / Done columns: every project plus your research papers (placed by stage); drag a card to change its status (the time is recorded), ▶ starts a session on it, and you can add a project right in the Planning column. Regular activities like the gym or reading stay as **Quick start** picks above the timer; the list is yours to rename, re-icon, re-assign, reorder, add to and delete from. Both modes earn 1 XP per minute and can link to a quest, goal or project. Before you start you can set a **countdown** (25 / 45 / 60 / 90 / 120 minutes or custom); when it ends there's a full-screen celebration with bonus XP and a **15 more minutes** button. **Where the effort went** is a 3D donut you can drag and spin: each slice's angle is its share of time and its height grows with that share, and the outer ring colour separates paid (green) from unpaid (purple). Hover to lift a slice and see duration, share and earnings or XP; click to pin it, and it stays in sync with the list beside it. Filter to paid only or unpaid only, today or this week. The menu-bar pill and the browser tab title show live earnings or the countdown.
- **Assets**: bank, brokerage, retirement, crypto, debts… each account can use its own currency. LifeOS reminds you daily, weekly or monthly to record "what's in each account right now", prefilled with last time's numbers so you only change what moved, and turns them into a net-worth chart and an allocation breakdown. Exchange rates can be entered by hand or fetched online with one click.
- **Timeline**: everything LifeOS recorded, in order: quests, focus, plan notes, reviews, mood, body, trackers, assets, research, achievements and level-ups. Search it, filter by category, or jump to a date. From the desktop heatmap, the mood calendar, focus charts, the review page, achievement dates and more, **any day can be opened** to see all of that day's records plus a cute 3D XP-blocks view.
- **Review**: optional, and one line counts. Today's highlight, what you learned, where you got stuck, gratitude, a rotating **Question of the day**, and tomorrow's one most important thing (add it to quests in one click; the next day you'll be asked whether you did it). Alongside, "the day in numbers" is filled in automatically (quests, focus, income, XP, mood, water, countdowns). Click a square on the purple **reflection heatmap** to go back to that day. There's also your review streak, words written, look-backs to a week, a month and a year ago, and your pet's day summary.
- **Mood**: tap your mood once a day (your pet will also ask in the evening). After a few weeks LifeOS finds what moves your mood, e.g. "on days you run, mood is 0.9 higher on average", "focus ≥ 3 hours", "water ≥ 6 glasses", with sample sizes. It also logs water, stretch breaks and pomodoros.
- **Trackers**: weight, running distance, reading, sleep… any number, in "latest reading" or "running total" mode, with targets and trend charts.
- **Reward Shop**: XP also mints coins (5 XP = 1 coin). Price the treats you want and buy them with coins.
- **Growth**: three tabs.
  - **The Road**: your level, per-attribute levels, and a horizontal road from Lv.1 to 60 with your pet standing where you are. 10 eras (Stardust · Sprout · Wanderer · Pathfinder · Artisan · Scholar · Sage · Master · Legend · Eternal), each with a title. Along the way you unlock 6 pet accessories, 5 desktop wallpapers and 6 planet upgrades (a second moon, a cottage, rings, a satellite, aurora, golden stardust). Crossing an unlock point pops a celebration where you can put it on right away.
  - **Trophy Hall**: **197 achievements in 16 categories** (quests, streaks, plans, goals, projects, research, focus, wealth, health, mood, review, trackers, growth, exploration, pet, hidden), grouped into series with tiers: bronze 59 · silver 57 · gold 49 · legendary 32. Achievement points, **Almost there**, category filters; hidden series show only "???" and a hint (late-night check-ins, not stopping on weekends…).
  - **Style**: titles (era titles plus special titles from the top tier of some series), pet accessories and desktop wallpapers, all switchable any time.
- **Settings**: almost everything can be changed.
  - **Sync**: end-to-end encrypted multi-device sync (see [SETUP §8](../SETUP.md#8-sync-between-devices)).
  - **AI**: connect OpenAI / Claude / DeepSeek / Kimi / GLM so your pet can write day summaries (see [SETUP §9](../SETUP.md#9-ai-pet-day-summary)).
  - **Dock & Desktop**: drag to reorder, show or hide apps (hidden apps still open from ⌘K); turn **desktop widgets** on or off one by one and the desktop re-flows.
  - **Attributes**: rename, change icon and colour, add or remove (3–10). When removing one, choose which attribute inherits its quests and earned XP.
  - **Work & Pay**: enter an hourly, daily, monthly or yearly rate and LifeOS works out the per-second speed. The "who you work for" list (employers, clients, projects) can be edited, each with its own rate, and Focus tallies income per project.
  - **Desktop Pet**: on/off, pick one of three, rename, activity level, water and stretch reminder intervals, pomodoro length, sounds, browser notifications.
  - **Week starts on** Monday or Sunday: heatmaps, the mood calendar, weekly plans and every "this week" figure follow it.
  - Plus English and Chinese (switching language also switches demo data and built-in content; what you wrote stays as written), light / dark / system theme, reduced motion, and JSON export / import backups.

## Desktop pets

Three original clay-style companions: **Mochi** (a bouncy orange mochi cat), **Bolt** (a jet-powered mint robot) and **Nova** (a tiny ringed purple planet).

- They wander the desktop on their own: **sitting on top of panels**, **peeking out from behind them** (ducking back now and then), napping with Zzz, chasing a ball. Their eyes follow your cursor.
- **Pick one up and drop it on any panel**. Click it for a menu: pet, +1 water, stretch, pomodoro, play, sleep.
- The 🐾 button in the menu bar (or **Find my pet** in ⌘K) **finds it instantly**: a spotlight and ripple, and the pet pops to the middle of the screen.
- They react to what happens in LifeOS: a happy hop when you earn XP, coins and stars on level-ups and achievements.
- **Health-based reminders**: about 2 L of water a day spread over your waking hours, with a nudge when you fall behind; a stretch reminder every 30–60 minutes of sitting (being away from the computer for 5+ minutes counts as a stretch); optional 20-20-20 eye breaks; a bedtime reminder (7–9 hours for adults). Plus pomodoros, asset check-ins when due, an evening mood check-in, and Monday / start-of-month nudges to plan. Everything is logged and used in the mood analysis.
- **Day summary**: click your pet → **Day summary**. It reads your day (quests, focus, income, plan progress, mood, body data and upcoming countdowns) and writes a short, fun recap in under 200 words, plus a little extra: on this day in history, a special day, or, when using Claude with web search, a recent news item related to what you did today. The text streams in word by word while the pet glows with stars around it; afterwards you can edit it and save it to that day's review with one click. **At midnight** it pops up the day's summary automatically (if you missed it, it offers to write one the next morning), and at 9:30 pm it gently reminds you to review. Both can be turned off. Without AI it writes an offline version.
- When an app window is open, the pet moves to the side or sits on the Dock so it never covers content; on phones it lives on the Dock. One switch in Settings turns it off.

## How small things move big goals

LifeOS isn't a pile of unrelated lists. The smallest check-in travels up this chain automatically, **with no progress to update by hand**:

```
 Daily quest ✓ ──┬──► logged to a tracker (e.g. "Run 5 km" → distance +5 km)
                 └──► counts toward a goal's "linked quest count"
 Focus timer ⏱ ──┬──► enough focus today ticks the quest (e.g. "Deep writing 90′")
                 └──► counts toward a goal's "focus hours"
 Tracker data ───────► a goal's tracker key result (run 400 km total / reach 68 kg)
 Papers · citations · income · net worth · level · streak ──► a goal's "system metric" key result
                                          │
                   all key results met ───┴─► "ready to claim" → claim XP → a flag on your planet
```

- **Goal = milestone + key results (OKR)**. Key results come from 5 sources: linked quest count, focus hours, tracker data, system metrics (citations / h-index / accepted papers / income / net worth / level / streak), or a manual count. All progress is computed live.
- Quests can be **scheduled by weekday** (e.g. run on Mon, Wed, Sat); unscheduled days don't break perfect days or streaks.
- Quests, focus sessions and tracker cards show which goal they're pushing (a small flag tag), and goal cards list the quests that drive them.
- A **weekly recap** is generated for you: XP and focus time vs. last week, your most consistent and most neglected habits, the goal closest to done, and habits not yet linked to any goal.
- On first launch LifeOS creates a "30-day streak" goal linked to starter habits, so you can see the chain working on day one.

## Layout & system

**Two desktop layouts** (switch with one click at the top right of the menu bar, or from the View menu, Settings or ⌘K): **Portrait** is a scrolling card feed; **Landscape** is a full-width dashboard that fits every widget into one screen (no scrolling at 1920×1080), with long cards scrolling inside themselves. The layout is remembered per device, so your laptop and your big monitor can each have their own. The **full-screen** button at the far top right leaves nothing on screen but LifeOS (Esc to exit).

System-level touches: a boot animation; a menu bar (streak, coins, level, clock); a Dock with magnification; windows (sized to their content with the desktop visible on both sides; click outside or press Esc to go back to the desktop; traffic-light buttons and double-click the title bar to enlarge; all adjustable in Settings); **⌘K / Ctrl+K spotlight search** (open apps, tick quests, start a timer, switch theme); system notifications (achievements, level-ups); floating +XP and confetti.

## Game rules (tweak them)

Every number lives in [`src/store/rules.ts`](../src/store/rules.ts):

| Action | XP |
| --- | --- |
| Daily / one-off quest | easy 10 · normal 25 · hard 50 |
| Perfect day (all daily habits done, at least 3) | +30 |
| Milestone reached | small 120 · big 400 · epic 1000 |
| Milestone step | 15 |
| Paper progress | writing 40 · submitted 150 · accepted 400 · published 120 |
| Focus (paid and unpaid) | 1 per minute; finishing a countdown you set adds minutes ÷ 5 (at least 5) |
| Daily review | 15; +10 more for 3 or more fields filled |
| Tracker entry | 5 per tracker per day |
| Mood check-in | 5 |
| Asset check-in | 20 |
| Water / stretch / pomodoro | 2 / 4 / 10 (daily caps apply) |
| Achievement unlocked | bronze 50 · silver 120 · gold 300 · legendary 800 |

Reaching level L takes `50 × L × (L − 1)` total XP. Coins = XP ÷ 5. All XP is recorded in a ledger de-duplicated by `ref`, so un-ticking something takes back exactly the XP it gave.

## Tech stack

Vite · React 19 · TypeScript · three.js (lazy-loaded) · a hand-written CSS design system (no UI framework) · lucide icons · Bricolage Grotesque + Manrope fonts.

```
src/
  os/        shell, menu bar, Dock, windows, spotlight search, notifications, boot and setup wizard
  apps/      Desktop / Quests / Plan / Projects / Roadmap / Research / Earn (Focus) / Trackers / Assets / Mood / Review / Timeline / Shop / Trophies (Growth) / Settings
  store/     data model, XP ledger and actions, game rules, achievements (achievements.ts), the road (progression.ts), linkage layer (links.ts), demo data
  pet/       desktop pets: SVG characters, behaviour engine, reminders and pomodoro, sounds
  scene/     three.js: low-poly planet, 3D focus donut, 3D XP blocks
  ai/        AI pet: provider config, day-summary generation (keys stay in the browser)
  sync/      end-to-end encrypted multi-device sync via Gist
  ui/        buttons, cards, progress, charts (area / bar / heatmap / radar), rolling numbers
  styles/    design tokens (light / dark), base components, system shell, per-app styles
```
