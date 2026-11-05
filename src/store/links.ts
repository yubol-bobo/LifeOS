/**
 * The linkage layer: how small daily actions roll up into mid- and long-term goals.
 *
 *   quest ✓ ──┬─► tracker entry (quest.log)          ──┐
 *             └─► goal "quests" key result            │
 *   focus ⏱ ──┬─► quest auto-complete (quest.focusMin) ├─► milestone progress ─► claim ─► XP / planet flag
 *             └─► goal "focus" key result              │
 *   tracker ──────► goal "tracker" key result         │
 *   papers / citations / earnings / level ─► "metric" ┘
 *
 * Everything here is derived — nothing is stored twice.
 */
import { addDays, dayKey, parseDay, startOfWeek } from '../lib/date';
import { metrics, type Metrics } from './rules';
import type { Attr, KeyResult, Milestone, Quest, State } from './types';

export const weekday = (day: string) => (parseDay(day).getDay() + 6) % 7; // 0 = Mon

export function isScheduled(q: Quest, day: string) {
  return q.kind === 'daily' && !q.archived && (!q.days?.length || q.days.includes(weekday(day)));
}

export function scheduledDailies(s: State, day = dayKey()) {
  return s.quests.filter((q) => isScheduled(q, day));
}

/* ------------------------------------------------------------------ */
/* Goal progress                                                      */
/* ------------------------------------------------------------------ */

export interface KrProgress {
  kr: KeyResult | null; // null = the step checklist
  value: number;
  target: number;
  pct: number;
  start?: number; // for "lower is better" trackers
}

export interface GoalProgress {
  pct: number | null; // null = no measurable parts
  parts: KrProgress[];
  ready: boolean; // every part complete but not yet claimed
  linkedQuests: Quest[];
}

const clamp = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export function krValue(s: State, m: Milestone, kr: KeyResult, mx: Metrics): KrProgress {
  const since = m.since ?? '0000';
  switch (kr.kind) {
    case 'quests': {
      const linked = new Set(s.quests.filter((q) => q.goalId === m.id).map((q) => q.id));
      let n = 0;
      for (const [day, ids] of Object.entries(s.completions)) if (day >= since) n += ids.filter((id) => linked.has(id)).length;
      n += s.quests.filter((q) => linked.has(q.id) && q.kind === 'once' && q.doneAt && dayKey(q.doneAt) >= since).length;
      return { kr, value: n, target: kr.target, pct: clamp(n / kr.target) };
    }
    case 'focus': {
      const ms = s.sessions.filter((x) => x.goalId === m.id && dayKey(x.start) >= since).reduce((a, x) => a + x.activeMs, 0);
      const h = ms / 3_600_000;
      return { kr, value: h, target: kr.target, pct: clamp(h / kr.target) };
    }
    case 'tracker': {
      const t = s.trackers.find((x) => x.id === kr.trackerId);
      if (!t || !t.entries.length) return { kr, value: 0, target: kr.target, pct: 0 };
      const inWindow = t.entries.filter((e) => e.date >= since);
      if (t.mode === 'total') {
        const v = inWindow.reduce((a, e) => a + e.value, 0);
        return { kr, value: v, target: kr.target, pct: clamp(v / kr.target) };
      }
      const latest = t.entries[t.entries.length - 1].value;
      if (t.lowerIsBetter) {
        const start = (inWindow[0] ?? t.entries[0]).value;
        const pct = start <= kr.target ? (latest <= kr.target ? 1 : 0) : (start - latest) / (start - kr.target);
        return { kr, value: latest, target: kr.target, pct: clamp(pct), start };
      }
      return { kr, value: latest, target: kr.target, pct: clamp(latest / kr.target) };
    }
    case 'metric': {
      const v =
        kr.metric === 'citations'
          ? mx.totalCitations
          : kr.metric === 'hIndex'
            ? mx.hIndex
            : kr.metric === 'papers'
              ? mx.papersPublished
              : kr.metric === 'earned'
                ? mx.earned
                : kr.metric === 'level'
                  ? mx.level.level
                  : kr.metric === 'netWorth'
                    ? mx.netWorth
                    : mx.streak.best;
      return { kr, value: v, target: kr.target, pct: clamp(v / kr.target) };
    }
    case 'manual':
    default: {
      const v = kr.current ?? 0;
      return { kr, value: v, target: kr.target, pct: clamp(v / kr.target) };
    }
  }
}

export function goalProgress(s: State, m: Milestone, mx: Metrics = metrics(s)): GoalProgress {
  const parts: KrProgress[] = [];
  if (m.steps.length) {
    const done = m.steps.filter((x) => x.done).length;
    parts.push({ kr: null, value: done, target: m.steps.length, pct: done / m.steps.length });
  }
  for (const kr of m.krs ?? []) parts.push(krValue(s, m, kr, mx));
  const pct = parts.length ? parts.reduce((a, p) => a + p.pct, 0) / parts.length : m.status === 'done' ? 1 : null;
  return {
    pct,
    parts,
    ready: m.status !== 'done' && parts.length > 0 && parts.every((p) => p.pct >= 1),
    linkedQuests: s.quests.filter((q) => q.goalId === m.id && !q.archived),
  };
}

