import { useSyncExternalStore } from 'react';
import { actions, getState, onCommit } from '../store/store';
import { cellsToObj, fromCells, merge, objToCells, sameCells, toCells, track, type Cells, type Meta } from './cells';
import { open as openEnv, saltOf, seal, WrongPassword, type Envelope } from './crypto';
import { createGist, findGist, GistError, readGist, writeGist } from './gist';

/* ------------------------------------------------------------------ */
/* Device-local config (never synced, never exported)                 */
/* ------------------------------------------------------------------ */

export interface SyncConfig {
  enabled: boolean;
  token: string;
  pass: string;
  gistId: string;
  device: string;
}

const CFG = 'lifeos:sync';
const META = 'lifeos:sync-meta';
const read = <T,>(k: string, d: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) || '') ?? d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

let cfg: SyncConfig | null = read<SyncConfig | null>(CFG, null);
let meta: Meta = read<Meta>(META, {});
let lastCells: Cells | null = null;
let remoteCache: { cells: Cells; meta: Meta; rev: number; etag: string; salt?: Uint8Array } | null = null;

export function defaultDeviceName() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Linux';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${br}`;
}

/* ------------------------------------------------------------------ */
/* Status (for the UI)                                                */
/* ------------------------------------------------------------------ */

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error';
  error?: string;
  lastSync?: number;
  rev?: number;
  device?: string;
  gistId?: string;
  lastDevice?: string;
}
let status: SyncStatus = cfg?.enabled ? { state: 'idle', device: cfg.device, gistId: cfg.gistId, lastSync: read<number>('lifeos:sync-last', 0) || undefined } : { state: 'off' };
const subs = new Set<() => void>();
const setStatus = (p: Partial<SyncStatus>) => {
  status = { ...status, ...p };
  subs.forEach((f) => f());
};
export const useSyncStatus = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => status,
  );
export const syncConfig = () => cfg;

/* ------------------------------------------------------------------ */
/* Change tracking                                                    */
/* ------------------------------------------------------------------ */

let pushTimer = 0;
let started = false;

export function initSync() {
  if (started) return;
  started = true;
  onCommit((prev, next) => {
    if (!cfg?.enabled) return;
    lastCells ??= toCells(prev);
    const nc = toCells(next);
    if (track(lastCells, nc, meta)) {
      write(META, meta);
      window.clearTimeout(pushTimer);
      pushTimer = window.setTimeout(() => void syncNow(), 3000);
    }
    lastCells = nc;
  });
  window.addEventListener('focus', () => void syncNow());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow());
  window.setInterval(() => document.visibilityState === 'visible' && void syncNow(), 60_000);
  if (cfg?.enabled) void syncNow();
}

/** Give every local cell a timestamp (used when connecting). */
function stampAll(t: number) {
  const c = toCells(getState());
  for (const k of c.keys()) if (!meta[k]) meta[k] = [t];
  lastCells = c;
  write(META, meta);
}

/* ------------------------------------------------------------------ */
/* Remote I/O                                                         */
/* ------------------------------------------------------------------ */

async function fetchRemote(c: SyncConfig) {
  const r = await readGist(c.token, c.gistId, remoteCache?.etag);
  if (!r.changed && remoteCache) return remoteCache;
  if (!r.content) return null;
  const env = JSON.parse(r.content) as Envelope;
  const plain = JSON.parse(await openEnv(env, c.pass)) as { rev: number; device: string; cells: Record<string, string>; meta: Meta };
  remoteCache = { cells: objToCells(plain.cells), meta: plain.meta, rev: plain.rev, etag: r.etag, salt: saltOf(env) };
  setStatus({ lastDevice: plain.device });
  return remoteCache;
}

async function pushRemote(c: SyncConfig, cells: Cells, m: Meta, rev: number) {
  const env = await seal(JSON.stringify({ rev, at: Date.now(), device: c.device, cells: cellsToObj(cells), meta: m }), c.pass, remoteCache?.salt);
  await writeGist(c.token, c.gistId, JSON.stringify(env));
  remoteCache = { cells, meta: { ...m }, rev, etag: '', salt: saltOf(env) };
}

