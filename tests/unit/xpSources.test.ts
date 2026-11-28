import { describe, expect, it } from 'vitest';
import { addDays, parseDay } from '../../src/lib/date';
import { defaultState } from '../../src/store/store';
import type { EventKind, State } from '../../src/store/types';
import { xpSources } from '../../src/store/xpSources';

const T = '2026-11-28';
const at = (day: string, h = 12) => parseDay(day).getTime() + h * 3600_000;
let n = 0;
const ev = (kind: EventKind, ref: string, xp: number, day = T, h = 12) => ({ id: `e${n++}`, ref, kind, xp, coins: 0, label: ref, ts: at(day, h) });

function state(): State {
  const s = defaultState();
  s.quests = [
    { id: 'todo', title: 'todo', kind: 'once', attr: 'craft', difficulty: 'normal', createdAt: at(T) },
    { id: 'step', title: 'step', kind: 'once', attr: 'craft', difficulty: 'normal', createdAt: at(T), projectId: 'p' },
    { id: 'hab', title: 'hab', kind: 'daily', attr: 'body', difficulty: 'easy', createdAt: at(T) },
  ];
  s.projects = [{ id: 'p', name: 'P', color: 'blue' }];
  s.sessions = [
    { id: 'paid', start: at(T, 9), end: at(T, 18), activeMs: 9 * 3600_000, rate: 50, earned: 450, attr: 'wealth' },
    { id: 'deep', start: at(addDays(T, -1), 9), end: at(addDays(T, -1), 11), activeMs: 2 * 3600_000, rate: 0, earned: 0, attr: 'craft' },
  ];
  s.events = [
    ev('focus', 'focus:paid', 540),
    ev('focus', 'focus:deep', 120, addDays(T, -1)),
    ev('wellness', `well:pomos:${T}:1`, 10, T, 10), // during the paid session
    ev('wellness', `well:pomos:${T}:2`, 10, T, 20), // after it
    ev('wellness', `well:water:${T}:1`, 2),
    ev('quest', 'quest:todo', 25),
    ev('quest', 'quest:step', 25),
    ev('quest', `quest:hab:${T}`, 10),
    ev('paper', 'cite:123', 60),
    ev('paper', 'paper:x:submitted', 150),
    ev('achievement', 'ach:first', 50),
    ev('review', `review:${T}`, 15),
    ev('reward', 'reward:r:1', 0),
    ev('quest', 'quest:old', 999, addDays(T, -40)), // out of range
  ];
  return s;
}

describe('XP sources', () => {
  it('splits time, done, care and passive, and leaves out what’s outside the range', () => {
    const r = xpSources(state(), 30, T);
    const x = Object.fromEntries(r.sources.map((s) => [s.id, s.xp]));
    expect(x).toMatchObject({ work: 540, focus: 120, pomo: 20, wellness: 2, todo: 25, step: 25, daily: 10, cite: 60, paper: 150, achievement: 50, reflect: 15 });
    expect(r.total).toBe(1017);
    expect(r.activeDays).toBe(2);
    expect(r.perDay).toBe(509);
    expect(r.sources[0].id).toBe('work');
    expect(r.groups.find((g) => g.id === 'time')!.xp).toBe(680);
  });
  it('covers only as many days as there is history', () => {
    const r = xpSources(state(), 30, T);
    expect(r.days).toBe(30); // the out-of-range event is 40 days back, so history is longer
    const s = state();
    s.events = s.events.filter((e) => e.ref !== 'quest:old');
    expect(xpSources(s, 30, T).days).toBe(2);
    expect(xpSources(s, 'all', T).days).toBe(2);
  });
  it('answers the rebalancing questions', () => {
    const r = xpSources(state(), 30, T);
    expect(r.time).toMatchObject({ daysOver4h: 1, daysOver8h: 1, activeDays: 2, maxHours: 9 });
    expect(r.pomoOverlap).toEqual({ n: 1, xp: 10 });
    expect(r.top[0]).toMatchObject({ xp: 540, source: 'work' });
  });
});
