import { addDays, dayKey } from '../lib/date';
import { filledSeries, netWorth } from './assets';
import type { Attr, Difficulty, MilestoneSize, PaperStatus, State } from './types';

/* ------------------------------------------------------------------ */
/* Economy                                                            */
/* ------------------------------------------------------------------ */

export const QUEST_XP: Record<Difficulty, number> = { easy: 10, normal: 25, hard: 50 };
export const MILESTONE_XP: Record<MilestoneSize, number> = { small: 120, big: 400, epic: 1000 };
export const STEP_XP = 15;
export const PERFECT_DAY_XP = 30;
export const TRACKER_XP = 5;
export const PAPER_XP: Partial<Record<PaperStatus, number>> = {
  drafting: 40,
  submitted: 150,
  accepted: 400,
  published: 120,
};
/** Coins are the spendable currency: 1 coin per 5 XP, rounded. */
export const coinsFor = (xp: number) => Math.max(1, Math.round(xp / 5));

/* ------------------------------------------------------------------ */
/* Levels                                                             */
/* ------------------------------------------------------------------ */

/** The top of the level road. */
export const MAX_LEVEL = 100;

/**
 * Cumulative XP required to *reach* level L: 40 · (L − 1)^2.2.
 * Early levels come quickly (Lv.2 = 40, Lv.10 ≈ 5k); at a steady ~400 XP a day Lv.20 takes about two
 * months, Lv.60 about two years and Lv.100 about six — a long road, not a weekend.
 */
export const xpForLevel = (L: number) => (L <= 1 ? 0 : Math.round(40 * (L - 1) ** 2.2));

export function levelInfo(xp: number) {
  let L = 1;
  while (L < MAX_LEVEL && xpForLevel(L + 1) <= xp) L++;
  const base = xpForLevel(L);
  if (L >= MAX_LEVEL) return { level: L, into: xp - base, span: Math.max(1, xp - base), progress: 1, next: base };
  const next = xpForLevel(L + 1);
  return { level: L, into: xp - base, span: next - base, progress: (xp - base) / (next - base), next };
}

/** Era name for a level (see progression.ts for the full road). */
export function levelTitle(level: number, lang: 'zh' | 'en') {
  const eras: [number, string, string][] = [
    [1, '星尘', 'Stardust'], [5, '萌芽', 'Sprout'], [10, '旅人', 'Wanderer'], [15, '探路者', 'Pathfinder'], [20, '学徒', 'Apprentice'],
    [25, '匠人', 'Artisan'], [30, '学者', 'Scholar'], [35, '远行者', 'Voyager'], [40, '守望者', 'Guardian'], [45, '贤者', 'Sage'],
    [50, '开拓者', 'Pioneer'], [55, '筑梦者', 'Dreamweaver'], [60, '大师', 'Master'], [65, '引路人', 'Luminary'], [70, '智者', 'Oracle'],
    [75, '传奇', 'Legend'], [80, '星辉', 'Starlight'], [85, '神话', 'Myth'], [90, '星海', 'Cosmos'], [100, '永恒', 'Eternal'],
  ];
  let t = eras[0];
  for (const row of eras) if (level >= row[0]) t = row;
  return lang === 'zh' ? t[1] : t[2];
}

/** Attribute level grows slower: sqrt curve. */
export const attrLevel = (xp: number) => Math.floor(Math.sqrt(xp / 40)) + 1;

/* ------------------------------------------------------------------ */
/* Derived metrics                                                    */
/* ------------------------------------------------------------------ */

export function hIndex(cites: number[]) {
  const s = [...cites].sort((a, b) => b - a);
  let h = 0;
  while (h < s.length && s[h] >= h + 1) h++;
  return h;
}

export function streakOf(completions: State['completions'], today = dayKey()) {
  const has = (k: string) => (completions[k]?.length ?? 0) > 0;
  let cur = 0;
  let d = has(today) ? today : addDays(today, -1);
  while (has(d)) {
    cur++;
    d = addDays(d, -1);
  }
  // best streak
  const keys = Object.keys(completions).filter(has).sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const k of keys) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current: cur, best: Math.max(best, cur) };
}

export function metrics(s: State) {
  let xp = 0;
  let coins = 0;
  const attrXp: Record<Attr, number> = Object.fromEntries(s.attributes.map((a) => [a.id, 0]));
  let perfectDays = 0;
  let rewardsRedeemed = 0;
  for (const e of s.events) {
    xp += e.xp;
    coins += e.coins;
    if (e.attr) attrXp[e.attr] += e.xp;
    if (e.kind === 'perfect') perfectDays++;
    if (e.kind === 'reward') rewardsRedeemed++;
  }
  const questsDone =
    Object.values(s.completions).reduce((n, ids) => n + ids.length, 0) + s.quests.filter((q) => q.doneAt).length;
  const cites = s.papers.filter((p) => !p.removed).map((p) => p.citations || 0);
  const totalCitations = cites.reduce((a, b) => a + b, 0);
  const focusMs = s.sessions.reduce((a, x) => a + x.activeMs, 0);
  const earned = s.sessions.reduce((a, x) => a + x.earned, 0);
  const streak = streakOf(s.completions);
  return {
    xp,
    coins,
    attrXp,
    level: levelInfo(xp),
    streak,
    perfectDays,
    rewardsRedeemed,
    questsDone,
    milestonesDone: s.milestones.filter((m) => m.status === 'done').length,
    papersSubmitted: s.papers.filter((p) => ['submitted', 'review', 'accepted', 'published'].includes(p.status)).length,
    papersPublished: s.papers.filter((p) => p.status === 'published' || p.status === 'accepted').length,
    totalCitations,
    hIndex: hIndex(cites),
    i10: cites.filter((c) => c >= 10).length,
    focusHours: focusMs / 3_600_000,
    earned,
    netWorth: netWorth(s, filledSeries(s).at(-1)?.snap),
    checkins: s.snapshots.length,
    moodDays: Object.keys(s.moods ?? {}).length,
    trackerEntries: s.trackers.reduce((a, t) => a + t.entries.length, 0),
  };
}

export type Metrics = ReturnType<typeof metrics>;
