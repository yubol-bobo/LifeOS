import type { ActiveSession, Project, WorkSession } from '../store/types';

/** Where the focused time went, grouped by activity (shared by the Focus app and the desktop tile). */
export interface EffortRow {
  id: string;
  label: string;
  ms: number;
  paid: boolean;
  earned: number;
  n: number;
}

export const SLICE_COLORS = ['orange', 'blue', 'jade', 'violet', 'amber', 'pink', 'teal', 'indigo', 'red', 'lime', 'brown', 'slate'];

export const cssVar = (name: string, fallback: string) => {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  } catch {
    return fallback;
  }
};

export function effortRows(
  sessions: WorkSession[],
  projects: Project[],
  live: { active: ActiveSession; ms: number; paid: boolean; earned: number } | null,
  from: number,
  fallback: string,
  to = Infinity,
): EffortRow[] {
  const rows = new Map<string, EffortRow>();
  const add = (label: string, ms: number, paid: boolean, earned: number) => {
    const id = `${paid ? 'p' : 'f'}:${label}`;
    const r = rows.get(id) ?? { id, label, ms: 0, paid, earned: 0, n: 0 };
    r.ms += ms;
    r.earned += earned;
    r.n += 1;
    rows.set(id, r);
  };
  const nameOf = (x: { note?: string; projectId?: string }) => x.note || projects.find((p) => p.id === x.projectId)?.name || fallback;
  for (const x of sessions) if (x.start >= from && x.start < to) add(nameOf(x), x.activeMs, x.rate > 0, x.earned);
  const now = Date.now();
  if (live && now >= from && now < to) add(nameOf(live.active), live.ms, live.paid, live.earned);
  return [...rows.values()].sort((a, b) => b.ms - a.ms);
}

/** The activity id a session is grouped under (same as the rows above). */
export const effortIdOf = (x: { note?: string; projectId?: string; rate: number }, projects: Project[], fallback: string) =>
  `${x.rate > 0 ? 'p' : 'f'}:${x.note || projects.find((p) => p.id === x.projectId)?.name || fallback}`;

/** A stable colour per activity: its position in the full (unfiltered) list. */
export const sliceColor = (all: EffortRow[], id: string) => cssVar(`--p-${SLICE_COLORS[Math.max(0, all.findIndex((r) => r.id === id)) % SLICE_COLORS.length]}`, '#888');
