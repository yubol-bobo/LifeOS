/**
 * Where your XP actually comes from, over a period — the data behind any rebalancing.
 *
 * The ledger's kinds are split a bit finer here, because the questions are finer:
 *   paid work vs. project focus vs. pomodoros (all "time"), to-dos vs. project steps vs. habits,
 *   citations (passive) vs. paper stages you moved yourself.
 */
import { addDays, dayKey, daysBetween } from '../lib/date';
import { roleOf } from './tree';
import type { State, XpEvent } from './types';

export type SourceGroup = 'time' | 'done' | 'care' | 'passive';
export type SourceId = 'work' | 'focus' | 'deep' | 'pomo' | 'top' | 'project' | 'todo' | 'step' | 'daily' | 'perfect' | 'goal' | 'plan' | 'paper' | 'tracker' | 'reflect' | 'wellness' | 'assets' | 'cite' | 'import' | 'achievement';

export const SOURCES: Record<SourceId, { zh: string; en: string; icon: string; color: string; group: SourceGroup }> = {
  work: { zh: '赚钱计时', en: 'Paid work', icon: 'coins', color: 'jade', group: 'time' },
  focus: { zh: '项目专注', en: 'Project focus', icon: 'timer', color: 'teal', group: 'time' },
  deep: { zh: '深度专注加成', en: 'Deep focus bonus', icon: 'flame', color: 'orange', group: 'time' },
  pomo: { zh: '番茄钟', en: 'Pomodoros', icon: 'hourglass', color: 'red', group: 'time' },
  top: { zh: '要事加成', en: 'Top-three bonus', icon: 'star', color: 'amber', group: 'done' },
  project: { zh: '完成项目', en: 'Projects done', icon: 'briefcase', color: 'indigo', group: 'done' },
  todo: { zh: '一次性待办', en: 'To-dos', icon: 'target', color: 'orange', group: 'done' },
  step: { zh: '项目步骤', en: 'Project steps', icon: 'list-checks', color: 'indigo', group: 'done' },
  daily: { zh: '每日习惯', en: 'Daily habits', icon: 'refresh', color: 'amber', group: 'done' },
  perfect: { zh: '全勤日', en: 'Perfect days', icon: 'star', color: 'amber', group: 'done' },
  goal: { zh: '目标', en: 'Goals', icon: 'flag', color: 'blue', group: 'done' },
  plan: { zh: '计划', en: 'Plans', icon: 'calendar', color: 'teal', group: 'done' },
  paper: { zh: '论文与投稿', en: 'Papers & submissions', icon: 'graduation', color: 'violet', group: 'done' },
  tracker: { zh: '追踪', en: 'Trackers', icon: 'activity', color: 'pink', group: 'done' },
  reflect: { zh: '复盘与心情', en: 'Review & mood', icon: 'notebook', color: 'violet', group: 'care' },
  wellness: { zh: '喝水与起身', en: 'Water & breaks', icon: 'droplets', color: 'blue', group: 'care' },
  assets: { zh: '资产盘点', en: 'Asset check-ins', icon: 'landmark', color: 'jade', group: 'care' },
  cite: { zh: '新增引用', en: 'New citations', icon: 'trending-up', color: 'violet', group: 'passive' },
  import: { zh: '导入的旧论文', en: 'Imported papers', icon: 'download', color: 'slate', group: 'passive' },
  achievement: { zh: '成就奖励', en: 'Achievements', icon: 'trophy', color: 'amber', group: 'passive' },
};

export const GROUPS: Record<SourceGroup, { zh: string; en: string }> = {
  time: { zh: '花的时间', en: 'Time spent' },
  done: { zh: '做成的事', en: 'Things done' },
  care: { zh: '复盘与照顾自己', en: 'Reflection & self-care' },
  passive: { zh: '被动与奖励', en: 'Passive & bonuses' },
};

/** Which source an XP event belongs to. */
export function sourceOf(s: Pick<State, 'quests' | 'sessions'>, e: XpEvent, paid: Set<string>): SourceId | null {
  switch (e.kind) {
    case 'focus': {
      if (e.ref.startsWith('deep:')) return 'deep';
      const id = e.ref.split(':')[1];
      return paid.has(id) ? 'work' : 'focus';
    }
    case 'wellness':
      return e.ref.startsWith('well:pomos:') ? 'pomo' : 'wellness';
    case 'quest': {
      if (e.ref.startsWith('top:')) return 'top';
      const [, id, day] = e.ref.split(':');
      if (day) return 'daily';
      const q = s.quests.find((x) => x.id === id);
      return q && q.kind === 'once' && roleOf(q) === 'step' ? 'step' : 'todo';
    }
    case 'perfect':
      return e.ref.startsWith('top3:') ? 'top' : 'perfect';
    case 'project':
      return 'project';
    case 'milestone':
    case 'step':
      return 'goal';
    case 'plan':
      return 'plan';
    case 'paper':
      return e.ref.startsWith('cite:') ? 'cite' : e.ref.startsWith('paperimp:') ? 'import' : 'paper';
    case 'tracker':
      return 'tracker';
    case 'review':
    case 'mood':
      return 'reflect';
    case 'assets':
      return 'assets';
    case 'achievement':
      return 'achievement';
    default:
      return null; // rewards spend coins, they don't earn XP
  }
}

