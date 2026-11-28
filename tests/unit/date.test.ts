import { describe, expect, it } from 'vitest';
import { addDays, dayKey, daysBetween, lastNDays, parseDay } from '../../src/lib/date';

describe('calendar days', () => {
  it('round-trips a day key', () => expect(dayKey(parseDay('2026-03-08'))).toBe('2026-03-08'));
  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('counts days between, signed', () => {
    expect(daysBetween('2026-11-01', '2026-11-28')).toBe(27);
    expect(daysBetween('2026-11-28', '2026-11-01')).toBe(-27);
  });
  it('lists the last n days ending today', () => {
    const d = lastNDays(3, '2026-01-01');
    expect(d).toEqual(['2025-12-30', '2025-12-31', '2026-01-01']);
  });
});
