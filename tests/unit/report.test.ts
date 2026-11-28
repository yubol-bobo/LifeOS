import { describe, expect, it } from 'vitest';
import { fromStep, stepOf } from '../../src/store/h3';
import { keyOfDay, periodBounds, shiftKey } from '../../src/store/report';

describe('report periods', () => {
  it('bounds a month, a quarter and a year (end is exclusive)', () => {
    expect(periodBounds('month', '2026-12')).toEqual({ first: '2026-12-01', end: '2027-01-01' });
    expect(periodBounds('quarter', '2026-Q4')).toEqual({ first: '2026-10-01', end: '2027-01-01' });
    expect(periodBounds('quarter', '2026-Q1')).toEqual({ first: '2026-01-01', end: '2026-04-01' });
    expect(periodBounds('year', '2026')).toEqual({ first: '2026-01-01', end: '2027-01-01' });
  });
  it('finds the period of a day', () => {
    expect(keyOfDay('month', '2026-11-28')).toBe('2026-11');
    expect(keyOfDay('quarter', '2026-11-28')).toBe('2026-Q4');
    expect(keyOfDay('quarter', '2026-03-31')).toBe('2026-Q1');
    expect(keyOfDay('year', '2026-11-28')).toBe('2026');
  });
  it('steps across year boundaries', () => {
    expect(shiftKey('month', '2026-12', 1)).toBe('2027-01');
    expect(shiftKey('month', '2026-01', -1)).toBe('2025-12');
    expect(shiftKey('quarter', '2026-Q4', 1)).toBe('2027-Q1');
    expect(shiftKey('quarter', '2026-Q1', -1)).toBe('2025-Q4');
    expect(shiftKey('year', '2026', -3)).toBe('2023');
  });
});

describe('Human 3.0 positions', () => {
  it('maps level.phase to steps 1–9 and back', () => {
    for (let n = 1; n <= 9; n++) expect(stepOf(fromStep(n))).toBe(n);
    expect(stepOf({ level: 2, phase: 3 })).toBe(6);
  });
});
