import { addDays, dayKey } from '../lib/date';
import { isScheduled } from './links';
import type { State } from './types';

/**
 * Mood correlations — "on days when X, your mood averages Y vs Z".
 * Plain difference of means with a minimum sample on both sides; it's a mirror,
 * not a study, and the UI says so.
 */
export interface MoodFactor {
  key: string;
  zh: string;
  en: string;
  icon: string;
  withAvg: number;
  withoutAvg: number;
  nWith: number;
  nWithout: number;
  diff: number;
}

export function moodFactors(s: State, days = 120): MoodFactor[] {
  const today = dayKey();
  const window = Array.from({ length: days }, (_, i) => addDays(today, -i)).filter((d) => s.moods[d]);
  if (window.length < 6) return [];

  const focusH = (d: string) => s.sessions.filter((x) => dayKey(x.start) === d).reduce((a, x) => a + x.activeMs, 0) / 3_600_000;
  const xp = (d: string) => s.events.filter((e) => e.xp > 0 && dayKey(e.ts) === d).reduce((a, e) => a + e.xp, 0);
  const well = (d: string) => s.wellness[d] ?? { water: 0, breaks: 0, pomos: 0, pomoMin: 0 };

  const factors: { key: string; zh: string; en: string; icon: string; test: (d: string) => boolean | null }[] = [
    { key: 'focus3', zh: '专注 ≥ 3 小时', en: 'Focused 3h+', icon: 'timer', test: (d) => focusH(d) >= 3 },
    { key: 'focus1', zh: '有专注记录', en: 'Any focus time', icon: 'timer', test: (d) => focusH(d) > 0 },
    { key: 'xp150', zh: '获得 ≥ 150 XP', en: 'Earned 150+ XP', icon: 'zap', test: (d) => xp(d) >= 150 },
    { key: 'water6', zh: '喝水 ≥ 6 杯', en: '6+ cups of water', icon: 'droplets', test: (d) => (s.wellness[d] ? well(d).water >= 6 : null) },
    { key: 'breaks3', zh: '起身活动 ≥ 3 次', en: '3+ stand-up breaks', icon: 'footprints', test: (d) => (s.wellness[d] ? well(d).breaks >= 3 : null) },
    { key: 'pomo2', zh: '完成 ≥ 2 个番茄', en: '2+ pomodoros', icon: 'timer', test: (d) => (s.wellness[d] ? well(d).pomos >= 2 : null) },
    { key: 'perfect', zh: '全勤日', en: 'Perfect days', icon: 'star', test: (d) => s.events.some((e) => e.ref === `perfect:${d}`) },
  ];
  for (const q of s.quests.filter((x) => x.kind === 'daily' && !x.archived))
    factors.push({ key: `q:${q.id}`, zh: `完成「${q.title}」`, en: `Did “${q.title}”`, icon: 'refresh', test: (d) => (isScheduled(q, d) ? (s.completions[d] ?? []).includes(q.id) : null) });
  for (const t of s.trackers) {
    const byDay = new Map(t.entries.map((e) => [e.date, e.value]));
    if (t.mode === 'total') factors.push({ key: `t:${t.id}`, zh: `有记录「${t.name}」`, en: `Logged ${t.name}`, icon: 'activity', test: (d) => byDay.has(d) });
    else if (t.goal != null)
      factors.push({
        key: `t:${t.id}`,
        zh: `${t.name}${t.lowerIsBetter ? ' ≤ ' : ' ≥ '}${t.goal}${t.unit}`,
        en: `${t.name}${t.lowerIsBetter ? ' ≤ ' : ' ≥ '}${t.goal}${t.unit}`,
        icon: 'activity',
        test: (d) => (byDay.has(d) ? (t.lowerIsBetter ? byDay.get(d)! <= t.goal! : byDay.get(d)! >= t.goal!) : null),
      });
  }

  const out: MoodFactor[] = [];
  for (const f of factors) {
    const yes: number[] = [];
    const no: number[] = [];
    for (const d of window) {
      const r = f.test(d);
      if (r === null) continue;
      (r ? yes : no).push(s.moods[d].v);
    }
    if (yes.length < 3 || no.length < 3) continue;
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const wa = avg(yes);
    const na = avg(no);
    out.push({ key: f.key, zh: f.zh, en: f.en, icon: f.icon, withAvg: wa, withoutAvg: na, nWith: yes.length, nWithout: no.length, diff: wa - na });
  }
  return out.filter((f) => Math.abs(f.diff) >= 0.15).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}
