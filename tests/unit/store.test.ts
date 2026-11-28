import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, dayKey } from '../../src/lib/date';
import { laterQuests, onToday, questDay } from '../../src/store/links';
import { QUEST_XP } from '../../src/store/rules';
import { actions, defaultState, getState, migrate } from '../../src/store/store';
import type { Quest } from '../../src/store/types';

const fresh = () => actions.replace({ ...defaultState(), onboarded: true, quests: [], events: [], completions: {} });
const xp = () => getState().events.filter((e) => e.kind === 'quest').reduce((a, e) => a + e.xp, 0); // (achievements add their own)
const q = (id: string) => getState().quests.find((x) => x.id === id)!;
const once = (p: Partial<Quest> = {}) => actions.addQuest({ title: 't', kind: 'once', attr: 'craft', difficulty: 'normal', ...p })!;
const daily = (p: Partial<Quest> = {}) => actions.addQuest({ title: 'd', kind: 'daily', attr: 'body', difficulty: 'easy', ...p })!;

beforeEach(fresh);

describe("Today's list", () => {
  const base = { id: 'x', title: 'x', kind: 'once', attr: 'craft', difficulty: 'normal', createdAt: Date.now() } as Quest;
  it('shows a plain to-do', () => expect(onToday(base)).toBe(true));
  it('keeps project steps in the project', () => expect(onToday({ ...base, projectId: 'p' , step: true })).toBe(false));
  it('shows a project to-do you added to Today', () => expect(onToday({ ...base, projectId: 'p', step: false })).toBe(true));
  it('shows something pulled in from a plan', () => expect(onToday({ ...base, projectId: 'p', step: true, planId: 'w' })).toBe(true));
  it('hides a to-do moved to a later day until that day', () => {
    const later = { ...base, day: addDays(dayKey(), 2) };
    expect(onToday(later)).toBe(false);
    expect(onToday(later, addDays(dayKey(), 2))).toBe(true);
    expect(questDay(later)).toBe(later.day);
  });
  it('never shows dailies or archived ones as one-offs', () => {
    expect(onToday({ ...base, kind: 'daily' })).toBe(false);
    expect(onToday({ ...base, archived: true })).toBe(false);
  });
  it('lists later to-dos soonest first', () => {
    const a = once({ title: 'a' }), b = once({ title: 'b' });
    actions.moveQuest(a, addDays(dayKey(), 5));
    actions.moveQuest(b, addDays(dayKey(), 1));
    expect(laterQuests(getState()).map((x) => x.title)).toEqual(['b', 'a']);
  });
});

describe('XP ledger', () => {
  it('grants XP once for a one-off, and takes it back when unticked', () => {
    const id = once();
    actions.toggleQuest(id);
    expect(xp()).toBe(QUEST_XP.normal);
    expect(q(id).doneAt).toBeTruthy();
    actions.toggleQuest(id);
    expect(xp()).toBe(0);
    actions.toggleQuest(id);
    actions.replace(structuredClone(getState())); // a sync round-trip must not double-count
    expect(xp()).toBe(QUEST_XP.normal);
  });
  it('counts a daily per day', () => {
    const id = daily();
    actions.toggleQuest(id, '2026-11-01');
    actions.toggleQuest(id, '2026-11-02');
    expect(xp()).toBe(2 * QUEST_XP.easy);
    expect(getState().completions['2026-11-01']).toEqual([id]);
    actions.toggleQuest(id, '2026-11-01');
    expect(getState().completions['2026-11-01']).toBeUndefined();
    expect(xp()).toBe(QUEST_XP.easy);
  });
  it('gives a perfect-day bonus only when every scheduled daily is done', () => {
    const ids = [daily(), daily(), daily()];
    const day = '2026-11-02';
    ids.slice(0, 2).forEach((id) => actions.toggleQuest(id, day));
    expect(getState().events.some((e) => e.kind === 'perfect')).toBe(false);
    actions.toggleQuest(ids[2], day);
    expect(getState().events.filter((e) => e.kind === 'perfect')).toHaveLength(1);
    actions.toggleQuest(ids[2], day);
    expect(getState().events.some((e) => e.kind === 'perfect')).toBe(false);
  });
});

describe('to-do ↔ project step', () => {
  it('finishing the to-do finishes its step; unticking reopens it', () => {
    const step = once({ title: 'step', projectId: 'p', step: true });
    const todo = once({ title: 'todo', projectId: 'p', step: false, forStep: step });
    actions.toggleQuest(todo);
    expect(q(step).doneAt).toBeTruthy();
    expect(q(step).doneVia).toBe(todo);
    actions.toggleQuest(todo);
    expect(q(step).doneAt).toBeUndefined();
  });
  it('unticking the to-do leaves a step you finished yourself alone', () => {
    const step = once({ projectId: 'p', step: true });
    const todo = once({ projectId: 'p', step: false, forStep: step });
    actions.toggleQuest(step);
    actions.toggleQuest(todo);
    actions.toggleQuest(todo);
    expect(q(step).doneAt).toBeTruthy();
  });
});

describe('migrations', () => {
  it('fills a bare save with defaults', () => {
    const s = migrate({});
    expect(s.quests).toEqual(defaultState().quests);
    expect(s.ui.dock.length).toBeGreaterThan(5);
    expect(s.attributes.length).toBeGreaterThan(0);
  });
  it('is idempotent', () => {
    const once = migrate(structuredClone(getState()));
    expect(migrate(structuredClone(once))).toEqual(once);
  });
  it('turns pre-0.9.3 project tasks into steps (not Today items)', () => {
    const s = migrate({ quests: [{ id: 'a', title: 'a', kind: 'once', attr: 'craft', difficulty: 'normal', createdAt: 0, projectId: 'p' }] });
    expect(s.quests[0].step).toBe(true);
    expect(onToday(s.quests[0])).toBe(false);
  });
  it('adds new apps to an old dock and drops removed ones', () => {
    const s = migrate({ ui: { ...defaultState().ui, dock: ['home', 'gone-app' as never] } });
    expect(s.ui.dock).toContain('home');
    expect(s.ui.dock).toContain('report');
    expect(s.ui.dock).not.toContain('gone-app');
  });
  it('keeps the old hourly rate as pay', () => {
    const s = migrate({ profile: { ...defaultState().profile, hourlyRate: 77 } as never, pay: undefined });
    expect(s.pay.amount).toBe(77);
  });
});
