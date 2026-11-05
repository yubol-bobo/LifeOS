export const DAY = 86_400_000;

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d: Date | number = new Date()): string {
  const x = typeof d === 'number' ? new Date(d) : d;
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
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

/** Monday-based start of week. */
export function startOfWeek(d = new Date()): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
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
