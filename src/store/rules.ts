import { addDays, dayKey } from '../lib/date';
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

/** Cumulative XP required to *reach* level L. L1 = 0, L2 = 100, L3 = 300, L4 = 600 … */
export const xpForLevel = (L: number) => 50 * L * (L - 1);

export function levelInfo(xp: number) {
  let L = 1;
  while (xpForLevel(L + 1) <= xp) L++;
  const base = xpForLevel(L);
  const next = xpForLevel(L + 1);
  return { level: L, into: xp - base, span: next - base, progress: (xp - base) / (next - base), next };
}

export const LEVEL_TITLES: [number, string, string][] = [
  [1, '新手旅人', 'Wanderer'],
  [5, '探路者', 'Pathfinder'],
  [10, '筑梦匠人', 'Artisan'],
  [15, '远行者', 'Voyager'],
  [20, '学者', 'Sage'],
  [30, '大师', 'Master'],
  [40, '传奇', 'Legend'],
  [60, '永恒', 'Eternal'],
];

export function levelTitle(level: number, lang: 'zh' | 'en') {
  let t = LEVEL_TITLES[0];
  for (const row of LEVEL_TITLES) if (level >= row[0]) t = row;
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
  const attrXp: Record<Attr, number> = { mind: 0, body: 0, wealth: 0, craft: 0, bond: 0, spirit: 0 };
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
  const cites = s.papers.map((p) => p.citations || 0);
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
    trackerEntries: s.trackers.reduce((a, t) => a + t.entries.length, 0),
  };
}

export type Metrics = ReturnType<typeof metrics>;

/* ------------------------------------------------------------------ */
/* Achievements                                                       */
/* ------------------------------------------------------------------ */

export type Tier = 'bronze' | 'silver' | 'gold' | 'mythic';

export interface Achievement {
  id: string;
  icon: string; // lucide icon name (see ui/Icon)
  tier: Tier;
  zh: [string, string];
  en: [string, string];
  target: number;
  value: (m: Metrics) => number;
  xp: number;
}

const A = (
  id: string,
  icon: string,
  tier: Tier,
  zh: [string, string],
  en: [string, string],
  target: number,
  value: (m: Metrics) => number,
): Achievement => ({ id, icon, tier, zh, en, target, value, xp: { bronze: 50, silver: 120, gold: 300, mythic: 800 }[tier] });

export const ACHIEVEMENTS: Achievement[] = [
  A('first-quest', 'sparkles', 'bronze', ['第一步', '完成第一个任务'], ['First Step', 'Complete your first quest'], 1, (m) => m.questsDone),
  A('quest-100', 'list-checks', 'silver', ['日积月累', '累计完成 100 个任务'], ['Compound Interest', 'Complete 100 quests'], 100, (m) => m.questsDone),
  A('quest-500', 'crown', 'gold', ['千锤百炼', '累计完成 500 个任务'], ['Relentless', 'Complete 500 quests'], 500, (m) => m.questsDone),
  A('streak-7', 'flame', 'bronze', ['连续七天', '连续 7 天完成任务'], ['Week On Fire', 'Keep a 7-day streak'], 7, (m) => m.streak.best),
  A('streak-30', 'flame', 'silver', ['月度不断', '连续 30 天完成任务'], ['Unbroken Month', 'Keep a 30-day streak'], 30, (m) => m.streak.best),
  A('streak-100', 'flame', 'mythic', ['百日筑基', '连续 100 天完成任务'], ['Hundred Days', 'Keep a 100-day streak'], 100, (m) => m.streak.best),
  A('perfect-10', 'star', 'silver', ['完美主义', '10 个全勤日'], ['Perfectionist', 'Finish every daily quest on 10 days'], 10, (m) => m.perfectDays),
  A('milestone-1', 'flag', 'bronze', ['里程碑', '达成第一个人生里程碑'], ['Milestone', 'Reach your first life milestone'], 1, (m) => m.milestonesDone),
  A('milestone-10', 'mountain', 'gold', ['登高望远', '达成 10 个里程碑'], ['Summit Collector', 'Reach 10 milestones'], 10, (m) => m.milestonesDone),
  A('paper-submit', 'send', 'bronze', ['投出去了', '第一次投稿'], ['Hit Submit', 'Submit your first paper'], 1, (m) => m.papersSubmitted),
  A('paper-pub', 'book-open', 'silver', ['白纸黑字', '第一篇论文被接收'], ['In Print', 'Get your first paper accepted'], 1, (m) => m.papersPublished),
  A('paper-10', 'library', 'gold', ['著作等身', '10 篇论文被接收'], ['Prolific', 'Get 10 papers accepted'], 10, (m) => m.papersPublished),
  A('cite-100', 'quote', 'silver', ['被看见', '总引用达到 100'], ['Being Read', 'Reach 100 citations'], 100, (m) => m.totalCitations),
  A('cite-1000', 'telescope', 'mythic', ['学术影响力', '总引用达到 1,000'], ['Influence', 'Reach 1,000 citations'], 1000, (m) => m.totalCitations),
  A('h-10', 'sigma', 'gold', ['h 指数 10', 'h-index 达到 10'], ['h-index 10', 'Reach an h-index of 10'], 10, (m) => m.hIndex),
  A('focus-10', 'timer', 'bronze', ['专注入门', '累计专注 10 小时'], ['Warming Up', 'Focus for 10 hours'], 10, (m) => m.focusHours),
  A('focus-100', 'hourglass', 'gold', ['深度工作', '累计专注 100 小时'], ['Deep Work', 'Focus for 100 hours'], 100, (m) => m.focusHours),
  A('focus-1000', 'gem', 'mythic', ['万时定律', '累计专注 1,000 小时'], ['Mastery Clock', 'Focus for 1,000 hours'], 1000, (m) => m.focusHours),
  A('earn-1k', 'coins', 'silver', ['第一桶金', '工作计时累计收入 1,000'], ['First Thousand', 'Earn 1,000 with the wage timer'], 1000, (m) => m.earned),
  A('earn-10k', 'landmark', 'gold', ['五位数', '工作计时累计收入 10,000'], ['Five Figures', 'Earn 10,000 with the wage timer'], 10000, (m) => m.earned),
  A('level-5', 'trending-up', 'bronze', ['渐入佳境', '达到 5 级'], ['Getting Good', 'Reach level 5'], 5, (m) => m.level.level),
  A('level-15', 'rocket', 'silver', ['远行', '达到 15 级'], ['Lift Off', 'Reach level 15'], 15, (m) => m.level.level),
  A('level-30', 'orbit', 'mythic', ['轨道之上', '达到 30 级'], ['In Orbit', 'Reach level 30'], 30, (m) => m.level.level),
  A('reward-1', 'gift', 'bronze', ['犒劳自己', '在商店兑换第一个奖励'], ['Treat Yourself', 'Redeem your first reward'], 1, (m) => m.rewardsRedeemed),
  A('tracker-30', 'activity', 'silver', ['数据控', '记录 30 条追踪数据'], ['Quantified Self', 'Log 30 tracker entries'], 30, (m) => m.trackerEntries),
];

export const TIER_LABEL: Record<Tier, [string, string]> = {
  bronze: ['青铜', 'Bronze'],
  silver: ['白银', 'Silver'],
  gold: ['黄金', 'Gold'],
  mythic: ['传说', 'Mythic'],
};
