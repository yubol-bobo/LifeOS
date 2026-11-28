import { describe, expect, it } from 'vitest';
import { addDays, parseDay } from '../../src/lib/date';
import { capacity, doneCounts, h3Focus, staleTodos } from '../../src/store/planning';
import { defaultState } from '../../src/store/store';
import type { H3Position, Quest, State } from '../../src/store/types';

const T = '2026-11-28';
const at = (day: string) => parseDay(day).getTime() + 12 * 3600_000;
const q = (id: string, p: Partial<Quest> = {}): Quest => ({ id, title: id, kind: 'once', attr: 'craft', difficulty: 'normal', createdAt: at(T), ...p });

function withHistory(perDay: number[]): State {
  const s = defaultState();
  s.quests = [];
  perDay.forEach((n, i) => {
    const day = addDays(T, -(i + 1));
    for (let k = 0; k < n; k++) s.quests.push(q(`${day}-${k}`, { createdAt: at(day), doneAt: at(day) }));
  });
  return s;
}

describe('capacity', () => {
  it('counts finished one-offs and dailies per active day, before today', () => {
    const s = withHistory([2, 0, 3]);
    s.completions[addDays(T, -1)] = ['a', 'b'];
    s.completions[T] = ['c'];
    expect(doneCounts(s, T).sort()).toEqual([3, 4]);
  });
  it('says nothing with under 5 active days', () => expect(capacity(withHistory([3, 3, 3, 3]), 20, T)).toBeNull());
  it('uses the median and flags a clearly heavier day', () => {
    const s = withHistory([4, 5, 4, 30, 4, 4]);
    expect(capacity(s, 6, T)).toMatchObject({ typical: 4, over: false });
    expect(capacity(s, 8, T)?.over).toBe(true);
  });
});

describe('stale to-dos', () => {
  it('lists the long-waiting ones, oldest first', () => {
    const a = q('a', { createdAt: at(addDays(T, -10)) });
    const b = q('b', { createdAt: at(addDays(T, -4)) });
    const c = q('c', { createdAt: at(addDays(T, -1)) });
    const moved = q('d', { createdAt: at(addDays(T, -20)), day: addDays(T, -1) }); // re-planned: counts from its new day
    expect(staleTodos([c, b, a, moved], T).map((x) => [x.q.id, x.days])).toEqual([['a', 10], ['b', 4]]);
  });
});

describe('Human 3.0 focus', () => {
  const pos = (level: 1 | 2 | 3, phase: 1 | 2 | 3, next?: string): H3Position => ({ level, phase, next });
  it('picks the quadrant furthest behind', () => {
    const s = defaultState();
    s.h3 = { assessments: [{ id: 'a', kind: 'quarter', key: '2026-Q4', date: T, quads: { mind: pos(2, 2), body: pos(1, 2, 'sleep by 12'), spirit: pos(2, 1), vocation: pos(2, 3) } }] };
    expect(h3Focus(s)).toEqual({ quad: 'body', step: 2, next: 'sleep by 12' });
  });
  it('is quiet with no assessment or when all are equal', () => {
    const s = defaultState();
    expect(h3Focus(s)).toBeNull();
    s.h3 = { assessments: [{ id: 'a', kind: 'month', key: '2026-11', date: T, quads: { mind: pos(2, 1), body: pos(2, 1), spirit: pos(2, 1), vocation: pos(2, 1) } }] };
    expect(h3Focus(s)).toBeNull();
  });
});
