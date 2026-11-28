export const DAY = 86_400_000;

/* ---- when a day ends (Settings → General): things done before this hour count for the day before ---- */
let dayStartHour = 4;
export const getDayStart = () => dayStartHour;
export function setDayStart(h: number | undefined) {
  dayStartHour = h == null || !Number.isFinite(h) ? 4 : Math.max(0, Math.min(6, Math.round(h)));
}

/**
 * The day something belongs to, as YYYY-MM-DD.
 * - A moment (a timestamp, or now): before the day-start hour (default 4:00) it still counts for the
 *   day before — ticking something off at 1:30 am lands on "last night", not on the new day.
 * - A Date object: that calendar date as is (used for dates built from y / m / d).
 */
export function dayKey(d: Date | number = Date.now()): string {
  let x: Date;
  if (typeof d === 'number') {
    x = new Date(d);
    if (dayStartHour) x.setHours(x.getHours() - dayStartHour);
  } else x = d;
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
}

/** The moment a day begins (its day-start hour, 4:00 by default) — the boundary that matches dayKey(). */
export function dayStartTs(key: string): number {
  const d = parseDay(key);
  d.setHours(dayStartHour);
  return d.getTime();
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY);
}

/* ---- the user's first day of the week (Settings → General): 1 = Monday, 0 = Sunday ---- */
let weekStart: 0 | 1 = 1;
export const getWeekStart = () => weekStart;
export function setWeekStart(n: number | undefined) {
  weekStart = n === 0 ? 0 : 1;
}
/** Position of a date in the user's week: 0 = first day (Monday or Sunday), 6 = last. */
export const dayOfWeek = (d: Date) => (d.getDay() - weekStart + 7) % 7;
/** Monday-based weekday indices (0 = Mon … 6 = Sun, as stored in quest schedules) in display order. */
export const weekOrder = (): number[] => (weekStart ? [0, 1, 2, 3, 4, 5, 6] : [6, 0, 1, 2, 3, 4, 5]);
const WD_ZH = ['一', '二', '三', '四', '五', '六', '日'];
const WD_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/** One-letter weekday names in the user's week order. */
export const weekdayLetters = (lang: 'zh' | 'en') => weekOrder().map((i) => (lang === 'zh' ? WD_ZH : WD_EN)[i]);

/** Start of the week containing `d`, honouring the user's first day of the week. */
export function startOfWeek(d: Date = parseDay(dayKey())): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - dayOfWeek(x));
  return x;
}

export function lastNDays(n: number, end = dayKey()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

export interface LifeProgress {
  day: number;
  week: number;
  month: number;
  year: number;
  life: number;
  age: number;
  weeksLived: number;
  weeksTotal: number;
  daysLeftYear: number;
}

export function lifeProgress(birthDate: string, expectancy: number, now = new Date()): LifeProgress {
  const t = now.getTime();
  const sod = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sow = startOfWeek(now).getTime();
  const som = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const eom = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  const soy = new Date(now.getFullYear(), 0, 1).getTime();
  const eoy = new Date(now.getFullYear() + 1, 0, 1).getTime();
  const birth = birthDate ? parseDay(birthDate).getTime() : t;
  const end = new Date(birth);
  end.setFullYear(end.getFullYear() + expectancy);
  const age = (t - birth) / (365.2425 * DAY);
  return {
    day: (t - sod) / DAY,
    week: (t - sow) / (7 * DAY),
    month: (t - som) / (eom - som),
    year: (t - soy) / (eoy - soy),
    life: Math.min(1, Math.max(0, (t - birth) / (end.getTime() - birth))),
    age,
    weeksLived: Math.floor((t - birth) / (7 * DAY)),
    weeksTotal: Math.round(expectancy * 52.1775),
    daysLeftYear: Math.ceil((eoy - t) / DAY),
  };
}
