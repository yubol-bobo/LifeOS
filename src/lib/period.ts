import { addDays, dayKey, getWeekStart, parseDay } from './date';
import type { PlanScope } from '../store/types';

/* Periods: '2026' · '2026-11' · '2026-W45'.
 * Weeks are numbered like ISO weeks. With Monday as the first day they are exactly ISO weeks; with
 * Sunday first, week N runs from the Sunday before ISO week N's Monday to the Saturday after it. */

function isoWeek(d: Date): { year: number; week: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { year: t.getUTCFullYear(), week: Math.ceil(((t.getTime() - y0.getTime()) / 86_400_000 + 1) / 7) };
}

export function periodOf(scope: PlanScope, d: Date | string = new Date()): string {
  const x = typeof d === 'string' ? parseDay(d) : d;
  if (scope === 'year') return String(x.getFullYear());
  if (scope === 'month') return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  // a Sunday-first week shares its number with the ISO week of its Monday (the next day)
  const w = isoWeek(getWeekStart() === 0 && x.getDay() === 0 ? new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1) : x);
  return `${w.year}-W${String(w.week).padStart(2, '0')}`;
}

export function scopeOf(period: string): PlanScope {
  return period.includes('W') ? 'week' : period.length === 4 ? 'year' : 'month';
}

/** First and last day (inclusive) of a period. */
export function range(period: string): [string, string] {
  const sc = scopeOf(period);
  if (sc === 'year') return [`${period}-01-01`, `${period}-12-31`];
  if (sc === 'month') {
    const [y, m] = period.split('-').map(Number);
    return [`${period}-01`, dayKey(new Date(y, m, 0))];
  }
  const [y, w] = period.split('-W').map(Number);
  // Monday of ISO week 1 = the Monday on or before Jan 4.
  const jan4 = new Date(y, 0, 4);
  const mon = new Date(y, 0, 4 - ((jan4.getDay() + 6) % 7) + (w - 1) * 7);
  const start = addDays(dayKey(mon), getWeekStart() === 0 ? -1 : 0);
  return [start, addDays(start, 6)];
}

export function shift(period: string, n: number): string {
  const sc = scopeOf(period);
  if (sc === 'year') return String(Number(period) + n);
  if (sc === 'month') {
    const [y, m] = period.split('-').map(Number);
    return periodOf('month', new Date(y, m - 1 + n, 1));
  }
  return periodOf('week', addDays(range(period)[0], n * 7));
}

/** The period one scale up that "owns" this one (a week belongs to the month of its Thursday). */
export function parentPeriod(period: string): string | null {
  const sc = scopeOf(period);
  if (sc === 'year') return null;
  if (sc === 'month') return period.slice(0, 4);
  return periodOf('month', addDays(range(period)[0], getWeekStart() === 0 ? 4 : 3));
}

/** How far through the period we are (0..1). */
export function elapsed(period: string, now = new Date()): number {
  const [a, b] = range(period);
  const t0 = parseDay(a).getTime();
  const t1 = parseDay(addDays(b, 1)).getTime();
  return Math.max(0, Math.min(1, (now.getTime() - t0) / (t1 - t0)));
}

export function periodLabel(period: string, lang: 'zh' | 'en'): string {
  const sc = scopeOf(period);
  if (sc === 'year') return lang === 'zh' ? `${period} 年` : period;
  if (sc === 'month') {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long' });
  }
  const [a, b] = range(period);
  const f = (k: string) => parseDay(k).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
  const w = Number(period.split('-W')[1]);
  return lang === 'zh' ? `第 ${w} 周 · ${f(a)} – ${f(b)}` : `Week ${w} · ${f(a)} – ${f(b)}`;
}
