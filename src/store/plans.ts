/**
 * Plan roll-up.  Year → Month → Week → today's quests.
 *
 * A plan item's progress is the average of whatever is attached to it:
 *   - its children one scale down (their own progress, recursively)
 *   - quests pulled from it (one-off: done/not; daily habits: completion rate over the period)
 *   - a linked goal (that goal's key-result progress)
 * With nothing attached it is simply done or not. Reaching 100% completes it automatically.
 */
import { addDays, dayKey } from '../lib/date';
import { elapsed, range } from '../lib/period';
import { goalProgress, isScheduled } from './links';
import { metrics, type Metrics } from './rules';
import type { Plan, Project, State } from './types';

export const PLAN_XP = { week: 30, month: 80, year: 200 } as const;

export interface PlanProgress {
  pct: number;
  count?: number; // counted plans: sum of logged amounts
  target?: number;
  parts: number;
  children: Plan[];
  quests: number;
  questsDone: number;
}

export const planCount = (p: Plan) => (p.log ?? []).reduce((a, l) => a + (l.amount || 0), 0);

export function planProgress(s: State, p: Plan, mx: Metrics = metrics(s), depth = 0): PlanProgress {
  const children = s.plans.filter((x) => x.parentId === p.id);
  // A counted plan ("read 8 books") is measured by what was logged — linked quests log into it.
  if (p.target && p.target > 0) {
    const count = planCount(p);
    const qs = s.quests.filter((q) => q.planId === p.id && !q.archived);
    return { pct: Math.min(1, count / p.target), parts: 1, children, quests: qs.length, questsDone: qs.filter((q) => q.doneAt).length, count, target: p.target };
  }
  const vals: number[] = [];
  for (const c of children) vals.push(depth > 3 ? (c.done ? 1 : 0) : planProgressValue(s, c, mx, depth + 1));
  const qs = s.quests.filter((q) => q.planId === p.id && !q.archived);
  let qDone = 0;
  if (qs.length) {
    const [a, b] = range(p.period);
    let sum = 0;
    for (const q of qs) {
      if (q.kind === 'once') {
        const v = q.doneAt ? 1 : 0;
        sum += v;
        qDone += v;
      } else {
        let due = 0;
        let hit = 0;
        for (let d = a; d <= b && d <= dayKey(); d = addDays(d, 1))
          if (isScheduled(q, d)) {
            due++;
            if (s.completions[d]?.includes(q.id)) hit++;
          }
        const v = due ? hit / due : 0;
        sum += v;
        if (v >= 1) qDone++;
      }
    }
    vals.push(sum / qs.length);
  }
  if (p.goalId) {
    const g = s.milestones.find((m) => m.id === p.goalId);
    if (g) vals.push(g.status === 'done' ? 1 : (goalProgress(s, g, mx).pct ?? 0));
  }
  const pct = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : p.done ? 1 : 0;
  return { pct: p.done && !vals.length ? 1 : pct, parts: vals.length, children, quests: qs.length, questsDone: qDone };
}

const planProgressValue = (s: State, p: Plan, mx: Metrics, depth: number) => (p.done && !p.auto ? 1 : planProgress(s, p, mx, depth).pct);

/** Is this plan behind schedule? (progress well below how much of its period has passed) */
export function planPace(s: State, p: Plan, mx?: Metrics) {
  const pr = planProgress(s, p, mx);
  const el = elapsed(p.period);
  return { ...pr, elapsed: el, behind: !p.done && pr.parts > 0 && pr.pct + 0.2 < el };
}

/** Project overview numbers. */
export function projectStats(s: State, pr: Project) {
  const tasks = s.quests.filter((q) => q.projectId === pr.id && !q.archived);
  const open = tasks.filter((q) => q.kind === 'once' && !q.doneAt);
  const doneTasks = tasks.filter((q) => q.kind === 'once' && q.doneAt);
  const sessions = s.sessions.filter((x) => x.projectId === pr.id);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const plans = s.plans.filter((p) => p.projectId === pr.id);
  const goals = s.milestones.filter((m) => m.projectId === pr.id);
  const papers = s.papers.filter((p) => p.projectId === pr.id);
  const mx = metrics(s);
  const parts: number[] = [];
  const once = tasks.filter((q) => q.kind === 'once');
  if (once.length) parts.push(doneTasks.length / once.length);
  for (const g of goals) parts.push(g.status === 'done' ? 1 : (goalProgress(s, g, mx).pct ?? 0));
  for (const p of plans.filter((x) => !x.parentId || !plans.some((y) => y.id === x.parentId))) parts.push(planProgress(s, p, mx).pct);
  return {
    tasks,
    open,
    doneTasks,
    plans,
    goals,
    papers,
    hoursWeek: sessions.filter((x) => x.start >= weekAgo).reduce((a, x) => a + x.activeMs, 0) / 3_600_000,
    hoursAll: sessions.reduce((a, x) => a + x.activeMs, 0) / 3_600_000,
    earned: sessions.reduce((a, x) => a + x.earned, 0),
    pct: parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : pr.status === 'done' ? 1 : null,
  };
}
