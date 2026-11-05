import { useSyncExternalStore } from 'react';

export type Tone = 'accent' | 'gold' | 'good' | 'info' | 'warn';

export interface Notice {
  id: number;
  title: string;
  body?: string;
  icon?: string;
  tone?: Tone;
  ts: number;
}

let notices: Notice[] = [];
let seq = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/* ---------------- app event bus (the desktop pet listens to this) ---------------- */

export type AppEvent = { type: 'xp'; amount: string } | { type: 'notice'; tone: Tone; title: string };
const busSubs = new Set<(e: AppEvent) => void>();
export function onAppEvent(f: (e: AppEvent) => void) {
  busSubs.add(f);
  return () => {
    busSubs.delete(f);
  };
}
const emitApp = (e: AppEvent) => busSubs.forEach((f) => f(e));

export function notify(n: Omit<Notice, 'id' | 'ts'>, ttl = 4800) {
  const item: Notice = { ...n, id: seq++, ts: Date.now() };
  emitApp({ type: 'notice', tone: n.tone ?? 'info', title: n.title });
  notices = [...notices.slice(-3), item];
  emit();
  window.setTimeout(() => dismiss(item.id), ttl);
}

export function dismiss(id: number) {
  notices = notices.filter((n) => n.id !== id);
  emit();
}

export function useNotices() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => notices,
  );
}

/* ---------------- floating "+XP" bursts anchored to the pointer --------------- */

export interface Burst {
  id: number;
  x: number;
  y: number;
  text: string;
  tone: Tone;
}
let bursts: Burst[] = [];
const bsubs = new Set<() => void>();
let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
window.addEventListener('pointerdown', (e) => (lastPointer = { x: e.clientX, y: e.clientY }), { capture: true });

export function burst(text: string, tone: Tone = 'accent') {
  const b = { id: seq++, ...lastPointer, text, tone };
  emitApp({ type: 'xp', amount: text });
  bursts = [...bursts, b];
  bsubs.forEach((f) => f());
  window.setTimeout(() => {
    bursts = bursts.filter((x) => x.id !== b.id);
    bsubs.forEach((f) => f());
  }, 1100);
}

export function useBursts() {
  return useSyncExternalStore(
    (f) => {
      bsubs.add(f);
      return () => bsubs.delete(f);
    },
    () => bursts,
  );
}
