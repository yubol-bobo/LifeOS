/**
 * The countdown the next focus session starts with (minutes; 0 = count up).
 * Shared by Earn and Projects, remembered per device. +15 / +30 / +1h stack: three taps on +1h = 3 hours.
 */
const KEY = 'lifeos:next-countdown';
let value = (() => {
  try {
    return Math.max(0, Math.min(24 * 60, Number(localStorage.getItem(KEY)) || 0));
  } catch {
    return 0;
  }
})();
const subs = new Set<() => void>();

export const getNextCountdown = () => value;

export function setNextCountdown(min: number) {
  value = Math.max(0, Math.min(24 * 60, Math.round(min)));
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
}

export function subscribeNextCountdown(f: () => void) {
  subs.add(f);
  return () => void subs.delete(f);
}

/** "2 h 15 min" / "2 小时 15 分" */
export function fmtMinutes(min: number, zh: boolean) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (zh) return [h ? `${h} 小时` : '', m ? `${m} 分钟` : ''].filter(Boolean).join(' ') || '0 分钟';
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ') || '0 min';
}
