import { beforeEach, describe, expect, it } from 'vitest';
import { dayKey } from '../../src/lib/date';
import { ACHIEVEMENTS, TIER_COINS, TIER_XP } from '../../src/store/achievements';
import { actions, defaultState, getState } from '../../src/store/store';

const once = (title = 't', p = {}) => actions.addQuest({ title, kind: 'once', attr: 'craft', difficulty: 'normal', ...p })!;
const sum = (prefix: string) => getState().events.filter((e) => e.ref.startsWith(prefix)).reduce((a, e) => a + e.xp, 0);

beforeEach(() => actions.replace({ ...defaultState(), onboarded: true, quests: [], events: [], dayPlans: {}, projects: [], achievements: {} }));

describe('top-three bonus', () => {
  it('+50% for a finished top thing; gone again when unticked or unstarred', () => {
    const a = once();
    actions.toggleTop(a);
    actions.toggleQuest(a);
    expect(sum('top:')).toBe(13); // 25 × 50%
    actions.toggleQuest(a);
    expect(sum('top:')).toBe(0);
    actions.toggleQuest(a);
    actions.toggleTop(a); // unstar after finishing
    expect(sum('top:')).toBe(0);
  });
  it('+30 when all three are done, and only then', () => {
    const ids = [once('a'), once('b'), once('c')];
    ids.forEach((id) => actions.toggleTop(id));
    actions.toggleQuest(ids[0]);
    actions.toggleQuest(ids[1]);
    expect(sum('top3:')).toBe(0);
    actions.toggleQuest(ids[2]);
    expect(sum('top3:')).toBe(30);
    actions.toggleQuest(ids[1]);
    expect(sum('top3:')).toBe(0);
  });
  it('works for daily habits too', () => {
    const h = actions.addQuest({ title: 'run', kind: 'daily', attr: 'body', difficulty: 'hard' })!;
    actions.toggleTop(h);
    actions.toggleQuest(h);
    expect(sum('top:')).toBe(25);
  });
});

describe('rituals', () => {
  it('+10 each, once a day', () => {
    actions.markRitual('planned');
    actions.markRitual('planned');
    actions.markRitual('closed');
    expect(sum(`ritual:am:${dayKey()}`)).toBe(10);
    expect(sum(`ritual:pm:${dayKey()}`)).toBe(10);
  });
});

describe('finishing a project', () => {
  it('15 per finished step (50–400); reopening takes it back', () => {
    const p = actions.upsertProject({ name: 'P' });
    for (let i = 0; i < 10; i++) {
      const s = once(`s${i}`, { projectId: p, step: true });
      if (i < 8) actions.toggleQuest(s);
    }
    actions.setProjectStatus(p, 'done');
    expect(sum('projdone:')).toBe(120);
    actions.setProjectStatus(p, 'active');
    expect(sum('projdone:')).toBe(0);
    const small = actions.upsertProject({ name: 'Q' });
    actions.setProjectStatus(small, 'done');
    expect(sum('projdone:')).toBe(50);
  });
});

describe('achievements', () => {
  it('give less XP than before but the same coins', () => {
    expect(TIER_XP).toEqual({ bronze: 20, silver: 50, gold: 120, mythic: 300 });
    expect(TIER_COINS).toEqual({ bronze: 10, silver: 24, gold: 60, mythic: 160 });
    const a = ACHIEVEMENTS.find((x) => x.tier === 'gold')!;
    expect(a.xp).toBe(120);
    expect(a.coins).toBe(60);
  });
  it('an unlock is granted at the new rate', () => {
    actions.toggleQuest(once());
    const ev = getState().events.find((e) => e.kind === 'achievement');
    expect(ev).toBeTruthy();
    expect([20, 50, 120, 300]).toContain(ev!.xp);
    expect([10, 24, 60, 160]).toContain(ev!.coins);
  });
});