export interface SourceStats {
  from: string;
  to: string; // inclusive
  days: number; // days covered (shorter when your history is)
  total: number;
  activeDays: number; // days in the period that have any XP
  perDay: number; // per active day (a few back-dated goals shouldn't dilute it)
  sources: { id: SourceId; xp: number; n: number; share: number }[]; // biggest first, zero ones left out
  groups: { id: SourceGroup; xp: number; share: number }[];
  top: { label: string; xp: number; day: string; source: SourceId }[]; // the biggest single grants
  /** facts for the rebalancing questions */
  time: { daysOver4h: number; daysOver8h: number; activeDays: number; maxHours: number };
  pomoOverlap: { n: number; xp: number }; // pomodoros that ran while a focus timer was also running
  citePerDay: number;
}

export function xpSources(s: State, days: number | 'all', today = dayKey()): SourceStats {
  const first = s.events.length ? dayKey(Math.min(...s.events.map((e) => e.ts))) : today;
  const from = days === 'all' ? first : [addDays(today, -(days - 1)), first].sort()[1];
  const span = Math.max(1, daysBetween(from, today) + 1);
  const inRange = (ts: number) => {
    const d = dayKey(ts);
    return d >= from && d <= today;
  };
  const paid = new Set(s.sessions.filter((x) => x.rate > 0).map((x) => x.id));
  const by = new Map<SourceId, { xp: number; n: number }>();
  const top: SourceStats['top'] = [];
  let total = 0;
  const active = new Set<string>();
  for (const e of s.events) {
    if (e.xp <= 0 || !inRange(e.ts)) continue;
    const src = sourceOf(s, e, paid);
    if (!src) continue;
    const b = by.get(src) ?? { xp: 0, n: 0 };
    b.xp += e.xp;
    b.n += 1;
    by.set(src, b);
    total += e.xp;
    active.add(dayKey(e.ts));
    top.push({ label: e.label, xp: e.xp, day: dayKey(e.ts), source: src });
  }
  const sources = [...by.entries()].map(([id, b]) => ({ id, ...b, share: total ? b.xp / total : 0 })).sort((a, b) => b.xp - a.xp);
  const gsum = new Map<SourceGroup, number>();
  for (const x of sources) gsum.set(SOURCES[x.id].group, (gsum.get(SOURCES[x.id].group) ?? 0) + x.xp);
  const groups = (['time', 'done', 'care', 'passive'] as SourceGroup[]).map((id) => ({ id, xp: gsum.get(id) ?? 0, share: total ? (gsum.get(id) ?? 0) / total : 0 }));

  // focused / paid hours per day (by the day a session started)
  const hours = new Map<string, number>();
  for (const x of s.sessions) if (inRange(x.start)) hours.set(dayKey(x.start), (hours.get(dayKey(x.start)) ?? 0) + x.activeMs / 3_600_000);
  const hs = [...hours.values()];
  // pomodoros finished while a focus / work session was running
  const sess = s.sessions.filter((x) => inRange(x.start));
  let pn = 0;
  let pxp = 0;
  for (const e of s.events)
    if (e.kind === 'wellness' && e.ref.startsWith('well:pomos:') && inRange(e.ts) && sess.some((x) => e.ts >= x.start && e.ts <= x.end)) {
      pn++;
      pxp += e.xp;
    }

  return {
    from,
    to: today,
    days: span,
    total,
    activeDays: active.size,
    perDay: Math.round(total / Math.max(1, active.size)),
    sources,
    groups,
    top: top.sort((a, b) => b.xp - a.xp).slice(0, 5),
    time: { daysOver4h: hs.filter((h) => h > 4).length, daysOver8h: hs.filter((h) => h > 8).length, activeDays: hs.length, maxHours: hs.length ? Math.max(...hs) : 0 },
    pomoOverlap: { n: pn, xp: pxp },
    citePerDay: Math.round(((by.get('cite')?.xp ?? 0) / span) * 10) / 10,
  };
}
