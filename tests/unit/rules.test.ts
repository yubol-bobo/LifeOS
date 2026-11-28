import { describe, expect, it } from 'vitest';
import { hIndex, levelInfo, xpForLevel } from '../../src/store/rules';

describe('levels and XP', () => {
  it('needs more XP for every level', () => {
    for (let L = 2; L < 100; L++) expect(xpForLevel(L + 1)).toBeGreaterThan(xpForLevel(L));
  });
  it('places XP on the right level', () => {
    expect(levelInfo(0).level).toBe(1);
    expect(levelInfo(xpForLevel(5)).level).toBe(5);
    expect(levelInfo(xpForLevel(5) - 1).level).toBe(4);
  });
  it('computes an h-index', () => {
    expect(hIndex([10, 8, 5, 4, 3])).toBe(4);
    expect(hIndex([])).toBe(0);
    expect(hIndex([0, 0])).toBe(0);
  });
});
