import { useSyncExternalStore } from 'react';
import { dayKey } from '../lib/date';

/**
 * Daily dashboard snapshots: an image of the desktop (wallpaper, menu bar and tiles, without any
 * open app window or the dock) saved once a day at a set time, and refreshed whenever you leave the
 * page later that day, so the day's final state is kept even if you don't come back before midnight.
 *
 * Images stay in this browser (IndexedDB): they are never synced or uploaded. Optionally each
 * day's image is also downloaded to the computer at the set time.
 */

export interface SnapConfig {
  enabled: boolean;
  time: string; // "HH:MM", local
  download: boolean; // also save the scheduled snapshot to the Downloads folder
  keep: number; // days kept in the browser
}

const CFG = 'lifeos:snapshots';
const DEFAULT: SnapConfig = { enabled: false, time: '23:50', download: false, keep: 90 };
const read = (): SnapConfig => {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(CFG) || '{}') };
  } catch {
    return DEFAULT;
  }
};
let cfg = read();
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const getSnapConfig = () => cfg;
export function setSnapConfig(p: Partial<SnapConfig>) {
  cfg = { ...cfg, ...p };
  try {
    localStorage.setItem(CFG, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
  emit();
}
export const useSnapConfig = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => cfg,
  );

/* ---------------- storage (IndexedDB) ---------------- */

export interface Snap {
  day: string; // YYYY-MM-DD
  ts: number; // when it was taken
  blob: Blob;
  w: number;
  h: number;
  scheduled?: boolean; // taken at (or after) the set time
}

const DB = 'lifeos-snapshots';
const STORE = 'shots';
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'day' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export const getSnap = (day: string) => tx<Snap | undefined>('readonly', (s) => s.get(day) as IDBRequest<Snap | undefined>);
export const listSnaps = async () => ((await tx<Snap[]>('readonly', (s) => s.getAll() as IDBRequest<Snap[]>)) ?? []).sort((a, b) => b.day.localeCompare(a.day));
export async function deleteSnap(day: string) {
  await tx('readwrite', (s) => s.delete(day));
  emit();
}
async function putSnap(s: Snap) {
  await tx('readwrite', (st) => st.put(s));
  // keep only the most recent `keep` days
  const all = await listSnaps();
  for (const old of all.slice(Math.max(1, cfg.keep))) await tx('readwrite', (st) => st.delete(old.day));
  emit();
}
/** Re-render lists when snapshots change. */
export const onSnapsChanged = (f: () => void) => (subs.add(f), () => void subs.delete(f));

/* ---------------- capture ---------------- */

let busy = false;

/** SVG shapes get their colours from stylesheets, which don't travel with the picture: copy the
 *  computed values inline for the capture and put things back afterwards. */
const SVG_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-size', 'font-weight', 'font-family', 'text-anchor', 'dominant-baseline', 'paint-order', 'transform', 'transform-origin', 'transform-box'];
function inlineSvgStyles(root: HTMLElement) {
  const undo: (() => void)[] = [];
  root.querySelectorAll<SVGElement>('svg *').forEach((el) => {
    if (el.closest('.window')) return;
    const cs = getComputedStyle(el);
    const prev = el.getAttribute('style');
    for (const k of SVG_PROPS) {
      const v = cs.getPropertyValue(k);
      if (v) el.style.setProperty(k, v);
    }
    undo.push(() => (prev == null ? el.removeAttribute('style') : el.setAttribute('style', prev)));
  });
  return () => undo.forEach((f) => f());
}

/** Capture the desktop as it looks now (app windows, dock and pet left out). */
export async function captureDashboard(): Promise<{ blob: Blob; w: number; h: number } | null> {
  const os = document.querySelector<HTMLElement>('.os');
  const desktop = document.querySelector<HTMLElement>('.desktop');
  if (!os || !desktop || busy) return null;
  busy = true;
  const { toCanvas } = await import('html-to-image');
  // An open app window blurs the desktop; show it plainly for the picture, without the fade.
  const wasHidden = desktop.classList.contains('is-hidden');
  const prevTransition = desktop.style.transition;
  desktop.style.transition = 'none';
  desktop.classList.remove('is-hidden');
  void desktop.offsetHeight;
  const keep = new Set([...os.children].filter((c) => c.matches('.wallpaper, .menubar, .desk, style')));
  const restoreSvg = inlineSvgStyles(os);
  try {
    const canvas = await toCanvas(os, {
      pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      cacheBust: true,
      filter: (n) => {
        if (!(n instanceof HTMLElement)) return true;
        if (n.parentElement === os && !keep.has(n)) return false;
        return !n.matches('.window, .win-scrim, .dash-editbar, .dash-ghost');
      },
    });
    const type = 'image/jpeg';
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.9));
    return blob ? { blob, w: canvas.width, h: canvas.height } : null;
  } catch (e) {
    console.warn('[snapshot]', e);
    return null;
  } finally {
    restoreSvg();
    if (wasHidden) desktop.classList.add('is-hidden');
    desktop.style.transition = prevTransition;
    busy = false;
  }
}

const fileName = (day: string) => `LifeOS-${day}.jpg`;
export function downloadSnap(s: Pick<Snap, 'day' | 'blob'>) {
  const url = URL.createObjectURL(s.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(s.day);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Take today's snapshot now and store it (replacing today's earlier one). */
export async function snapNow(opts: { scheduled?: boolean; download?: boolean } = {}) {
  const day = dayKey();
  const shot = await captureDashboard();
  if (!shot) return null;
  const prev = await getSnap(day).catch(() => undefined);
  const s: Snap = { day, ts: Date.now(), ...shot, scheduled: opts.scheduled || prev?.scheduled };
  await putSnap(s);
  if (opts.download) downloadSnap(s);
  return s;
}

/* ---------------- schedule ---------------- */

const atTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
};

let started = false;
let lastLeave = 0;

/**
 * Once a minute: at (or after) the set time, take the day's scheduled snapshot (and download it if
 * asked). After that, leaving the page (switching tab, minimising, closing) refreshes today's image
 * at most every 20 minutes, so the latest state of the day is what's kept.
 */
export function initSnapshots() {
  if (started) return;
  started = true;
  const tick = async () => {
    if (!cfg.enabled) return;
    const now = Date.now();
    if (now < atTime(cfg.time)) return;
    const prev = await getSnap(dayKey()).catch(() => undefined);
    if (prev?.scheduled) return;
    await snapNow({ scheduled: true, download: cfg.download });
  };
  window.setInterval(() => void tick(), 60_000);
  window.setTimeout(() => void tick(), 8_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || !cfg.enabled) return;
    if (Date.now() < atTime(cfg.time) || Date.now() - lastLeave < 20 * 60_000) return;
    lastLeave = Date.now();
    void snapNow();
  });
}