function apply(cells: Cells, m: Meta) {
  meta = { ...m };
  write(META, meta);
  lastCells = cells;
  actions.replace(fromCells(cells));
}

const sameMeta = (a: Meta, b: Meta) => {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => b[k] && b[k][0] === a[k][0] && b[k][1] === a[k][1]);
};

/* ------------------------------------------------------------------ */
/* Sync                                                               */
/* ------------------------------------------------------------------ */

let busy = false;
let again = false;

export async function syncNow() {
  const c = cfg;
  if (!c?.enabled) return;
  if (busy) {
    again = true;
    return;
  }
  busy = true;
  setStatus({ state: 'syncing', error: undefined });
  try {
    const local = { cells: toCells(getState()), meta };
    lastCells ??= local.cells;
    const remote = await fetchRemote(c);
    if (!remote) await pushRemote(c, local.cells, meta, 1);
    else {
      const merged = merge(local, remote);
      if (!sameCells(merged.cells, local.cells)) apply(merged.cells, merged.meta);
      else if (!sameMeta(merged.meta, meta)) {
        meta = merged.meta;
        write(META, meta);
      }
      if (!sameCells(merged.cells, remote.cells) || !sameMeta(merged.meta, remote.meta)) await pushRemote(c, merged.cells, merged.meta, remote.rev + 1);
    }
    const now = Date.now();
    write('lifeos:sync-last', now);
    setStatus({ state: 'idle', lastSync: now, rev: remoteCache?.rev });
  } catch (e) {
    const msg = e instanceof WrongPassword ? 'wrong-password' : e instanceof GistError ? e.message : (e as Error).message || 'offline';
    setStatus({ state: 'error', error: msg });
  } finally {
    busy = false;
    if (again) {
      again = false;
      void syncNow();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Connect / disconnect                                               */
/* ------------------------------------------------------------------ */

export type ConnectResult = 'created' | 'joined' | 'choose';

/**
 * Connect this device. If a sync file already exists and this device also has real data,
 * returns 'choose' so the UI can ask: use the cloud copy, or merge both.
 */
export async function connect(input: { token: string; pass: string; device: string }, mode?: 'cloud' | 'merge'): Promise<ConnectResult> {
  const token = input.token.trim();
  const id = await findGist(token);
  const c: SyncConfig = { enabled: true, token, pass: input.pass, device: input.device.trim() || defaultDeviceName(), gistId: id ?? '' };
  remoteCache = null;
  if (!id) {
    meta = {};
    stampAll(Date.now());
    const env = await seal(JSON.stringify({ rev: 1, at: Date.now(), device: c.device, cells: cellsToObj(toCells(getState())), meta }), c.pass);
    c.gistId = await createGist(token, JSON.stringify(env));
    remoteCache = { cells: toCells(getState()), meta: { ...meta }, rev: 1, etag: '', salt: saltOf(env) };
    save(c);
    return 'created';
  }
  const remote = await fetchRemote(c); // throws WrongPassword before we touch anything
  const s = getState();
  const fresh = !s.onboarded || s.demo || s.events.length < 5;
  const m = mode ?? (fresh ? 'cloud' : undefined);
  if (!m) return 'choose';
  if (remote) {
    if (m === 'cloud') apply(remote.cells, remote.meta);
    else {
      meta = {};
      stampAll(1); // local data counts as older than anything already in the cloud
      const merged = merge({ cells: toCells(getState()), meta }, remote);
      apply(merged.cells, merged.meta);
    }
  }
  save(c);
  await syncNow();
  return 'joined';
}

function save(c: SyncConfig) {
  cfg = c;
  write(CFG, c);
  setStatus({ state: 'idle', device: c.device, gistId: c.gistId, error: undefined });
}

export function disconnect() {
  cfg = null;
  remoteCache = null;
  try {
    localStorage.removeItem(CFG);
  } catch {
    /* ignore */
  }
  setStatus({ state: 'off', error: undefined, lastSync: undefined, rev: undefined, gistId: undefined, device: undefined });
}

export function renameDevice(name: string) {
  if (!cfg) return;
  cfg = { ...cfg, device: name };
  write(CFG, cfg);
  setStatus({ device: name });
}
