import { daysBetween, dayKey, parseDay } from '../lib/date';
import type { PaletteKey, State } from './types';

export interface CountdownView {
  id: string;
  title: string;
  date: string; // next occurrence
  icon: string;
  color: PaletteKey;
  source: 'user' | 'goal' | 'project';
  projectId?: string;
  daysLeft: number;
  progress: number; // share of the waiting time already passed
  repeat?: boolean;
  editable: boolean;
}

function nextYearly(date: string, today: string) {
  const [, m, d] = date.split('-');
  let y = Number(today.slice(0, 4));
  let k = `${y}-${m}-${d}`;
  if (k < today) k = `${++y}-${m}-${d}`;
  return k;
}

/** Everything with a date ahead: your countdowns, goal target dates, project deadlines. */
export function upcoming(s: State, includePast = false): CountdownView[] {
  const today = dayKey();
  const out: CountdownView[] = [];
  const prog = (from: string, to: string) => {
    const total = daysBetween(from, to);
    return total <= 0 ? 1 : Math.max(0, Math.min(1, daysBetween(from, today) / total));
  };
  for (const c of s.countdowns) {
    const date = c.repeat === 'yearly' ? nextYearly(c.date, today) : c.date;
    const from = c.repeat === 'yearly' ? dayKey(new Date(parseDay(date).getFullYear() - 1, parseDay(date).getMonth(), parseDay(date).getDate())) : c.createdAt;
    out.push({ id: c.id, title: c.title, date, icon: c.icon, color: c.color, source: 'user', projectId: c.projectId, daysLeft: daysBetween(today, date), progress: prog(from, date), repeat: c.repeat === 'yearly', editable: true });
  }
  for (const m of s.milestones)
    if (m.status !== 'done' && m.targetDate)
      out.push({ id: `goal:${m.id}`, title: m.title, date: m.targetDate, icon: 'flag', color: 'orange', source: 'goal', projectId: m.projectId, daysLeft: daysBetween(today, m.targetDate), progress: prog(m.since ?? today, m.targetDate), editable: false });
  for (const p of s.projects)
    if (p.status !== 'done' && p.deadline)
      out.push({ id: `project:${p.id}`, title: p.name, date: p.deadline, icon: 'briefcase', color: p.color, source: 'project', projectId: p.id, daysLeft: daysBetween(today, p.deadline), progress: prog(p.createdAt ? dayKey(p.createdAt) : today, p.deadline), editable: false });
  return out.filter((c) => includePast || c.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft);
}
