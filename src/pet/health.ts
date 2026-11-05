/**
 * Health rules the desktop pet uses to remind you, proactively.
 *
 *  - Water: adults are commonly advised ~2 L of drinking water a day (≈ 8 cups of 250 ml).
 *    The goal is spread evenly over your waking hours; when you fall behind that pace,
 *    the pet reminds you (never more often than the minimum gap).
 *  - Sitting: WHO (2020) recommends limiting sedentary time; a common practice is to get up
 *    and move for 2–3 minutes every 30–60 minutes. Stepping away ≥ 5 minutes counts as a break.
 *  - Eyes (optional): the 20-20-20 rule — every 20 minutes, look ~6 m (20 ft) away for 20 seconds.
 *  - Sleep: adults need 7–9 hours; a bedtime nudge helps protect that.
 */
export const BREAK_IDLE_MIN = 5;
export const MIN_SIT_STRETCH_FOR_AUTO_BREAK = 20; // minutes of sitting before an away period counts as a break

export interface WaterPlan {
  inWindow: boolean;
  goal: number;
  drank: number;
  expected: number; // cups you'd have had by now at an even pace
  behind: number;
  ml: { drank: number; goal: number };
}

export function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

export function waterPlan(now: Date, drank: number, goal: number, cupMl: number, wakeHour: number, sleepHour: number): WaterPlan {
  const m = minutesOfDay(now);
  const wake = wakeHour * 60;
  const sleep = Math.max(wake + 60, sleepHour * 60);
  const inWindow = m >= wake && m < sleep;
  const frac = Math.max(0, Math.min(1, (m - wake) / (sleep - wake)));
  // At least one cup is "due" from the moment you wake up.
  const expected = inWindow ? Math.min(goal, Math.max(1, Math.round(goal * frac))) : 0;
  return { inWindow, goal, drank, expected, behind: Math.max(0, expected - drank), ml: { drank: drank * cupMl, goal: goal * cupMl } };
}

/** Is it past bedtime? Handles bedtimes after midnight and treats 00:00–04:00 as "still tonight". */
export function pastBedtime(now: Date, bedMin: number) {
  if (!bedMin) return false;
  const m = minutesOfDay(now);
  if (bedMin >= 12 * 60) return m >= bedMin || m < 4 * 60;
  return m >= bedMin && m < 4 * 60 + bedMin;
}

/** The calendar day a night belongs to (so 01:00 still counts as last night). */
export function nightKey(now: Date) {
  const d = new Date(now);
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  return d.toDateString();
}
