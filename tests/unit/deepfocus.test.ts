import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deepBonus, deepRate } from '../../src/store/rules';
import { actions, defaultState, getState } from '../../src/store/store';

const MIN = 60_000;
const t0 = new Date('2026-11-28T09:00:00').getTime();
const at = (min: number) => vi.setSystemTime(t0 + min * MIN);
const xp = (kind: string) => getState().events.filter((e) => e.ref.startsWith(kind)).reduce((a, e) => a + e.xp, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(0);
  actions.replace({ ...defaultState(), onboarded: true, events: [], sessions: [], active: null, parked: [] });
});
afterEach(() => vi.useRealTimers());

describe('deep focus rule', () => {
  it('+10% from 1 h, +20% from 2 h, +30% from 3 h', () => {
    expect([59, 60, 119, 120, 179, 180, 300].map(deepRate)).toEqual([0, 0.1, 0.1, 0.2, 0.2, 0.3, 0.3]);
    expect(deepBonus([120 * MIN])).toBe(24);
    expect(deepBonus([90 * MIN, 40 * MIN])).toBe(9);
  });
});

describe('deep focus in sessions', () => {
  it('one 2-hour stretch: 120 XP + 24 bonus', () => {
    actions.startFocus(0, 'craft', 'thesis', { targetMin: 0 });
    at(120);
    actions.stopFocus();
    expect(xp('focus:')).toBe(120);
    expect(xp('deep:')).toBe(24);
    expect(getState().sessions[0].longestRunMs).toBe(120 * MIN);
  });
  it('a pause splits the stretches; each counts on its own', () => {
    actions.startFocus(0, 'craft', '', { targetMin: 0 });
    at(90);
    actions.pauseFocus();
    at(100);
    actions.pauseFocus(); // resume
    at(140);
    actions.stopFocus();
    expect(xp('focus:')).toBe(130);
    expect(xp('deep:')).toBe(9); // 90 min × 10%; the 40 min get nothing
  });
  it('switching to another task and back is a break too', () => {
    actions.startFocus(0, 'craft', 'A', { targetMin: 0 });
    at(70);
    actions.startFocus(0, 'mind', 'B', { targetMin: 0 }); // A is set aside
    at(80);
    actions.stopFocus(); // B: 10 min
    actions.resumeParked(0);
    at(150);
    actions.stopFocus(); // A: 70 + 70 min, in two stretches
    expect(xp('deep:')).toBe(14);
  });
  it('a 3-hour stretch gets +30%', () => {
    actions.startFocus(0, 'craft', '', { targetMin: 0 });
    at(190);
    actions.stopFocus();
    expect(xp('deep:')).toBe(57);
  });
  it('a countdown settled late counts only up to its target', () => {
    actions.startFocus(0, 'craft', '', { targetMin: 60 });
    at(200); // LifeOS wasn't watching
    actions.stopFocus(true, { capToTarget: true });
    expect(xp('focus:')).toBe(60);
    expect(xp('deep:')).toBe(6);
  });
  it('a session started before this version counts when it was never paused', () => {
    actions.replace({ ...getState(), active: { start: t0, rate: 0, attr: 'craft', note: '', pausedMs: 0 } });
    at(65);
    actions.stopFocus();
    expect(xp('deep:')).toBe(7); // 65 × 10% = 6.5 → 7
  });
  it('under an hour: no bonus', () => {
    actions.startFocus(0, 'craft', '', { targetMin: 0 });
    at(59);
    actions.stopFocus();
    expect(xp('deep:')).toBe(0);
  });
});