export function readyGoals(s: State) {
  const mx = metrics(s);
  return s.milestones.filter((m) => goalProgress(s, m, mx).ready).map((m) => m.id);
}

/* ------------------------------------------------------------------ */
/* Weekly review — generated, never typed                             */
/* ------------------------------------------------------------------ */

export interface Insight {
  icon: string;
  tone: Attr | 'accent' | 'gold';
  zh: string;
  en: string;
}

export function weeklyReview(s: State) {
  const today = dayKey();
  const sow = dayKey(startOfWeek());
  const span = Math.max(0, Math.round((parseDay(today).getTime() - parseDay(sow).getTime()) / 86_400_000));
  const lastSow = addDays(sow, -7);
  const lastEnd = addDays(lastSow, span);
  const inThis = (d: string) => d >= sow && d <= today;
  const inLast = (d: string) => d >= lastSow && d <= lastEnd;

  const sumXp = (f: (d: string) => boolean) => s.events.filter((e) => e.xp > 0 && f(dayKey(e.ts))).reduce((a, e) => a + e.xp, 0);
  const sumFocus = (f: (d: string) => boolean) => s.sessions.filter((x) => f(dayKey(x.start))).reduce((a, x) => a + x.activeMs, 0) / 3_600_000;
  const xpThis = sumXp(inThis);
  const xpLast = sumXp(inLast);
  const focusThis = sumFocus(inThis);
  const focusLast = sumFocus(inLast);

  const attrThis: Partial<Record<Attr, number>> = {};
  for (const e of s.events) if (e.attr && e.xp > 0 && inThis(dayKey(e.ts))) attrThis[e.attr] = (attrThis[e.attr] ?? 0) + e.xp;
  const topAttr = (Object.entries(attrThis) as [Attr, number][]).sort((a, b) => b[1] - a[1])[0]?.[0];

  // habit consistency over the last 14 scheduled days
  const window = Array.from({ length: 14 }, (_, i) => addDays(today, -i - 1));
  const rates = s.quests
    .filter((q) => q.kind === 'daily' && !q.archived)
    .map((q) => {
      const days = window.filter((d) => isScheduled(q, d));
      const done = days.filter((d) => s.completions[d]?.includes(q.id)).length;
      return { q, rate: days.length ? done / days.length : 0, n: days.length };
    })
    .filter((r) => r.n >= 3)
    .sort((a, b) => b.rate - a.rate);

  const mx = metrics(s);
  const goals = s.milestones
    .filter((m) => m.status !== 'done')
    .map((m) => ({ m, p: goalProgress(s, m, mx) }))
    .filter((g) => g.p.pct != null);
  const closest = [...goals].sort((a, b) => b.p.pct! - a.p.pct!)[0];

  const insights: Insight[] = [];
  if (rates[0] && rates[0].rate >= 0.6)
    insights.push({ icon: 'flame', tone: rates[0].q.attr, zh: `最稳定的习惯：「${rates[0].q.title}」，近两周完成 ${Math.round(rates[0].rate * 100)}%。`, en: `Most consistent habit: “${rates[0].q.title}” — ${Math.round(rates[0].rate * 100)}% over two weeks.` });
  const weak = rates[rates.length - 1];
  if (weak && weak.rate < 0.5 && weak !== rates[0])
    insights.push({ icon: 'activity', tone: weak.q.attr, zh: `「${weak.q.title}」有点掉队（${Math.round(weak.rate * 100)}%）。考虑降低难度或只安排在固定几天。`, en: `“${weak.q.title}” is slipping (${Math.round(weak.rate * 100)}%). Try making it easier or schedule fewer days.` });
  if (closest && closest.p.pct! < 1)
    insights.push({ icon: 'flag', tone: closest.m.attr, zh: `离达成最近的目标：「${closest.m.title}」，已完成 ${Math.round(closest.p.pct! * 100)}%。`, en: `Closest goal: “${closest.m.title}” at ${Math.round(closest.p.pct! * 100)}%.` });
  const orphan = s.quests.filter((q) => q.kind === 'daily' && !q.archived && !q.goalId).length;
  if (orphan && goals.length)
    insights.push({ icon: 'route', tone: 'accent', zh: `${orphan} 个每日习惯还没有关联到任何目标——关联后它们会自动推动目标进度。`, en: `${orphan} daily habits aren't linked to a goal yet — link them and they'll push goal progress automatically.` });

  return { xpThis, xpLast, focusThis, focusLast, topAttr, insights };
}
