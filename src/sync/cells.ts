/**
 * State ⇄ "cells" — the unit of sync.
 *
 * Every entity (a quest, a session, a mood day, a tracker reading, a settings section…) becomes one
 * cell with its own modification time. Merging two devices is then a per-cell last-writer-wins with
 * tombstones for deletions (an LWW-element-set CRDT): edits to different things never clobber each
 * other, and only the very same item edited on two devices is decided by time.
 */
import { defaultState } from '../store/store';
import type { State } from '../store/types';

export type Cells = Map<string, string>;
/** cell → [modified-at ms, deleted?] */
export type Meta = Record<string, [number, 1?]>;

type Keyed = Record<string, unknown>;

// Arrays of entities, how each is keyed, and whether user ordering matters.
const ARRAYS: { name: keyof State; key: (x: Keyed) => string; ordered: boolean; sort?: (a: Keyed, b: Keyed) => number }[] = [
  { name: 'quests', key: (x) => String(x.id), ordered: true },
  { name: 'milestones', key: (x) => String(x.id), ordered: true },
  { name: 'papers', key: (x) => String(x.id), ordered: true },
  { name: 'trackers', key: (x) => String(x.id), ordered: true },
  { name: 'rewards', key: (x) => String(x.id), ordered: true },
  { name: 'accounts', key: (x) => String(x.id), ordered: true },
  { name: 'projects', key: (x) => String(x.id), ordered: true },
  { name: 'attributes', key: (x) => String(x.id), ordered: true },
  // The XP ledger is keyed by `ref`, which is what makes it idempotent across devices.
  { name: 'events', key: (x) => String(x.ref), ordered: false, sort: (a, b) => Number(a.ts) - Number(b.ts) },
  { name: 'sessions', key: (x) => String(x.id), ordered: false, sort: (a, b) => Number(a.start) - Number(b.start) },
  { name: 'snapshots', key: (x) => String(x.date), ordered: false, sort: (a, b) => String(a.date).localeCompare(String(b.date)) },
  { name: 'citationLog', key: (x) => String(x.date), ordered: false, sort: (a, b) => String(a.date).localeCompare(String(b.date)) },
];
const RECORDS: (keyof State)[] = ['completions', 'moods', 'wellness', 'achievements'];
const SKIP = new Set<string>([...ARRAYS.map((a) => a.name), ...RECORDS]);

export function toCells(s: State): Cells {
  const c: Cells = new Map();
  for (const a of ARRAYS) {
    const list = ((s[a.name] as unknown as Keyed[]) ?? []).filter(Boolean);
    for (const x of list) {
      if (a.name === 'trackers') {
        // Tracker readings are their own cells so two devices can log the same tracker independently.
        const { entries, ...rest } = x as { entries: { date: string; value: number }[] };
        c.set(`trackers:${x.id}`, JSON.stringify(rest));
        for (const e of entries ?? []) c.set(`trk:${x.id}|${e.date}`, JSON.stringify(e.value));
      } else c.set(`${a.name}:${a.key(x)}`, JSON.stringify(x));
    }
    if (a.ordered) c.set(`${a.name}#order`, JSON.stringify(list.map(a.key)));
  }
  for (const r of RECORDS) for (const [k, v] of Object.entries((s[r] as Keyed) ?? {})) c.set(`${r}.${k}`, JSON.stringify(v));
  for (const [k, v] of Object.entries(s)) if (!SKIP.has(k)) c.set(`@${k}`, JSON.stringify(v ?? null));
  return c;
}

export function fromCells(c: Cells): State {
  const s = defaultState() as unknown as Keyed;
  const groups = new Map<string, Map<string, Keyed>>();
  const trk = new Map<string, { date: string; value: number }[]>();
  const records = new Map<string, Keyed>();
  for (const [k, v] of c) {
    if (k.startsWith('@')) {
      s[k.slice(1)] = JSON.parse(v);
      continue;
    }
    if (k.includes('#order')) continue;
    if (k.startsWith('trk:')) {
      const [id, date] = k.slice(4).split('|');
      if (!trk.has(id)) trk.set(id, []);
      trk.get(id)!.push({ date, value: JSON.parse(v) });
      continue;
    }
    const dot = k.indexOf('.');
    const colon = k.indexOf(':');
    if (dot > 0 && (colon < 0 || dot < colon) && RECORDS.includes(k.slice(0, dot) as keyof State)) {
      const r = k.slice(0, dot);
      if (!records.has(r)) records.set(r, {});
      records.get(r)![k.slice(dot + 1)] = JSON.parse(v);
      continue;
    }
    if (colon > 0) {
      const name = k.slice(0, colon);
      if (!groups.has(name)) groups.set(name, new Map());
      groups.get(name)!.set(k.slice(colon + 1), JSON.parse(v));
    }
  }
  for (const a of ARRAYS) {
    const items = groups.get(a.name) ?? new Map();
    let list: Keyed[];
    if (a.ordered) {
      const order: string[] = c.has(`${a.name}#order`) ? JSON.parse(c.get(`${a.name}#order`)!) : [];
      const seen = new Set<string>();
      list = [];
      for (const k of order) if (items.has(k) && !seen.has(k)) (seen.add(k), list.push(items.get(k)!));
      for (const [k, x] of items) if (!seen.has(k)) list.push(x); // added on the other device
    } else list = [...items.values()].sort(a.sort);
    if (a.name === 'trackers') for (const t of list) t.entries = (trk.get(String(t.id)) ?? []).sort((x, y) => x.date.localeCompare(y.date));
    s[a.name] = list;
  }
  for (const r of RECORDS) s[r] = records.get(r) ?? {};
  return s as unknown as State;
}

/** Stamp what changed between two cell sets (new/changed → now, gone → tombstone). */
export function track(prev: Cells, next: Cells, meta: Meta, now = Date.now()) {
  let changed = false;
  for (const [k, v] of next)
    if (prev.get(k) !== v) {
      meta[k] = [now];
      changed = true;
    }
  for (const k of prev.keys())
    if (!next.has(k)) {
      meta[k] = [now, 1];
      changed = true;
    }
  return changed;
}

/** Per-cell last-writer-wins. Ties go to the remote copy so every device converges on the same bytes. */
export function merge(local: { cells: Cells; meta: Meta }, remote: { cells: Cells; meta: Meta }) {
  const cells: Cells = new Map();
  const meta: Meta = {};
  const keys = new Set([...local.cells.keys(), ...remote.cells.keys(), ...Object.keys(local.meta), ...Object.keys(remote.meta)]);
  for (const k of keys) {
    const lm = local.meta[k] ?? [0];
    const rm = remote.meta[k] ?? [0];
    const useRemote = rm[0] > lm[0] || (rm[0] === lm[0] && (remote.cells.has(k) || rm[1] === 1));
    const m = useRemote ? rm : lm;
    const v = useRemote ? remote.cells.get(k) : local.cells.get(k);
    if (m[0] > 0) meta[k] = m;
    if (m[1] === 1) continue; // deleted
    const val = v ?? (useRemote ? local.cells.get(k) : remote.cells.get(k)); // un-timestamped data on one side only
    if (val !== undefined) cells.set(k, val);
  }
  return { cells, meta };
}

export function sameCells(a: Cells, b: Cells) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

export const cellsToObj = (c: Cells) => Object.fromEntries(c);
export const objToCells = (o: Record<string, string>): Cells => new Map(Object.entries(o));
