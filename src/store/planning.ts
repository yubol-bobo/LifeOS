/**
 * Planning insights for the morning plan:
 *   - capacity: how many things you usually finish in a day (median of recent active days)
 *   - overload: today's list is clearly more than that
 *   - stale: to-dos that keep getting carried over
 *   - focus: the Human 3.0 quadrant that's furthest behind, and which of today's items feed it
 */
import { addDays, dayKey, daysBetween } from '../lib/date';
import { assessments, QUADS, quadOf, stepOf } from './h3';
import { questDay } from './links';
import type { H3Quad, Quest, State } from './types';

/** Things finished per day over the last `days` days (days with nothing done are left out). */
export function doneCounts(s: State, today = dayKey(), days = 21): number[] {
  const from = addDays(today, -days);
  const per = new Map<string, number>();
  for (const q of s.quests) if (q.kind === 'once' && q.doneAt) {
    const d = dayKey(q.doneAt);
    if (d >= from && d < today) per.set(d, (per.get(d) ?? 0) + 1);
  }
  for (const [d, ids] of Object.entries(s.completions)) if (d >= from && d < today) per.set(d, (per.get(d) ?? 0) + ids.length);
  return [...per.values()];
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

export interface Capacity {
  typical: number; // median finished per active day
  days: number; // active days it's based on
  planned: number;
  over: boolean; // planned clearly exceeds what you usually finish
}

/** Is today's list realistic? Needs at least 5 active days of history to say anything. */
export function capacity(s: State, planned: number, today = dayKey()): Capacity | null {
  const xs = doneCounts(s, today);
  if (xs.length < 5) return null;
  const typical = Math.round(median(xs));
  return { typical, days: xs.length, planned, over: planned > Math.max(typical * 1.5, typical + 3) };
}

/** Open to-dos carried over for `min` days or more, oldest first, with how long. */
export function staleTodos(todos: Quest[], today = dayKey(), min = 3) {
  return todos
    .map((q) => ({ q, days: daysBetween(questDay(q), today) }))
    .filter((x) => x.days >= min)
    .sort((a, b) => b.days - a.days);
}

/** The quadrant furthest behind in the latest Human 3.0 assessment (ties: the first in Mind→Vocation order). */
export function h3Focus(s: State): { quad: H3Quad; step: number; next?: string } | null {
  const a = assessments(s).at(-1);
  if (!a) return null;
  let best: H3Quad = QUADS[0];
  for (const q of QUADS) if (stepOf(a.quads[q]) < stepOf(a.quads[best])) best = q;
  // all equal: nothing stands out
  if (QUADS.every((q) => stepOf(a.quads[q]) === stepOf(a.quads[best]))) return null;
  return { quad: best, step: stepOf(a.quads[best]), next: a.quads[best].next };
}

/** Does this quest feed that quadrant (via its attribute)? */
export const feeds = (s: State, q: Quest, quad: H3Quad) => quadOf(s, q.attr) === quad;
