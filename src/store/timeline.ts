/**
 * Everything LifeOS has ever recorded, as one chronological feed.
 * Sources are merged so nothing shows twice (e.g. a focus session appears once, with its duration
 * and earnings, not again as an XP line).
 */
import { dayKey } from '../lib/date';
import { filledSeries } from './assets';
import { reviewFilled } from './review';
import { levelInfo } from './rules';
import type { EventKind, State } from './types';

export type TlCat = 'quest' | 'focus' | 'plan' | 'review' | 'mood' | 'body' | 'track' | 'wealth' | 'growth' | 'research' | 'goal' | 'reward';

export interface TlEntry {
  id: string;
  ts: number;
  day: string;
  cat: TlCat;
  icon: string;
  color: string; // palette key
  title: string;
  detail?: string;
  xp?: number;
  value?: string; // "1h 20m", "$45", "72.1 kg"…
  kind?: EventKind; // ledger kind, when it came from the XP ledger
  attr?: string;
  mood?: number;
}

export const TL_CATS: { id: TlCat; zh: string; en: string; icon: string; color: string }[] = [
  { id: 'quest', zh: '任务', en: 'Quests', icon: 'list-checks', color: 'orange' },
  { id: 'focus', zh: '专注', en: 'Focus', icon: 'timer', color: 'jade' },
  { id: 'plan', zh: '计划进展', en: 'Plans', icon: 'calendar', color: 'teal' },
  { id: 'goal', zh: '目标', en: 'Goals', icon: 'flag', color: 'indigo' },
  { id: 'review', zh: '复盘', en: 'Reviews', icon: 'notebook', color: 'violet' },
  { id: 'mood', zh: '心情', en: 'Mood', icon: 'smile', color: 'teal' },
  { id: 'body', zh: '身体', en: 'Body', icon: 'droplets', color: 'blue' },
  { id: 'track', zh: '追踪', en: 'Trackers', icon: 'activity', color: 'pink' },
  { id: 'wealth', zh: '资产', en: 'Wealth', icon: 'landmark', color: 'jade' },
  { id: 'research', zh: '学术', en: 'Research', icon: 'graduation', color: 'violet' },
  { id: 'growth', zh: '成就与升级', en: 'Growth', icon: 'trophy', color: 'amber' },
  { id: 'reward', zh: '兑换', en: 'Rewards', icon: 'gift', color: 'red' },
];
const CAT = Object.fromEntries(TL_CATS.map((c) => [c.id, c])) as Record<TlCat, (typeof TL_CATS)[number]>;

