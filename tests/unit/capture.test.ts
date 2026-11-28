import { describe, expect, it } from 'vitest';
import { parseCapture } from '../../src/lib/capture';

const P = [
  { id: 'th', name: '毕业论文' },
  { id: 'gym', name: 'Marathon training' },
  { id: 'old', name: 'Old thing', status: 'done' },
];
const T = '2026-11-28'; // a Saturday

describe('quick capture', () => {
  it('keeps plain text as the title', () => expect(parseCapture('写周报', P, T)).toEqual({ title: '写周报' }));
  it('reads relative days', () => {
    expect(parseCapture('约导师开会 明天', P, T)).toMatchObject({ title: '约导师开会', day: '2026-11-29' });
    expect(parseCapture('后天 交材料', P, T)).toMatchObject({ title: '交材料', day: '2026-11-30' });
    expect(parseCapture('call mom tomorrow', P, T)).toMatchObject({ title: 'call mom', day: '2026-11-29' });
    expect(parseCapture('今天 买菜', P, T)).toEqual({ title: '买菜' });
  });
  it('reads weekdays (always ahead), and next week', () => {
    expect(parseCapture('组会 周一', P, T).day).toBe('2026-11-30');
    expect(parseCapture('组会 周六', P, T).day).toBe('2026-12-05'); // today is Saturday → next one
    expect(parseCapture('组会 下周三', P, T).day).toBe('2026-12-02');
    expect(parseCapture('gym fri', P, T).day).toBe('2026-12-04');
    expect(parseCapture('review next monday', P, T)).toMatchObject({ title: 'review', day: '2026-11-30' });
  });
  it('reads dates, rolling into next year', () => {
    expect(parseCapture('deadline 12-03', P, T).day).toBe('2026-12-03');
    expect(parseCapture('visa 1/5', P, T).day).toBe('2027-01-05');
    expect(parseCapture('x 2027-02-01', P, T).day).toBe('2027-02-01');
  });
  it('picks a project by #prefix, skipping finished ones first', () => {
    expect(parseCapture('写第三章 #毕业', P, T)).toMatchObject({ title: '写第三章', projectId: 'th' });
    expect(parseCapture('long run #mara', P, T).projectId).toBe('gym');
    expect(parseCapture('x #nothing', P, T)).toEqual({ title: 'x #nothing' });
  });
  it('reads difficulty marks', () => {
    expect(parseCapture('大扫除 !', P, T).difficulty).toBe('hard');
    expect(parseCapture('倒垃圾 ~', P, T).difficulty).toBe('easy');
  });
  it('leaves everyday words alone', () => {
    expect(parseCapture('buy sun dried tomatoes', P, T)).toEqual({ title: 'buy sun dried tomatoes' });
    expect(parseCapture('gym saturday', P, T).day).toBe('2026-12-05');
  });
  it('only takes the first day word', () => expect(parseCapture('明天 讨论 周一 的安排', P, T)).toMatchObject({ title: '讨论 周一 的安排', day: '2026-11-29' }));
});
