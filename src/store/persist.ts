import { useSyncExternalStore } from 'react';

/**
 * Where LifeOS keeps its data in this browser.
 *
 * Primary: IndexedDB (room for years of records, unlike localStorage's ~5 MB). A copy also stays
 * in localStorage while it fits, so start-up stays instant and there's a fallback. Each save is
 * stamped; at start-up the newer of the two wins. A save that fails anywhere is never silent:
 * it shows in the status below (and the app warns). Once a day a compressed backup of the whole
 * state is kept (30 days) and can be restored from Settings → Data.
 */

export const LS_KEY = 'lifeos:v1';
const LS_AT = 'lifeos:v1:at';
const DB = 'lifeos';
const KV = 'kv';
const BACKUPS = 'backups';
const KEEP = 30;
const MIRROR_MAX = 2_500_000; // characters kept in the localStorage copy

/* ---------------- status (for the Data health card and warnings) ---------------- */

export interface StorageStatus {
  backend: 'indexeddb' | 'localstorage' | 'memory';
  lastSaved?: number;
  bytes?: number;
  mirror: boolean; // the localStorage copy is up to date
  persisted?: boolean; // the browser promised not to evict our data
  error?: string; // the last save failed
  lastBackup?: string; // YYYY-MM-DD
}
let status: StorageStatus = { backend: 'memory', mirror: false };
const subs = new Set<() => void>();
const set = (p: Partial<StorageStatus>) => {
  status = { ...status, ...p };
  subs.forEach((f) => f());
};
export const getStorageStatus = () => status;
export const useStorageStatus = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => status,
  );
const errorSubs = new Set<(msg: string) => void>();
/** Hear about a failed save (the shell shows a warning). */
export const onSaveError = (f: (msg: string) => void) => (errorSubs.add(f), () => void errorSubs.delete(f));

/* ---------------- IndexedDB ---------------- */

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('no IndexedDB'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(KV);
      r.result.createObjectStore(BACKUPS);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('IndexedDB blocked'));
  });
  dbp.catch(() => (dbp = null));
  return dbp;
}
function tx<T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return db().then(
    (d) =>
      new Promise((res, rej) => {
        const t = d.transaction(store, mode);
        const r = op(t.objectStore(store));
        t.oncomplete = () => res(r ? r.result : undefined);
        t.onabort = t.onerror = () => rej(t.error ?? new Error('transaction failed'));
      }),
  );
}

/* ---------------- load ---------------- */

interface Saved {
  json: string;
  at: number;
}

/**
 * The newest saved state: from IndexedDB or the localStorage copy, whichever was saved last.
 * (First run after upgrading: only localStorage has it, and the next save moves it over.)
 */
export async function loadSaved(): Promise<string | null> {
  let idb: Saved | undefined;
  try {
    idb = await tx<Saved>(KV, 'readonly', (s) => s.get('state'));
    set({ backend: 'indexeddb' });
  } catch {
    set({ backend: 'localstorage' });
  }
  let ls: string | null = null;
  let lsAt = 0;
  try {
    ls = localStorage.getItem(LS_KEY);
    lsAt = Number(localStorage.getItem(LS_AT)) || 0;
  } catch {
    /* blocked */
  }
  void askPersistence();
  if (idb && (!ls || idb.at >= lsAt)) return idb.json;
  return ls;
}

/** Ask the browser to keep our data even under storage pressure (Safari otherwise may evict it). */
async function askPersistence() {
  try {
    const sm = navigator.storage;
    if (!sm?.persist) return;
    const already = await sm.persisted();
    set({ persisted: already || (await sm.persist()) });
  } catch {
    /* not supported */
  }
}

/* ---------------- save ---------------- */

