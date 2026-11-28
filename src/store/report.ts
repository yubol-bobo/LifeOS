import { addDays, dayKey, dayStartTs, parseDay } from '../lib/date';
import { effortRows, type EffortRow } from '../apps/effort';
import { ACH_BY_ID, type Achievement } from './achievements';
import { filledSeries } from './assets';
import { isScheduled } from './links';
import { levelInfo } from './rules';
import type { Attr, State, WorkSession } from './types';

/**
 * A month's or a year's story, computed from what LifeOS already recorded: XP and levels, quests,
 * achievements, where the time went, plans and goals, papers, mood, reviews and net worth.
 */

export type ReportKind = 'month' | 'quarter' | 'year';

export interface PeriodReport {
  kind: ReportKind;
  key: string; // 2026-11 · 2026-Q4 · 2026
  first: string;
  last: string; // last day counted (today if the period isn't over)
  partial: boolean; // the period is still running
  days: string[];
  xp: number;
  coins: number;
  levelFrom: number;
  levelTo: number;
  dailiesDone: number;
  dailiesDue: number;
  onceDone: number;
  questsDone: number;
  perfectDays: number;
  activeDays: number; // days with any quest done
  bestStreak: number;
  topHabits: { title: string; done: number; due: number }[];
  achievements: { a: Achievement; ts: number }[];
  focusMs: number;
  paidMs: number;
  earned: number;
  activities: EffortRow[];
  longest?: WorkSession & { label: string };
  plans: string[];
  milestones: string[];
  papers: string[];
  citations: number | null;
  moodAvg: number | null;
  moodDays: number;
  reviews: number;
  netWorthDelta: number | null;
  netWorthEnd: number | null;
  bestDay?: { day: string; xp: number };
  xpByDay: Record<string, number>;
  xpByAttr: { attr: Attr; xp: number }[];
  months?: { key: string; xp: number; focusMs: number; quests: number }[]; // year reports
}

const pad = (n: number) => String(n).padStart(2, '0');
export function periodBounds(kind: ReportKind, key: string) {
  if (kind === 'year') return { first: `${key}-01-01`, end: `${+key + 1}-01-01` };
  if (kind === 'quarter') {
    const [y, q] = [+key.slice(0, 4), +key.slice(6)];
    const m = (q - 1) * 3 + 1;
    return { first: `${y}-${pad(m)}-01`, end: q === 4 ? `${y + 1}-01-01` : `${y}-${pad(m + 3)}-01` };
  }
  const [y, m] = key.split('-').map(Number);
  const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { first: `${key}-01`, end };
}

