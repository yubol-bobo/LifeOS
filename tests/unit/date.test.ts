import { describe, expect, it } from 'vitest';
import { addDays, dayKey, dayStartTs, daysBetween, lastNDays, parseDay, setDayStart } from '../../src/lib/date';

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

describe('when a day starts', () => {
  const at = (s: string) => new Date(s).getTime();
  it('counts the small hours for the day before (default 4:00)', () => {
    expect(dayKey(at('2026-11-28T01:37:00'))).toBe('2026-11-27');
    expect(dayKey(at('2026-11-28T03:59:00'))).toBe('2026-11-27');
    expect(dayKey(at('2026-11-28T04:00:00'))).toBe('2026-11-28');
  });
  it('leaves calendar dates alone', () => {
    expect(dayKey(new Date(2026, 10, 28))).toBe('2026-11-28');
    expect(dayKey(parseDay('2026-03-08'))).toBe('2026-03-08');
  });
  it('dayStartTs is the boundary dayKey uses', () => {
    const b = dayStartTs('2026-11-28');
    expect(b).toBe(new Date(2026, 10, 28, 4).getTime());
    expect(dayKey(b)).toBe('2026-11-28');
    expect(dayKey(b - 1)).toBe('2026-11-27');
  });
  it('can be set to midnight', () => {
    setDayStart(0);
    expect(dayKey(at('2026-11-28T01:37:00'))).toBe('2026-11-28');
    setDayStart(4);
  });
  it('works across daylight-saving changes', () => {
    // US clocks spring forward on 2026-03-08 at 2:00
    expect(dayKey(at('2026-03-08T05:00:00'))).toBe('2026-03-08');
    expect(dayKey(at('2026-03-08T03:30:00'))).toBe('2026-03-07');
  });
});