const hm = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`;
};
const at = (day: string, h: number) => new Date(`${day}T00:00:00`).getTime() + h * 3_600_000;

export function buildTimeline(s: State, lang: 'zh' | 'en', money: (v: number) => string): TlEntry[] {
  const zh = lang === 'zh';
  const L = (a: string, b: string) => (zh ? a : b);
  const out: TlEntry[] = [];
  const push = (e: Omit<TlEntry, 'icon' | 'color' | 'day'> & { icon?: string; color?: string }) =>
    out.push({ icon: CAT[e.cat].icon, color: CAT[e.cat].color, day: dayKey(e.ts), ...e });

  // XP ledger — everything except what richer sources below already cover
  const covered = new Set<EventKind>(['focus', 'mood', 'review', 'tracker', 'assets', 'wellness']);
  const byKind: Partial<Record<EventKind, TlCat>> = { quest: 'quest', perfect: 'quest', milestone: 'goal', step: 'goal', paper: 'research', achievement: 'growth', plan: 'plan', reward: 'reward' };
  const sorted = [...s.events].sort((a, b) => a.ts - b.ts);
  let xp = 0;
  let lvl = 1;
  for (const e of sorted) {
    xp += e.xp;
    const now = levelInfo(xp).level;
    if (now > lvl) {
      push({ id: `lv:${now}:${e.id}`, ts: e.ts + 1, cat: 'growth', icon: 'trending-up', color: 'amber', title: L(`升到 Lv.${now}`, `Reached Lv.${now}`) });
      lvl = now;
    }
    if (covered.has(e.kind) || e.ref.startsWith('plannote:')) continue;
    const cat = byKind[e.kind] ?? 'growth';
    push({
      id: `ev:${e.id}`,
      ts: e.ts,
      cat,
      title: e.label,
      xp: e.xp > 0 ? e.xp : undefined,
      value: e.kind === 'reward' ? `${e.coins} 🪙` : undefined,
      kind: e.kind,
      attr: e.attr,
      ...(e.kind === 'perfect' ? { icon: 'star', color: 'amber' } : {}),
    });
  }
  // focus sessions (with duration and money)
  for (const x of s.sessions) {
    const name = x.note || s.projects.find((p) => p.id === x.projectId)?.name || L('专注', 'Focus');
    push({
      id: `fs:${x.id}`,
      ts: x.start,
      cat: 'focus',
      title: name,
      detail: x.rate ? L('赚钱的工作', 'Paid work') : L('不计薪的努力', 'Unpaid effort'),
      value: hm(x.activeMs) + (x.rate ? ` · ${money(x.earned)}` : ''),
      xp: Math.round(x.activeMs / 60_000) || undefined,
      kind: 'focus',
      attr: x.attr,
    });
  }
  // plan progress notes
  for (const p of s.plans)
    for (const l of p.log ?? [])
      push({
        id: `pl:${l.id}`,
        ts: l.ts,
        cat: 'plan',
        title: p.title,
        detail: l.note,
        value: l.amount ? `+${l.amount}${p.unit ? ` ${p.unit}` : ''}${p.target ? ` (${(p.log ?? []).filter((y) => y.ts <= l.ts).reduce((a, y) => a + y.amount, 0)}/${p.target})` : ''}` : undefined,
        kind: 'plan',
      });
  // reviews
  for (const [day, r] of Object.entries(s.reviews ?? {})) {
    if (!reviewFilled(r)) continue;
    const first = r.win || r.lesson || r.deep || r.grateful || r.friction || r.ai || '';
    push({ id: `rv:${day}`, ts: Math.min(r.updatedAt, at(day, 23.9)), cat: 'review', title: L('每日复盘', 'Daily review'), detail: first.split('\n')[0], value: L(`${reviewFilled(r)} 项`, `${reviewFilled(r)} prompts`), kind: 'review' });
  }
  // moods
  const MOOD = zh ? ['', '很糟', '低落', '一般', '不错', '超棒'] : ['', 'Awful', 'Low', 'Okay', 'Good', 'Great'];
  for (const [day, m] of Object.entries(s.moods ?? {})) push({ id: `md:${day}`, ts: m.ts || at(day, 21), cat: 'mood', title: `${L('心情', 'Mood')} · ${MOOD[m.v]}`, detail: m.note, mood: m.v, kind: 'mood' });
  // body: one line per day
  for (const [day, w] of Object.entries(s.wellness ?? {})) {
    if (!w.water && !w.breaks && !w.pomos) continue;
    const parts = [w.water && L(`喝水 ${w.water} 杯`, `${w.water} cups`), w.breaks && L(`起身 ${w.breaks} 次`, `${w.breaks} breaks`), w.pomos && L(`番茄 ${w.pomos} 个`, `${w.pomos} pomodoros`)].filter(Boolean);
    push({ id: `wl:${day}`, ts: at(day, 23.5), cat: 'body', title: L('身体', 'Body'), detail: parts.join(' · '), kind: 'wellness' });
  }
  // tracker readings
  for (const t of s.trackers) for (const e of t.entries) push({ id: `tr:${t.id}:${e.date}`, ts: at(e.date, 21), cat: 'track', title: t.name, value: `${e.value} ${t.unit}`, kind: 'tracker', attr: t.attr });
  // asset check-ins
  const series = filledSeries(s);
  series.forEach((x, i) => {
    const delta = i > 0 ? x.total - series[i - 1].total : 0;
    push({ id: `as:${x.snap.date}`, ts: x.snap.ts, cat: 'wealth', title: L('资产盘点', 'Net worth check-in'), value: money(x.total), detail: i > 0 ? `${delta >= 0 ? '+' : '−'}${money(Math.abs(delta))}` : undefined, kind: 'assets' });
  });
  // citations
  s.citationLog.forEach((c, i) => {
    const d = i > 0 ? c.total - s.citationLog[i - 1].total : 0;
    if (i > 0 && d === 0) return;
    push({ id: `ct:${c.date}`, ts: at(c.date, 8), cat: 'research', title: L('总引用', 'Citations'), value: String(c.total), detail: i > 0 ? `${d > 0 ? '+' : ''}${d}` : undefined });
  });
  // countdowns whose day has come (they leave the countdown list, so keep them here)
  const today = dayKey();
  for (const c of s.countdowns)
    if (!c.repeat && c.date <= today) push({ id: `cd:${c.id}`, ts: at(c.date, 0.01), cat: 'plan', icon: 'hourglass', color: c.color, title: L(`「${c.title}」这一天到了`, `“${c.title}” — the day arrived`) });
  return out.sort((a, b) => b.ts - a.ts);
}