export const currentKey = (kind: ReportKind, d: Date = parseDay(dayKey())) => (kind === 'year' ? String(d.getFullYear()) : kind === 'quarter' ? `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}` : dayKey(d).slice(0, 7));
/** The period of a kind that contains a given day. */
export const keyOfDay = (kind: ReportKind, day: string) => currentKey(kind, parseDay(day));
export function shiftKey(kind: ReportKind, key: string, n: number) {
  if (kind === 'year') return String(+key + n);
  if (kind === 'quarter') {
    const i = +key.slice(0, 4) * 4 + +key.slice(6) - 1 + n;
    return `${Math.floor(i / 4)}-Q${(i % 4) + 1}`;
  }
  const [y, m] = key.split('-').map(Number);
  const t = new Date(y, m - 1 + n, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
}

export function periodReport(s: State, kind: ReportKind, key: string, fallback = 'Focus'): PeriodReport {
  const { first, end } = periodBounds(kind, key);
  const today = dayKey();
  const partial = today < addDays(end, -1) && today >= first;
  const last = partial ? today : addDays(end, -1);
  const from = dayStartTs(first);
  const to = dayStartTs(addDays(last, 1));
  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  // by the day a moment belongs to (which respects when your day starts), not by midnight
  const inRange = (ts: number) => {
    const k = dayKey(ts);
    return k >= first && k <= last;
  };

  // XP, coins, levels
  const evs = s.events.filter((e) => inRange(e.ts));
  const xp = evs.reduce((a, e) => a + e.xp, 0);
  const coins = evs.reduce((a, e) => a + Math.max(0, e.coins), 0);
  const before = s.events.filter((e) => e.ts < from).reduce((a, e) => a + e.xp, 0);
  const xpByDay: Record<string, number> = {};
  const byAttr = new Map<Attr, number>();
  for (const e of evs) {
    if (e.xp <= 0) continue;
    const d = dayKey(e.ts);
    xpByDay[d] = (xpByDay[d] ?? 0) + e.xp;
    if (e.attr) byAttr.set(e.attr, (byAttr.get(e.attr) ?? 0) + e.xp);
  }
  const bestDay = Object.entries(xpByDay).sort((a, b) => b[1] - a[1])[0];

  // quests
  let dailiesDone = 0;
  let dailiesDue = 0;
  let bestStreak = 0;
  let run = 0;
  let activeDays = 0;
  const habit = new Map<string, { title: string; done: number; due: number }>();
  const dailyIds = new Set(s.quests.filter((q) => q.kind === 'daily').map((q) => q.id));
  const onceByDay = new Map<string, number>();
  for (const q of s.quests) if (q.kind === 'once' && q.doneAt && inRange(q.doneAt)) onceByDay.set(dayKey(q.doneAt), (onceByDay.get(dayKey(q.doneAt)) ?? 0) + 1);
  for (const d of days) {
    const done = new Set((s.completions[d] ?? []).filter((id) => dailyIds.has(id)));
    dailiesDone += done.size;
    for (const q of s.quests) {
      if (!isScheduled(q, d) || q.createdAt > parseDay(addDays(d, 1)).getTime()) continue;
      dailiesDue++;
      const h = habit.get(q.id) ?? { title: q.title, done: 0, due: 0 };
      h.due++;
      if (done.has(q.id)) h.done++;
      habit.set(q.id, h);
    }
    const any = done.size + (onceByDay.get(d) ?? 0) > 0;
    if (any) activeDays++;
    run = any ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
  }
  const onceDone = [...onceByDay.values()].reduce((a, b) => a + b, 0);
  const topHabits = [...habit.values()].filter((h) => h.due >= Math.min(5, days.length)).sort((a, b) => b.done / b.due - a.done / a.due || b.done - a.done).slice(0, 3);

  // achievements
  const achievements = Object.entries(s.achievements)
    .filter(([, ts]) => inRange(ts))
    .map(([id, ts]) => ({ a: ACH_BY_ID.get(id)!, ts }))
    .filter((x) => x.a)
    .sort((a, b) => ['mythic', 'gold', 'silver', 'bronze'].indexOf(a.a.tier) - ['mythic', 'gold', 'silver', 'bronze'].indexOf(b.a.tier) || a.ts - b.ts);

  // time
  const sessions = s.sessions.filter((x) => inRange(x.start));
  const activities = effortRows(s.sessions, s.projects, null, from, fallback, to);
  const focusMs = sessions.reduce((a, x) => a + x.activeMs, 0);
  const paidMs = sessions.filter((x) => x.rate > 0).reduce((a, x) => a + x.activeMs, 0);
  const earned = sessions.reduce((a, x) => a + x.earned, 0);
  const lx = [...sessions].sort((a, b) => b.activeMs - a.activeMs)[0];
  const longest = lx ? { ...lx, label: lx.note || s.projects.find((p) => p.id === lx.projectId)?.name || fallback } : undefined;

  // plans, goals, papers
  const plans = evs.filter((e) => e.kind === 'plan' && e.xp > 0 && e.ref.startsWith('plan:')).map((e) => e.label); // completions, not progress notes
  const milestones = s.milestones.filter((m) => m.status === 'done' && m.doneAt && m.doneAt >= first && m.doneAt <= last).map((m) => m.title);
  const papers = evs.filter((e) => e.kind === 'paper' && e.xp > 0).map((e) => e.label);
  const citeAt = (d: string) => [...s.citationLog].reverse().find((c) => c.date <= d)?.total;
  const c1 = citeAt(last);
  const c0 = citeAt(addDays(first, -1)) ?? (s.citationLog.find((c) => c.date >= first && c.date <= last)?.total ?? undefined);
  const citations = c1 != null && c0 != null ? c1 - c0 : null;

  // mood, reviews, money
  const moods = days.map((d) => s.moods[d]?.v).filter((v): v is NonNullable<typeof v> => v != null);
  const moodAvg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const reviews = days.filter((d) => s.reviews[d]).length;
  const series = filledSeries(s);
  const nwAt = (d: string) => [...series].reverse().find((x) => x.snap.date <= d)?.total;
  const n1 = nwAt(last);
  const n0 = nwAt(addDays(first, -1));
  const netWorthDelta = n1 != null && n0 != null ? n1 - n0 : null;

  // per month (year reports)
  let months: PeriodReport['months'];
  if (kind !== 'month') {
    months = [];
    for (let mk = first.slice(0, 7); `${mk}-01` < end; mk = shiftKey('month', mk, 1)) {
      if (`${mk}-01` > last) break;
      const b = periodBounds('month', mk);
      const f = dayStartTs(b.first);
      const t = dayStartTs(b.end);
      months.push({
        key: mk,
        xp: s.events.filter((e) => e.xp > 0 && dayKey(e.ts) >= b.first && dayKey(e.ts) < b.end).reduce((a, e) => a + e.xp, 0),
        focusMs: s.sessions.filter((x) => x.start >= f && x.start < t).reduce((a, x) => a + x.activeMs, 0),
        quests: Object.entries(s.completions).filter(([d]) => d.startsWith(mk)).reduce((a, [, ids]) => a + ids.length, 0) + s.quests.filter((q) => q.kind === 'once' && q.doneAt && q.doneAt >= f && q.doneAt < t).length,
      });
    }
  }

  return {
    kind,
    key,
    first,
    last,
    partial,
    days,
    xp,
    coins,
    levelFrom: levelInfo(before).level,
    levelTo: levelInfo(before + xp).level,
    dailiesDone,
    dailiesDue,
    onceDone,
    questsDone: dailiesDone + onceDone,
    perfectDays: evs.filter((e) => e.kind === 'perfect' && e.xp > 0).length,
    activeDays,
    bestStreak,
    topHabits,
    achievements,
    focusMs,
    paidMs,
    earned,
    activities,
    longest,
    plans,
    milestones,
    papers,
    citations,
    moodAvg,
    moodDays: moods.length,
    reviews,
    netWorthDelta,
    netWorthEnd: n1 ?? null,
    bestDay: bestDay ? { day: bestDay[0], xp: bestDay[1] } : undefined,
    xpByDay,
    xpByAttr: [...byAttr.entries()].map(([attr, xp]) => ({ attr, xp })).sort((a, b) => b.xp - a.xp),
    months,
  };
}

/** Is there anything worth a report in this period? */
export const hasContent = (r: PeriodReport) => r.xp > 0 || r.questsDone > 0 || r.focusMs > 0 || r.achievements.length > 0;
