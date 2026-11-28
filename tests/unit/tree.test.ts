import { beforeEach, describe, expect, it } from 'vitest';
import { onToday } from '../../src/store/links';
import { projectStats } from '../../src/store/plans';
import { actions, defaultState, getState, migrate } from '../../src/store/store';
import { lineage, linkProblems, roleOf } from '../../src/store/tree';
import type { Quest, State } from '../../src/store/types';

const S = () => getState();
const q = (id: string) => S().quests.find((x) => x.id === id)!;
const once = (p: Partial<Quest> = {}) => actions.addQuest({ title: 't', kind: 'once', attr: 'craft', difficulty: 'normal', ...p })!;
const project = (name = 'P') => actions.upsertProject({ name });
const goal = (title: string, projectId?: string) => {
  actions.saveMilestone({ title, attr: 'craft', size: 'small', status: 'active', steps: [], projectId });
  return S().milestones.find((m) => m.title === title)!.id;
};
const paper = (title: string, projectId?: string) => {
  actions.savePaper({ title, status: 'drafting', citations: 0, firstAuthor: true, projectId });
  return S().papers.find((p) => p.title === title)!.id;
};

beforeEach(() => actions.replace({ ...defaultState(), onboarded: true, quests: [], projects: [], milestones: [], papers: [], plans: [], events: [], completions: {} }));

describe('roles', () => {
  it('tells steps, to-dos and dailies apart', () => {
    const base = { id: 'x', title: 'x', attr: 'craft', difficulty: 'normal', createdAt: 0 } as const;
    expect(roleOf({ ...base, kind: 'daily' })).toBe('daily');
    expect(roleOf({ ...base, kind: 'once' })).toBe('todo');
    expect(roleOf({ ...base, kind: 'once', projectId: 'p' })).toBe('step');
    expect(roleOf({ ...base, kind: 'once', projectId: 'p', step: false })).toBe('todo');
    expect(roleOf({ ...base, kind: 'once', projectId: 'p', planId: 'w' })).toBe('todo');
  });
  it('agrees with what Today shows', () => {
    const p = project();
    const all = [once(), once({ projectId: p, step: true }), once({ projectId: p, step: false })].map(q);
    for (const x of all) expect(onToday(x)).toBe(roleOf(x) === 'todo');
  });
});

describe('lineage', () => {
  it('a to-do for a step inherits the project, and the project its one open goal', () => {
    const p = project('Thesis');
    const g = goal('Graduate', p);
    const step = once({ title: 'Ch.3', projectId: p, step: true });
    const todo = once({ title: 'write 3.1', forStep: step, step: false });
    const ln = lineage(S(), q(todo));
    expect(ln.step?.id).toBe(step);
    expect(ln.project?.id).toBe(p);
    expect(ln.ownProject).toBe(false);
    expect(ln.goal?.id).toBe(g);
    expect(ln.ownGoal).toBe(false);
  });
  it('a paper to-do inherits the paper’s project', () => {
    const p = project('LLM judge');
    const a = paper('judge paper', p);
    const todo = once({ paperId: a });
    expect(lineage(S(), q(todo)).project?.id).toBe(p);
  });
  it('does not guess a goal when the project serves several', () => {
    const p = project();
    goal('A', p);
    goal('B', p);
    expect(lineage(S(), q(once({ projectId: p, step: false }))).goal).toBeUndefined();
  });
  it('its own goal wins over the inherited one', () => {
    const p = project();
    goal('A', p);
    const mine = goal('Mine');
    const ln = lineage(S(), q(once({ projectId: p, step: false, goalId: mine })));
    expect(ln.goal?.id).toBe(mine);
    expect(ln.ownGoal).toBe(true);
  });
});

describe('deleting keeps the tree whole', () => {
  it('a deleted project’s steps are archived, not dumped on Today or lost from view silently', () => {
    const p = project();
    const step = once({ projectId: p, step: true });
    const todo = once({ projectId: p, step: false });
    actions.deleteProject(p);
    expect(q(step).archived).toBe(true);
    expect(q(todo).archived).toBeFalsy();
    expect(onToday(q(todo))).toBe(true);
    expect(linkProblems(S())).toEqual([]);
  });
  it('deleting a step frees the to-dos that advanced it', () => {
    const p = project();
    const step = once({ projectId: p, step: true });
    const todo = once({ projectId: p, step: false, forStep: step });
    actions.removeQuest(step);
    expect(q(todo).forStep).toBeUndefined();
    expect(onToday(q(todo))).toBe(true);
  });
  it('deleting a paper or a goal clears links to it', () => {
    const a = paper('x');
    const g = goal('g');
    const t1 = once({ paperId: a });
    const t2 = once({ goalId: g });
    actions.removePaper(a);
    actions.removeMilestone(g);
    expect(q(t1).paperId).toBeUndefined();
    expect(q(t2).goalId).toBeUndefined();
    expect(linkProblems(S())).toEqual([]);
  });
  it('loading data with broken links repairs it', () => {
    const s = migrate({ quests: [{ id: 'a', title: 'a', kind: 'once', attr: 'craft', difficulty: 'normal', createdAt: 0, projectId: 'gone', step: true, paperId: 'gone', forStep: 'gone' }] } as Partial<State>);
    expect(linkProblems(s)).toEqual([]);
    expect(s.quests[0].archived).toBe(true);
  });
});

describe('project progress', () => {
  it('follows steps; to-dos tagged with the project don’t skew it', () => {
    const p = project();
    const s1 = once({ projectId: p, step: true });
    once({ projectId: p, step: true });
    const t = once({ projectId: p, step: false });
    actions.toggleQuest(t);
    let st = projectStats(S(), S().projects.find((x) => x.id === p)!);
    expect(st.steps).toHaveLength(2);
    expect(st.todos).toHaveLength(1);
    expect(st.pct).toBe(0);
    actions.toggleQuest(s1);
    st = projectStats(S(), S().projects.find((x) => x.id === p)!);
    expect(st.pct).toBe(0.5);
  });
});

describe('fuzz: no operation sequence leaves a dangling link', () => {
  it('holds over 400 random operations', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
    for (let i = 0; i < 400; i++) {
      const s = S();
      const r = rnd();
      const pid = pick(s.projects)?.id;
      const step = pick(s.quests.filter((x) => roleOf(x) === 'step' && !x.archived))?.id;
      if (r < 0.12) project(`p${i}`);
      else if (r < 0.2) goal(`g${i}`, rnd() < 0.5 ? pid : undefined);
      else if (r < 0.27) paper(`a${i}`, rnd() < 0.5 ? pid : undefined);
      else if (r < 0.45) once({ projectId: pid, step: true });
      else if (r < 0.62) once({ projectId: pid, step: false, forStep: step, paperId: pick(s.papers)?.id, goalId: pick(s.milestones)?.id });
      else if (r < 0.75 && s.quests.length) actions.toggleQuest(pick(s.quests).id);
      else if (r < 0.83 && pid) actions.deleteProject(pid);
      else if (r < 0.9 && s.quests.length) actions.removeQuest(pick(s.quests).id);
      else if (r < 0.95 && s.papers.length) actions.removePaper(pick(s.papers).id);
      else if (s.milestones.length) actions.removeMilestone(pick(s.milestones).id);
      expect(linkProblems(S())).toEqual([]);
    }
    expect(S().quests.length).toBeGreaterThan(20);
  });
});
