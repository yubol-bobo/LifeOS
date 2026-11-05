import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import type { ActiveSession } from '../store/types';

export function activeMs(a: ActiveSession, now = Date.now()) {
  return Math.max(0, now - a.start - a.pausedMs - (a.pausedAt ? now - a.pausedAt : 0));
}

/** Ticks while a focus session is running. */
export function useLiveSession(interval = 100) {
  const active = useStore((s) => s.active);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active || active.pausedAt) return;
    const t = window.setInterval(() => setTick((n) => n + 1), interval);
    return () => window.clearInterval(t);
  }, [active, interval]);
  if (!active) return null;
  const ms = activeMs(active);
  return { active, ms, earned: (ms / 3_600_000) * active.rate, paused: !!active.pausedAt };
}

export function useClock(interval = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), interval);
    return () => window.clearInterval(t);
  }, [interval]);
  return now;
}
