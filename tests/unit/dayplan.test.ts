import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, dayKey } from '../../src/lib/date';
import { actions, defaultState, getState } from '../../src/store/store';
import { linkProblems } from '../../src/store/tree';
import { fromCells, toCells } from '../../src/sync/cells';
import { offerRitual } from '../../src/os/ritualPrompt';
import { onAppEvent } from '../../src/os/notify';

let heard = 0;
onAppEvent((e) => void (e.type === 'notice' && heard++));
const getNotices = () => ({ length: heard });

const once = (title = 't') => actions.addQuest({ title, kind: 'once', attr: 'craft', difficulty: 'normal' })!;
const top = (day = dayKey()) => getState().dayPlans[day]?.top ?? [];

beforeEach(() => actions.replace({ ...defaultState(), onboarded: true, quests: [], events: [], dayPlans: {} }));

describe('top three', () => {
  it('stars up to three, in order, and unstars', () => {
    const ids = [once('a'), once('b'), once('c'), once('d')];
    expect(ids.slice(0, 3).map((id) => actions.toggleTop(id))).toEqual([true, true, true]);
    expect(actions.toggleTop(ids[3])).toBe(false);
    expect(top()).toEqual(ids.slice(0, 3));
    actions.toggleTop(ids[1]);
    expect(top()).toEqual([ids[0], ids[2]]);
  });
  it('a to-do moved to another day leaves today’s top three', () => {
    const a = once();
    actions.toggleTop(a);
    actions.moveQuests([a], addDays(dayKey(), 1));
    expect(top()).toEqual([]);
    expect(getState().quests[0].day).toBe(addDays(dayKey(), 1));
  });
  it('a deleted to-do leaves it too (no dangling ids)', () => {
    const a = once();
    actions.toggleTop(a);
    actions.removeQuest(a);
    expect(getState().dayPlans[dayKey()]?.top ?? []).toEqual([]);
    expect(linkProblems(getState())).toEqual([]);
  });
  it('moveQuests leaves finished to-dos where they are', () => {
    const a = once();
    actions.toggleQuest(a);
    actions.moveQuests([a], addDays(dayKey(), 1));
    expect(getState().quests[0].day).toBeUndefined();
  });
  it('syncs per day', () => {
    const a = once();
    actions.toggleTop(a);
    actions.markRitual('planned');
    const cells = toCells(getState());
    expect([...cells.keys()]).toContain(`dayPlans.${dayKey()}`);
    expect(fromCells(cells).dayPlans[dayKey()]).toMatchObject({ top: [a] });
  });
});

describe('ritual prompts', () => {
  const at = (h: number) => {
    const d = new Date();
    d.setHours(h, 5, 0, 0);
    return d;
  };
  it('offers the morning plan once, in the morning, until it is done', () => {
    const n0 = getNotices().length;
    offerRitual(at(3));
    expect(getNotices().length).toBe(n0);
    offerRitual(at(8));
    expect(getNotices().length).toBe(n0 + 1);
    offerRitual(at(9));
    expect(getNotices().length).toBe(n0 + 1); // once a day
  });
  it('skips when planned already, or when turned off', () => {
    const n0 = getNotices().length;
    actions.markRitual('planned');
    offerRitual(at(8));
    actions.profile({ rituals: false });
    offerRitual(at(20));
    expect(getNotices().length).toBe(n0);
  });
});