let lastJson = '';
/** Save the whole state. Never throws; failures show in the status and raise onSaveError. */
export async function save(json: string) {
  const at = Date.now();
  lastJson = json;
  let ok = false;
  let err = '';
  if (status.backend !== 'localstorage') {
    try {
      await tx(KV, 'readwrite', (s) => s.put({ json, at } satisfies Saved, 'state'));
      ok = true;
      if (status.backend !== 'indexeddb') set({ backend: 'indexeddb' });
    } catch (e) {
      err = `IndexedDB: ${(e as Error)?.message ?? e}`;
    }
  }
  // the localStorage copy: kept while it fits; if it can't be kept, remove it so it's never stale
  let mirror = false;
  try {
    if (json.length <= MIRROR_MAX) {
      localStorage.setItem(LS_KEY, json);
      localStorage.setItem(LS_AT, String(at));
      mirror = true;
      if (!ok && status.backend !== 'indexeddb') ok = true; // localStorage is the only store here
    } else if (ok) {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_AT);
    }
  } catch (e) {
    try {
      if (ok) (localStorage.removeItem(LS_KEY), localStorage.removeItem(LS_AT));
    } catch {
      /* ignore */
    }
    if (!ok) err ||= `localStorage: ${(e as Error)?.message ?? e}`;
  }
  if (ok) {
    set({ lastSaved: at, bytes: json.length * 2, mirror, error: undefined });
    void dailyBackup(json);
  } else {
    const msg = err || 'storage unavailable';
    set({ error: msg, mirror });
    errorSubs.forEach((f) => f(msg));
  }
}

/** Best effort while the page closes (can't wait for IndexedDB): the localStorage copy, if it fits. */
export function saveNow(json: string) {
  try {
    if (json.length <= MIRROR_MAX) {
      localStorage.setItem(LS_KEY, json);
      localStorage.setItem(LS_AT, String(Date.now()));
    }
  } catch {
    /* ignore */
  }
  if (status.backend === 'indexeddb') void tx(KV, 'readwrite', (s) => s.put({ json, at: Date.now() } satisfies Saved, 'state')).catch(() => {});
}

/* ---------------- daily backups ---------------- */

export interface Backup {
  day: string;
  at: number;
  size: number; // characters of JSON
  gz: boolean;
  data: Blob | string;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function pack(json: string): Promise<{ data: Blob | string; gz: boolean }> {
  try {
    if (typeof CompressionStream === 'undefined') throw 0;
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
    return { data: await new Response(stream).blob(), gz: true };
  } catch {
    return { data: json, gz: false };
  }
}
export async function unpack(b: Backup): Promise<string> {
  if (!b.gz) return b.data as string;
  const stream = (b.data as Blob).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

let backupDay = '';
/** Once a day: keep a compressed copy of the state; trim to the last 30 days. */
async function dailyBackup(json: string, force = false) {
  const day = today();
  if (!force && backupDay === day) return;
  backupDay = day;
  try {
    const have = await tx<Backup>(BACKUPS, 'readonly', (s) => s.get(day));
    if (have && !force) return void set({ lastBackup: day });
    await putBackup(day, json);
  } catch {
    backupDay = '';
  }
}
async function putBackup(day: string, json: string) {
  const { data, gz } = await pack(json);
  await tx(BACKUPS, 'readwrite', (s) => s.put({ day, at: Date.now(), size: json.length, gz, data } satisfies Backup, day));
  const keys = ((await tx<IDBValidKey[]>(BACKUPS, 'readonly', (s) => s.getAllKeys())) ?? []).map(String).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) await tx(BACKUPS, 'readwrite', (s) => s.delete(k));
  set({ lastBackup: day });
}

export async function listBackups(): Promise<Backup[]> {
  try {
    return ((await tx<Backup[]>(BACKUPS, 'readonly', (s) => s.getAll())) ?? []).sort((a, b) => b.day.localeCompare(a.day));
  } catch {
    return [];
  }
}

/** Keep a backup of right now (labelled with today's date), e.g. before restoring an older one. */
export async function backupNow() {
  if (!lastJson) return;
  backupDay = today();
  await putBackup(today(), lastJson);
}

/** A rough picture of the browser's storage for this site. */
export async function storageEstimate(): Promise<{ usage?: number; quota?: number }> {
  try {
    const e = await navigator.storage?.estimate?.();
    return { usage: e?.usage, quota: e?.quota };
  } catch {
    return {};
  }
}
