/**
 * One task model: goal → project (papers belong to projects) → step → today's to-do.
 *
 * Everything you do points up the tree through a few optional links (goalId, projectId, paperId,
 * planId, forStep). This module is the single place that reads them:
 *
 *   - lineage(): where a to-do sits, with missing links filled in from its parents
 *     (a to-do for a step is in that step's project; a paper's to-do is in the paper's project;
 *     a project tied to exactly one open goal serves that goal).
 *   - linkProblems() / repairLinks(): references that point at nothing (a deleted project, paper,
 *     step, goal or plan). Every delete runs repairLinks, and so does every load, so they can't
 *     pile up — and a project's steps never go invisible when the project is deleted.
 */
import type { Milestone, Paper, Plan, Project, Quest, State } from './types';

export type QuestRole = 'daily' | 'step' | 'todo';

/** What a quest is in the tree: a daily habit, a project step (lives in its project), or a to-do (lives on Today). */
export function roleOf(q: Quest): QuestRole {
  if (q.kind === 'daily') return 'daily';
  if (q.planId) return 'todo';
  if (q.projectId) return q.step === false ? 'todo' : 'step';
  return q.step ? 'step' : 'todo';
}

export interface Lineage {
  goal?: Milestone;
  project?: Project;
  paper?: Paper;
  step?: Quest;
  plan?: Plan;
  /** whether the goal / project come from the quest's own links (otherwise inherited); flat, so useStore's shallow compare works */
  ownGoal: boolean;
  ownProject: boolean;
}

type Tree = Pick<State, 'quests' | 'projects' | 'papers' | 'plans' | 'milestones'>;

/** The plan a quest feeds, and the first project / goal found walking up its parents. */
function planChain(s: Tree, id?: string) {
  let p = id ? s.plans.find((x) => x.id === id) : undefined;
  const first = p;
  let projectId: string | undefined;
  let goalId: string | undefined;
  for (let guard = 0; p && guard < 5; guard++) {
    projectId ??= p.projectId;
    goalId ??= p.goalId;
    p = p.parentId ? s.plans.find((x) => x.id === p!.parentId) : undefined;
  }
  return { plan: first, projectId, goalId };
}

/** The one open goal a project serves, if exactly one is tied to it. */
export function goalOfProject(s: Pick<State, 'milestones'>, projectId?: string) {
  if (!projectId) return undefined;
  const open = s.milestones.filter((m) => m.projectId === projectId && m.status !== 'done');
  return open.length === 1 ? open[0] : undefined;
}

export function lineage(s: Tree, q: Quest): Lineage {
  const step = q.forStep ? s.quests.find((x) => x.id === q.forStep) : undefined;
  const paper = q.paperId ? s.papers.find((x) => x.id === q.paperId) : undefined;
  const pc = planChain(s, q.planId);
  const projectId = q.projectId ?? step?.projectId ?? paper?.projectId ?? pc.projectId;
  const project = projectId ? s.projects.find((x) => x.id === projectId) : undefined;
  const directGoal = q.goalId ? s.milestones.find((m) => m.id === q.goalId) : undefined;
  const planGoal = pc.goalId ? s.milestones.find((m) => m.id === pc.goalId) : undefined;
  const goal = directGoal ?? (step?.goalId ? s.milestones.find((m) => m.id === step.goalId) : undefined) ?? planGoal ?? goalOfProject(s, project?.id);
  return { goal, project, paper, step, plan: pc.plan, ownGoal: !!directGoal, ownProject: !!q.projectId && !!project };
}

/** Everything under a project: its steps, its to-dos (incl. those for its papers), and its papers. */
export function projectTree(s: Tree, projectId: string) {
  const papers = s.papers.filter((p) => p.projectId === projectId && !p.removed);
  const paperIds = new Set(papers.map((p) => p.id));
  const quests = s.quests.filter((q) => !q.archived && q.kind === 'once' && (q.projectId === projectId || (q.paperId && paperIds.has(q.paperId))));
  const steps = quests.filter((q) => roleOf(q) === 'step');
  const todos = quests.filter((q) => roleOf(q) === 'todo');
  const done = steps.filter((q) => q.doneAt).length;
  return { papers, steps, todos, done, total: steps.length, pct: steps.length ? done / steps.length : null };
}

/* ------------------------------------------------------------------ */
/* Referential integrity                                              */
/* ------------------------------------------------------------------ */

export interface LinkProblem {
  kind: 'quest' | 'plan' | 'milestone' | 'paper' | 'countdown' | 'session';
  id: string;
  field: string;
  target?: string;
}

type Ref = { id: string; [k: string]: unknown };

/** References to things that no longer exist, plus project steps without a project (which nothing would show). */
export function linkProblems(s: State): LinkProblem[] {
  const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
  const projects = ids(s.projects);
  const goals = ids(s.milestones);
  const papers = ids(s.papers);
  const plans = ids(s.plans);
  const quests = ids(s.quests);
  const out: LinkProblem[] = [];
  const check = (kind: LinkProblem['kind'], xs: Ref[], field: string, valid: Set<string>) => {
    for (const x of xs) {
      const v = x[field] as string | undefined;
      if (v && !valid.has(v)) out.push({ kind, id: x.id, field, target: v });
    }
  };
  const Q = s.quests as unknown as Ref[];
  check('quest', Q, 'projectId', projects);
  check('quest', Q, 'goalId', goals);
  check('quest', Q, 'paperId', papers);
  check('quest', Q, 'planId', plans);
  check('quest', Q, 'forStep', quests);
  check('quest', Q, 'doneVia', quests);
  const P = s.plans as unknown as Ref[];
  check('plan', P, 'projectId', projects);
  check('plan', P, 'goalId', goals);
  check('plan', P, 'parentId', plans);
  check('milestone', s.milestones as unknown as Ref[], 'projectId', projects);
  check('paper', s.papers as unknown as Ref[], 'projectId', projects);
  check('countdown', s.countdowns as unknown as Ref[], 'projectId', projects);
  check('session', s.sessions as unknown as Ref[], 'projectId', projects);
  for (const q of s.quests) if (q.kind === 'once' && !q.archived && q.step && !q.projectId && !q.planId) out.push({ kind: 'quest', id: q.id, field: 'step' });
  return out;
}

/**
 * Fix what linkProblems finds, in place. A link to something deleted is cleared; a project step
 * whose project is gone is archived (kept, with its XP, but off every list) rather than dumped on
 * Today. Returns how many fixes were made.
 */
export function repairLinks(d: State): number {
  const problems = linkProblems(d);
  if (!problems.length) return 0;
  const pools: Record<LinkProblem['kind'], Ref[]> = {
    quest: d.quests as unknown as Ref[],
    plan: d.plans as unknown as Ref[],
    milestone: d.milestones as unknown as Ref[],
    paper: d.papers as unknown as Ref[],
    countdown: d.countdowns as unknown as Ref[],
    session: d.sessions as unknown as Ref[],
  };
  // projects being lost: their steps must be archived, so look at those before clearing projectId
  for (const p of problems)
    if (p.kind === 'quest' && p.field === 'projectId') {
      const q = d.quests.find((x) => x.id === p.id)!;
      if (q.kind === 'once' && !q.planId && q.step !== false) (q.archived = true), (q.step = true);
    }
  for (const p of problems) {
    const x = pools[p.kind].find((y) => y.id === p.id);
    if (!x) continue;
    if (p.field === 'step') (x as unknown as Quest).archived = true;
    else delete x[p.field];
  }
  return problems.length;
}
