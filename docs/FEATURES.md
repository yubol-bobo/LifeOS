# LifeOS feature guide

**English** · [中文](FEATURES.zh-CN.md)

> A detailed tour of every app, the desktop pets, how everything links together, and the XP rules. For a quick start see the [README](../README.md); for keys and sync see [SETUP.md](../SETUP.md).

**Contents**: [Apps](#apps) · [Desktop pets](#desktop-pets) · [How small things move big goals](#how-small-things-move-big-goals) · [Layout & system](#layout--system) · [Game rules](#game-rules-tweak-them) · [Tech stack](#tech-stack)

## Apps

LifeOS gathers the scattered systems of a life (daily to-dos, life milestones, papers and citations, work hours and income, body and reading data) into **one OS-style desktop**, and ties them together with game mechanics:

- **Desktop**: a greeting with your attribute radar and level card; a 3D "life planet" you can drag and spin (trees grow with your level, flags mark milestones you've reached, the moon orbits faster as your streak grows); today's quests; life progress bars (today / week / month / year / lifetime); today's earnings; **Time split**, a 3D donut of where today's focus went (paid work and projects), with the two optional daily goals; **Project progress** next to it: each project's done / total to-dos, overall %, today's focus and days left, with a ▶ to start focusing — choose which projects it shows; XP heatmap.
- **Plans**: year → month → week → today. A plan can have a numeric target (e.g. "read 8 books"); each step forward, click **+1 & note** to record the details (which book, which film, how much your bench press went up). Any quest (a daily habit or a one-off) can be linked to a week, month or year plan with an amount per completion — "Read +3 chapters" — so finishing it logs +3 there automatically (unticking takes it back) and invites a note. Amounts roll up: what's logged on a plan also counts toward its parent plans in the same unit (week → month → year), so you never update the bigger plans by hand. Each level can be broken down from the one above it, and weekly items go to today's quests with one click (**To today**). Finishing lower levels pushes the higher ones forward; when everything is done the plan ticks itself and awards XP (week 30 / month 80 / year 200). Plans that fall behind the calendar are flagged. Year plans can link to goals, whose key-result progress counts toward them.
- **Countdowns**: deadlines, trips, birthdays (optionally yearly)… goal and project due dates appear automatically, and your pet reminds you 7, 3 and 1 day before, and on the day.
- **Projects**: research, work, life, or any category you define (editable). Projects are long-running: their **steps** (with optional due dates) live in the project and never fill up Today's quests. A project pulls together its quests, plans at every level, goals, papers, countdowns, focus time and income. Projects are also the "who you work for" list in Focus, each with its own optional rate.
- **Quests**: what you plan to do today — daily habits and one-off tasks, added in one line (start with `!` for a daily habit). XP depends on difficulty; finishing everything scheduled for the day triggers a **Perfect day** bonus. You can look back and catch up on earlier days.
- **Roadmap**: active goals (key results, live progress, countdowns, steps you can break down, rewards to claim), milestones you've reached, and **life in weeks**: about 4,400 squares, one per week of a life, with milestones marked on them. **Click any square you've lived** to open that week: XP, entries, days recorded, focus time, a 7-day strip (click a day for its full record) and every record of the week.
- **Research**: a paper board (idea → writing → submitted → under review → accepted → published, with XP at every step). **Drag a card to another column** to change its stage (on phones, press and hold, then drag); every stage change is recorded with its date, each card shows how long it has been in its current stage (e.g. "in review · 23 days"), the paper's editor lists the full stage history with editable dates, and the moves appear in the Timeline; total citations, h-index and i10 computed automatically; a citation chart; one-click sync of papers and citation counts from **OpenAlex** or **Semantic Scholar**. With Google Scholar sync, **every paper has its own citation curve**: open a paper (in Research, from its card on the Projects board, or from a project's page, where each paper also shows a small trend line) to see its Google Scholar count day by day since tracking began.
- **Earn** and **focus on projects**: two places. **Earn** (dock: coins) is paid work: earnings roll up by the second, a coin drops every 15 minutes, and each project can have its own rate. **Projects** is where every other kind of focus starts: each project card (and each card on the board) has a **Focus** button that starts the clock right away, and **Quick start** picks cover regular activities outside any project (the gym, reading…; rename, re-icon, re-assign, reorder, add or delete them). The running session shows at the top of Projects with pause / stop / discard and a countdown. A project with its own rate starts a paid session in Earn instead. Both earn 1 XP per minute and can link to a quest, goal or project. Both Earn and Projects start with a **countdown** you build by stacking +15 min / +30 min / +1 h (three taps on +1 h = 3 hours) or a custom value, or count up with it off; you can keep adding while it runs. When it reaches zero the session ends and is logged automatically (paid work is cashed out, counting exactly the countdown), with a full-screen celebration, bonus XP and "another round". **Pause and switch**: starting another task pauses the running one and sets it aside under **Paused**, where you can resume it (its countdown picks up where it left off), finish and log it, or discard it; the menu bar shows a ⏸ pill while something is paused. **Daily goals** for paid work and for project focus are separate and optional: set or turn them off by clicking them on the Time split tile, in Earn or in Projects. **Where the effort went** (in Projects) is a 3D donut you can drag and spin: each slice's angle is its share of time and its height grows with that share, and the outer ring colour separates paid (green) from project time (violet). Hover to lift a slice, click to pin it; filter to paid or projects. Ranges: today, yesterday, this week, plus last week, this month, last month, all time or any custom dates. For ranges longer than a day, **stacked bars** show each day's time by activity (weeks or months for very long ranges); click a bar to see that day's donut and **each focus session** (start–end time, activity, duration, earnings or XP). The menu-bar pill and the browser tab title show live earnings or the countdown. **Projects** also has a **board** (Planning / In progress / Done, research papers placed by stage): drag a card to change its status (the time is recorded) and add a project right in the Planning column.
- **Assets**: bank, brokerage, retirement, crypto, debts… each account can use its own currency. LifeOS reminds you daily, weekly or monthly to record "what's in each account right now", prefilled with last time's numbers so you only change what moved, and turns them into a net-worth chart and an allocation breakdown. Exchange rates can be entered by hand or fetched online with one click.
- **Timeline**: everything LifeOS recorded, in order: quests, focus, plan notes, reviews, mood, body, trackers, assets, research, achievements and level-ups. Search it, filter by category, or jump to a date. From the desktop heatmap, the mood calendar, focus charts, the review page, achievement dates and more, **any day can be opened** to see all of that day's records plus a cute 3D XP-blocks view.
- **Review**: optional, and one line counts. Today's highlight, what you learned, where you got stuck, gratitude, a rotating **Question of the day**, and tomorrow's one most important thing (add it to quests in one click; the next day you'll be asked whether you did it). Alongside, "the day in numbers" is filled in automatically (quests, focus, income, XP, mood, water, countdowns). Click a square on the purple **reflection heatmap** to go back to that day. There's also your review streak, words written, look-backs to a week, a month and a year ago, and your pet's day summary.
- **Mood**: tap your mood once a day (your pet will also ask in the evening). After a few weeks LifeOS finds what moves your mood, e.g. "on days you run, mood is 0.9 higher on average", "focus ≥ 3 hours", "water ≥ 6 glasses", with sample sizes. It also logs water, stretch breaks and pomodoros.
- **Trackers**: weight, running distance, reading, sleep… any number, in "latest reading" or "running total" mode, with targets and trend charts.
- **Reward Shop**: XP also mints coins (5 XP = 1 coin). Price the treats you want and buy them with coins.
- **Growth**: three tabs.
  - **The Road**: your level, per-attribute levels, and a horizontal road from Lv.1 to 100 with your pet standing where you are. 20 eras (Stardust · Sprout · Wanderer · Pathfinder · Apprentice · Artisan · Scholar · Voyager · Guardian · Sage · Pioneer · Dreamweaver · Master · Luminary · Oracle · Legend · Starlight · Myth · Cosmos · Eternal), each with a title. Along the way you unlock 11 pet accessories, 11 desktop wallpapers and 6 planet upgrades (a second moon, a cottage, rings, a satellite, aurora, golden stardust). The road is long on purpose: at a steady ~400 XP a day, Lv.20 takes about two months, Lv.60 about two years and Lv.100 about six. Crossing an unlock point pops a celebration where you can put it on right away.
  - **Trophy Hall**: **199 achievements in 16 categories** (quests, streaks, plans, goals, projects, research, focus, wealth, health, mood, review, trackers, growth, exploration, pet, hidden), grouped into series with tiers: bronze 59 · silver 57 · gold 49 · legendary 34. Achievement points, **Almost there**, category filters; hidden series show only "???" and a hint (late-night check-ins, not stopping on weekends…).
  - **Style**: titles (era titles plus special titles from the top tier of some series), pet accessories and desktop wallpapers, all switchable any time.
- **Settings**: almost everything can be changed.
  - **Sync**: end-to-end encrypted multi-device sync (see [SETUP §8](../SETUP.md#8-sync-between-devices)).
  - **AI**: connect OpenAI / Claude / DeepSeek / Kimi / GLM so your pet can write day summaries (see [SETUP §9](../SETUP.md#9-ai-pet-day-summary)).
  - **Dock & Desktop**: drag to reorder, show or hide apps (hidden apps still open from ⌘K); turn **desktop widgets** on or off one by one and the desktop re-flows. **Edit desktop layout** (View menu, or here): drag any tile to a new place and drag its bottom-right corner to make it wider, narrower, taller or shorter; the tile's size shows in the corner as you go. Landscape and portrait keep separate layouts (in portrait only the width changes, as height follows the content); **Reset** brings back the built-in layout; Esc or **Done** to finish.
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
- **Day summary**: click your pet → **Day summary**. It reads your day (quests, focus, income, plan progress, mood, body data and upcoming countdowns) and writes a short, fun recap, ending with a **✨ wander** line: starting from something you did today, it drifts to a recent news story, this day in history, a quote or a line of poetry, a romantic or playful thought, some cheering on or a bit of life wisdom, leaning towards different kinds each time (so **Regenerate** gives you a new flavour). Turn on **Go online for inspiration** in Settings → AI and it works with every provider: the browser fetches recent news and "on this day" from Wikipedia, and Claude, OpenAI, Kimi and GLM can also use their own web search. Without a key, the offline summary ends with a hand-picked quote or line of poetry. The text streams in word by word while the pet glows with stars around it; afterwards you can edit it and save it to that day's review with one click. **At midnight** it pops up the day's summary automatically (if you missed it, it offers to write one the next morning), and at 9:30 pm it gently reminds you to review. Both can be turned off. Without AI it writes an offline version.
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

Reaching level L takes `40 × (L − 1)^2.2` total XP (Lv.100 is the top). Papers synced from Google Scholar / OpenAlex / Semantic Scholar count as past work: 30 XP each, with full stage XP only for stages they reach afterwards in LifeOS. Coins = XP ÷ 5. All XP is recorded in a ledger de-duplicated by `ref`, so un-ticking something takes back exactly the XP it gave.

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
