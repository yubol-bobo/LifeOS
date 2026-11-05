import { useRef, useSyncExternalStore } from 'react';
import { dayKey } from '../lib/date';
import { uid } from '../lib/id';
import { burst, notify } from '../os/notify';
import { celebrate } from '../ui/celebrate';
import { ACHIEVEMENTS, ACH_BY_ID, achContext } from './achievements';
import {
  MILESTONE_XP,
  PAPER_XP,
  PERFECT_DAY_XP,
  QUEST_XP,
  STEP_XP,
  TRACKER_XP,
  coinsFor,
  levelTitle,
  metrics,
} from './rules';
import { DEFAULT_DOCK, PINNED, type AppId } from '../os/apps';
import type { ScholarFeed } from '../lib/scholarFeed';
import { DEFAULT_ATTRS, DEFAULT_CATEGORIES, hourlyFrom } from './defaults';
import { PLAN_XP, planProgress } from './plans';
import { defaultRates } from './assets';
import { readyGoals, scheduledDailies } from './links';
import type {
  Attr,
  AttrDef,
  Account,
  Category,
  Countdown,
  Plan,
  MoodEntry,
  Project,
  EventKind,
  Milestone,
  Paper,
  PaperStatus,
  Quest,
  Reward,
  State,
  Tracker,
  WorkSession,
} from './types';

const KEY = 'lifeos:v1';

export function defaultState(): State {
  const zh = (navigator.language || '').toLowerCase().startsWith('zh');
  return {
    version: 1,
    onboarded: false,
    demo: false,
    profile: {
      name: '',
      birthDate: '1998-01-01',
      lifeExpectancy: 85,
      currency: 'USD',
      hourlyRate: 40,
      focusGoalMin: 240,
      lang: zh ? 'zh' : 'en',
      theme: 'system',
      reduceMotion: false,
    },
    quests: [],
    completions: {},
    milestones: [],
    papers: [],
    citationLog: [],
    scholar: { provider: 'openalex', authorId: '' },
    sessions: [],
    active: null,
    trackers: [],
    rewards: [],
    events: [],
    achievements: {},
    attributes: DEFAULT_ATTRS.map((a) => ({ ...a })),
    projects: [],
    pay: { mode: 'hour', amount: 40, hoursPerDay: 8, daysPerWeek: 5 },
    ui: { dock: [...DEFAULT_DOCK], hidden: [], widgets: [] },
    moods: {},
    wellness: {},
    pet: { enabled: true, kind: 'mochi', name: zh ? '团子' : 'Mochi', waterMin: 45, waterGoal: 8, cupMl: 250, wakeHour: 8, sleepHour: 23, sitMin: 45, eye20: false, bedtime: 23 * 60 + 30, pomoWork: 25, pomoBreak: 5, sound: true, sysNotify: false, roam: 'lively' },
    pomo: null,
    accounts: [],
    snapshots: [],
    assets: { base: 'USD', rates: defaultRates('USD'), cadence: 'weekly' },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    plans: [],
    countdowns: [],
    stats: {},
    equip: {},
  };
}

/** Bring an older or partial save up to the current shape. */
export function migrate(parsed: Partial<State>): State {
  const d = defaultState();
  const s: State = {
    ...d,
    ...parsed,
    profile: { ...d.profile, ...parsed.profile },
    scholar: { ...d.scholar, ...parsed.scholar },
    pay: { ...d.pay, amount: parsed.profile?.hourlyRate ?? d.pay.amount, ...parsed.pay },
    ui: { ...d.ui, ...parsed.ui },
    pet: { ...d.pet, ...parsed.pet },
    assets: { ...d.assets, ...parsed.assets },
    stats: { ...parsed.stats },
    equip: { ...parsed.equip },
    attributes: parsed.attributes?.length ? parsed.attributes : d.attributes,
    categories: parsed.categories?.length ? parsed.categories : d.categories,
  };
  // Older "working for" entries become full projects.
  s.projects = s.projects.map((p) => ({ category: 'work', status: 'active', ...p }));
  // New apps appear in the dock automatically.
  for (const id of DEFAULT_DOCK) if (!s.ui.dock.includes(id)) s.ui.dock.splice(Math.max(0, s.ui.dock.length - 1), 0, id);
  s.ui.dock = s.ui.dock.filter((id) => DEFAULT_DOCK.includes(id));
  return s;
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw) as Partial<State>);
  } catch {
    return defaultState();
  }
}

let state: State = load();
const subs = new Set<() => void>();
const commitSubs = new Set<(prev: State, next: State) => void>();
/** Observe every committed change (used by multi-device sync to stamp what changed). */
export function onCommit(f: (prev: State, next: State) => void) {
  commitSubs.add(f);
  return () => {
    commitSubs.delete(f);
  };
}
let saveTimer = 0;

function persist() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked — keep running in memory */
    }
  }, 150);
}
window.addEventListener('beforeunload', () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
});

export const getState = () => state;

function shallowEqual(a: unknown, b: unknown) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

/**
 * Subscribe to a slice of state. Results are compared shallowly, so selectors that
 * build a fresh array/object (e.g. a `.filter`) don't cause render loops.
 */
export function useStore<T>(sel: (s: State) => T): T {
  const last = useRef<{ v: T } | null>(null);
  return useSyncExternalStore(subscribe, () => {
    const v = sel(state);
    if (last.current && shallowEqual(last.current.v, v)) return last.current.v;
    last.current = { v };
    return v;
  });
}

const tr = (zh: string, en: string) => (state.profile.lang === 'zh' ? zh : en);

/* ------------------------------------------------------------------ */
/* Commit pipeline: mutate a draft → award achievements → detect level */
/* ------------------------------------------------------------------ */

interface CommitOpts {
  silent?: boolean;
}

export function commit(mutate: (draft: State) => void, opts: CommitOpts = {}) {
  const before = metrics(state).level.level;
  const readyBefore = new Set(readyGoals(state));
  const draft: State = structuredClone(state);
  mutate(draft);

  // Plans complete themselves when everything attached to them is done (and reopen if that changes).
  const planDone: string[] = [];
  if (draft.plans?.length) {
    const mx0 = metrics(draft);
    // Evaluate weeks first so months/years see fresh children.
    for (const scope of ['week', 'month', 'year'] as const)
      for (const p of draft.plans.filter((x) => x.scope === scope)) {
        const pr = planProgress(draft, p, mx0);
        if (pr.parts === 0) continue;
        if (!p.done && pr.pct >= 0.999) {
          p.done = true;
          p.auto = true;
          if (grant(draft, `plan:${p.id}`, 'plan', PLAN_XP[p.scope], p.title)) planDone.push(p.title);
        } else if (p.done && p.auto && pr.pct < 0.999) {
          p.done = false;
          p.auto = false;
          revoke(draft, `plan:${p.id}`);
        }
      }
  }

  // Achievements are re-evaluated after every change and stay unlocked once earned.
  // Loop because some achievements (the collector series) depend on how many others are unlocked.
  let m = metrics(draft);
  const unlocked: string[] = [];
  for (let pass = 0; pass < 4; pass++) {
    const ctx = achContext(draft, m);
    let added = 0;
    for (const a of ACHIEVEMENTS) {
      if (draft.achievements[a.id] || a.value(ctx) < a.target) continue;
      draft.achievements[a.id] = Date.now();
      draft.events.push(ev(`ach:${a.id}`, 'achievement', a.xp, `🏆 ${a.zh[0]} / ${a.en[0]}`));
      unlocked.push(a.id);
      added++;
    }
    if (!added) break;
    m = metrics(draft);
  }


  const prevState = state;
  state = draft;
  commitSubs.forEach((f) => f(prevState, draft));
  persist();
  subs.forEach((f) => f());

  if (opts.silent) return;
  for (const t of planDone.slice(0, 2)) notify({ title: tr('计划完成', 'Plan complete'), body: `「${t}」 · ${tr('全部完成', 'all done')}`, icon: 'circle-check', tone: 'gold' });
  for (const id of readyGoals(state).filter((g) => !readyBefore.has(g))) {
    const g = state.milestones.find((x) => x.id === id)!;
    notify({ title: tr('目标条件已全部满足', 'Goal complete'), body: tr(`「${g.title}」可以领取了 →`, `“${g.title}” is ready to claim →`), icon: 'flag', tone: 'accent' }, 8000);
  }
  const tierRank = { bronze: 0, silver: 1, gold: 2, mythic: 3 };
  const shown = unlocked.map((id) => ACH_BY_ID.get(id)!).sort((x, y) => tierRank[y.tier] - tierRank[x.tier]);
  for (const a of shown.slice(0, 3)) {
    const [title] = state.profile.lang === 'zh' ? a.zh : a.en;
    const tierName = { bronze: tr('青铜', 'Bronze'), silver: tr('白银', 'Silver'), gold: tr('黄金', 'Gold'), mythic: tr('传说', 'Mythic') }[a.tier];
    notify({ title: a.hidden ? tr('隐藏成就解锁！', 'Secret achievement!') : tr(`${tierName}成就解锁`, `${tierName} achievement`), body: `${title} · +${a.xp} XP`, icon: a.icon, tone: 'gold' }, 6500);
  }
  if (shown.length > 3) notify({ title: tr(`还有 ${shown.length - 3} 个成就`, `${shown.length - 3} more achievements`), body: tr('去成就馆看看', 'See the Trophy hall'), icon: 'trophy', tone: 'gold' });
  if (shown.some((a) => a.tier === 'gold' || a.tier === 'mythic') && !state.profile.reduceMotion) celebrate();
  const after = m.level.level;
  if (after > before) window.dispatchEvent(new CustomEvent('lifeos:levelup', { detail: { from: before, to: after } }));
  if (after > before) {
    notify(
      {
        title: tr(`升级！Lv.${after}`, `Level up! Lv.${after}`),
        body: levelTitle(after, state.profile.lang),
        icon: 'trending-up',
        tone: 'accent',
      },
      6500,
    );
    if (!state.profile.reduceMotion) celebrate();
  }
}

function ev(ref: string, kind: EventKind, xp: number, label: string, attr?: Attr, coins = coinsFor(xp)) {
  return { id: uid(), ref, ts: Date.now(), kind, xp, coins, attr, label };
}

function grant(d: State, ref: string, kind: EventKind, xp: number, label: string, attr?: Attr) {
  if (d.events.some((e) => e.ref === ref)) return false;
  d.events.push(ev(ref, kind, xp, label, attr));
  return true;
}

function revoke(d: State, ref: string) {
  d.events = d.events.filter((e) => e.ref !== ref);
}

/* ------------------------------------------------------------------ */
/* Actions                                                            */
/* ------------------------------------------------------------------ */

export const actions = {
  replace(next: State) {
    commit((d) => Object.assign(d, next), { silent: true });
  },
  reset() {
    const keep = state.profile;
    commit((d) => Object.assign(d, defaultState(), { profile: keep, onboarded: true }), { silent: true });
  },
  profile(p: Partial<State['profile']>) {
    const themeChange = p.theme && p.theme !== state.profile.theme;
    commit(
      (d) => {
        if (themeChange) d.stats.themeSwitch = (d.stats.themeSwitch ?? 0) + 1;
        Object.assign(d.profile, p);
      },
      { silent: !themeChange },
    );
  },
  onboard(p: Partial<State['profile']>) {
    commit(
      (d) => {
        Object.assign(d.profile, p);
        d.onboarded = true;
      },
      { silent: true },
    );
  },

  /* ---- quests ---- */
  addQuest(q: Omit<Quest, 'id' | 'createdAt'>) {
    commit((d) => void d.quests.push({ ...q, id: uid(), createdAt: Date.now() }));
  },
  updateQuest(id: string, patch: Partial<Quest>) {
    commit((d) => {
      const q = d.quests.find((x) => x.id === id);
      if (q) Object.assign(q, patch);
    });
  },
  removeQuest(id: string) {
    commit((d) => {
      d.quests = d.quests.filter((q) => q.id !== id);
    });
  },
  toggleQuest(id: string, day = dayKey()) {
    let gained = 0;
    commit((d) => {
      const q = d.quests.find((x) => x.id === id);
      if (!q) return;
      const on = !isDone(d, q, day);
      gained = setQuestDone(d, q, day, on);
      const bump = (k: string) => (d.stats[k] = (d.stats[k] ?? 0) + 1);
      if (!on) bump('unticks');
      else {
        const h = new Date().getHours();
        if (h < 4) bump('nightQuests');
        else if (h < 6) bump('earlyQuests');
        if (day !== dayKey()) bump('backfill');
      }
    });
    if (gained) burst(`+${gained} XP`);
  },

  /* ---- milestones ---- */
  saveMilestone(m: Omit<Milestone, 'id'> & { id?: string }) {
    commit((d) => {
      const existing = m.id && d.milestones.find((x) => x.id === m.id);
      if (existing) Object.assign(existing, m);
      else d.milestones.push({ since: dayKey(), ...m, id: uid() } as Milestone);
      syncMilestone(d, (existing as Milestone) || d.milestones[d.milestones.length - 1]);
    });
  },
  setKrValue(mid: string, krId: string, value: number) {
    commit((d) => {
      const kr = d.milestones.find((x) => x.id === mid)?.krs?.find((k) => k.id === krId);
      if (kr) kr.current = Math.max(0, value);
    });
  },
  removeMilestone(id: string) {
    commit((d) => {
      d.milestones = d.milestones.filter((m) => m.id !== id);
      for (const q of d.quests) if (q.goalId === id) q.goalId = undefined;
      d.events = d.events.filter((e) => !e.ref.startsWith(`ms:${id}`));
    });
  },
  setMilestoneStatus(id: string, status: Milestone['status']) {
    commit((d) => {
      const m = d.milestones.find((x) => x.id === id);
      if (!m) return;
      m.status = status;
      m.doneAt = status === 'done' ? (m.doneAt ?? dayKey()) : undefined;
      syncMilestone(d, m);
    });
    if (status === 'done' && !state.profile.reduceMotion) celebrate();
  },
  toggleStep(mid: string, sid: string) {
    let gained = 0;
    commit((d) => {
      const m = d.milestones.find((x) => x.id === mid);
      const s = m?.steps.find((x) => x.id === sid);
      if (!m || !s) return;
      s.done = !s.done;
      const ref = `ms:${mid}:step:${sid}`;
      if (s.done) {
        if (grant(d, ref, 'step', STEP_XP, `${m.title} · ${s.title}`, m.attr)) gained = STEP_XP;
        if (m.status === 'planned') m.status = 'active';
      } else revoke(d, ref);
    });
    if (gained) burst(`+${gained} XP`);
  },

  /* ---- customization ---- */
  setPay(p: Partial<State['pay']>) {
    commit(
      (d) => {
        Object.assign(d.pay, p);
        d.profile.hourlyRate = Math.round(hourlyFrom(d.pay) * 100) / 100;
      },
      { silent: true },
    );
  },
  setDock(order: AppId[], hidden: AppId[]) {
    commit(
      (d) => {
        d.ui.dock = order;
        d.ui.hidden = hidden.filter((h) => !PINNED.includes(h));
      },
      { silent: true },
    );
  },
  toggleWidget(id: string) {
    commit(
      (d) => {
        d.ui.widgets = d.ui.widgets.includes(id) ? d.ui.widgets.filter((w) => w !== id) : [...d.ui.widgets, id];
      },
      { silent: true },
    );
  },
  saveAttr(a: Omit<AttrDef, 'id'> & { id?: string }) {
    commit(
      (d) => {
        const hit = a.id && d.attributes.find((x) => x.id === a.id);
        if (hit) Object.assign(hit, a);
        else d.attributes.push({ ...a, id: `a-${uid()}` } as AttrDef);
      },
      { silent: true },
    );
  },
  moveAttr(id: string, dir: -1 | 1) {
    commit(
      (d) => {
        const i = d.attributes.findIndex((x) => x.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= d.attributes.length) return;
        [d.attributes[i], d.attributes[j]] = [d.attributes[j], d.attributes[i]];
      },
      { silent: true },
    );
  },
  /** Removing an attribute moves everything that pointed at it — including earned XP — to `into`. */
  removeAttr(id: string, into: string) {
    commit(
      (d) => {
        if (d.attributes.length <= 3 || id === into) return;
        d.attributes = d.attributes.filter((a) => a.id !== id);
        const swap = <T extends { attr?: string }>(x: T) => {
          if (x.attr === id) x.attr = into;
        };
        d.quests.forEach(swap);
        d.milestones.forEach(swap);
        d.trackers.forEach(swap);
        d.sessions.forEach(swap);
        d.events.forEach(swap);
        if (d.active) swap(d.active);
      },
      { silent: true },
    );
  },
  saveProject(p: Omit<Project, 'id'> & { id?: string }) {
    commit(
      (d) => {
        const hit = p.id && d.projects.find((x) => x.id === p.id);
        if (hit) Object.assign(hit, p);
        else d.projects.push({ ...p, id: uid() } as Project);
      },
      { silent: true },
    );
  },
  removeProject(id: string) {
    commit(
      (d) => {
        d.projects = d.projects.filter((p) => p.id !== id);
        for (const s of d.sessions) if (s.projectId === id) s.projectId = undefined;
        if (d.active?.projectId === id) d.active.projectId = undefined;
      },
      { silent: true },
    );
  },

  /* ---- mood & wellness ---- */
  setMood(v: MoodEntry['v'], note?: string, day = dayKey()) {
    commit((d) => {
      const prev = d.moods[day];
      d.moods[day] = { v, note: note ?? prev?.note, ts: Date.now() };
      grant(d, `mood:${day}`, 'mood', 5, tr('心情打卡', 'Mood check-in'));
    });
  },
  setMoodNote(note: string, day = dayKey()) {
    commit(
      (d) => {
        if (d.moods[day]) d.moods[day].note = note;
      },
      { silent: true },
    );
  },
  logWellness(kind: 'water' | 'breaks' | 'pomos', amount = 1, minutes = 0) {
    let gained = 0;
    commit((d) => {
      const day = dayKey();
      const w = (d.wellness[day] ??= { water: 0, breaks: 0, pomos: 0, pomoMin: 0 });
      w[kind] = Math.max(0, w[kind] + amount);
      if (kind === 'pomos') w.pomoMin += minutes;
      if (amount > 0) {
        // XP is capped per day so reminders can't be farmed.
        const caps = { water: 8, breaks: 8, pomos: 12 };
        const xp = { water: 2, breaks: 4, pomos: 10 }[kind];
        if (w[kind] <= caps[kind] && grant(d, `well:${kind}:${day}:${w[kind]}`, 'wellness', xp, { water: tr('喝水', 'Water'), breaks: tr('起身活动', 'Stand-up break'), pomos: tr('番茄钟', 'Pomodoro') }[kind]))
          gained = xp;
      } else revoke(d, `well:${kind}:${day}:${w[kind] + 1}`);
    });
    if (gained) burst(`+${gained} XP`);
  },
  setPet(p: Partial<State['pet']>) {
    commit((d) => Object.assign(d.pet, p), { silent: true });
  },
  setPomo(p: State['pomo']) {
    commit(
      (d) => {
        d.pomo = p;
      },
      { silent: true },
    );
  },

  /* ---- progression ---- */
  /** Count something for achievements (pet pats, spotlight uses…). */
  bump(key: string, n = 1) {
    commit((d) => {
      d.stats[key] = (d.stats[key] ?? 0) + n;
    });
  },
  equip(p: Partial<State['equip']>) {
    commit((d) => Object.assign(d.equip, p), { silent: true });
  },

  /* ---- projects, plans, countdowns ---- */
  saveCategory(c: Omit<Category, 'id'> & { id?: string }) {
    commit(
      (d) => {
        const hit = c.id && d.categories.find((x) => x.id === c.id);
        if (hit) Object.assign(hit, c);
        else d.categories.push({ ...c, id: `c-${uid()}` } as Category);
      },
      { silent: true },
    );
  },
  removeCategory(id: string) {
    commit(
      (d) => {
        if (d.categories.length <= 1) return;
        d.categories = d.categories.filter((c) => c.id !== id);
        const fallback = d.categories[0].id;
        for (const p of d.projects) if (p.category === id) p.category = fallback;
      },
      { silent: true },
    );
  },
  /** Create or update a project; returns its id. */
  upsertProject(p: Partial<Project> & { name: string }): string {
    let id = p.id ?? '';
    commit((d) => {
      const hit = id && d.projects.find((x) => x.id === id);
      if (hit) Object.assign(hit, p);
      else {
        id = uid();
        d.projects.push({ color: 'blue', category: d.categories[0]?.id, status: 'active', createdAt: Date.now(), ...p, id } as Project);
      }
    });
    return id;
  },
  deleteProject(id: string) {
    commit((d) => {
      d.projects = d.projects.filter((p) => p.id !== id);
      for (const x of [...d.quests, ...d.milestones, ...d.papers, ...d.plans, ...d.countdowns, ...d.sessions] as { projectId?: string }[]) if (x.projectId === id) x.projectId = undefined;
      if (d.active?.projectId === id) d.active.projectId = undefined;
    });
  },
  linkProject(kind: 'quests' | 'milestones' | 'papers' | 'plans' | 'countdowns', itemId: string, projectId?: string) {
    commit((d) => {
      const x = (d[kind] as { id: string; projectId?: string }[]).find((y) => y.id === itemId);
      if (x) x.projectId = projectId || undefined;
    });
  },
  savePlan(p: Partial<Plan> & { scope: Plan['scope']; period: string; title: string }): string {
    let id = p.id ?? '';
    commit((d) => {
      const hit = id && d.plans.find((x) => x.id === id);
      if (hit) Object.assign(hit, p);
      else {
        id = uid();
        const parent = p.parentId ? d.plans.find((x) => x.id === p.parentId) : undefined;
        d.plans.push({ createdAt: Date.now(), projectId: parent?.projectId, goalId: undefined, ...p, id } as Plan);
      }
    });
    return id;
  },
  togglePlan(id: string) {
    let gained = 0;
    commit((d) => {
      const p = d.plans.find((x) => x.id === id);
      if (!p) return;
      p.done = !p.done;
      p.auto = false;
      if (p.done) {
        if (grant(d, `plan:${p.id}`, 'plan', PLAN_XP[p.scope], p.title)) gained = PLAN_XP[p.scope];
      } else revoke(d, `plan:${p.id}`);
    });
    if (gained) burst(`+${gained} XP`);
  },
  removePlan(id: string) {
    commit((d) => {
      const kill = new Set([id]);
      // remove the whole subtree
      let grew = true;
      while (grew) {
        grew = false;
        for (const p of d.plans) if (p.parentId && kill.has(p.parentId) && !kill.has(p.id)) (kill.add(p.id), (grew = true));
      }
      d.plans = d.plans.filter((p) => !kill.has(p.id));
      for (const q of d.quests) if (q.planId && kill.has(q.planId)) q.planId = undefined;
      for (const k of kill) revoke(d, `plan:${k}`);
    });
  },
  /** Turn a week plan item into a one-off quest for today (keeps project + plan links). */
  pullToToday(planId: string) {
    const p = state.plans.find((x) => x.id === planId);
    if (!p) return;
    commit((d) => {
      d.quests.push({ id: uid(), title: p.title, kind: 'once', attr: d.attributes[0]?.id ?? 'mind', difficulty: 'normal', createdAt: Date.now(), planId: p.id, projectId: p.projectId });
    });
    notify({ title: tr('已加入今日任务', 'Added to today'), body: p.title, icon: 'list-checks', tone: 'good' });
  },
  saveCountdown(c: Omit<Countdown, 'id' | 'createdAt'> & { id?: string }) {
    commit(
      (d) => {
        const hit = c.id && d.countdowns.find((x) => x.id === c.id);
        if (hit) Object.assign(hit, c);
        else d.countdowns.push({ ...c, id: uid(), createdAt: dayKey() } as Countdown);
      },
      { silent: true },
    );
  },
  removeCountdown(id: string) {
    commit(
      (d) => {
        d.countdowns = d.countdowns.filter((c) => c.id !== id);
      },
      { silent: true },
    );
  },

  /* ---- assets ---- */
  saveAccount(a: Omit<Account, 'id'> & { id?: string }) {
    commit(
      (d) => {
        const hit = a.id && d.accounts.find((x) => x.id === a.id);
        if (hit) Object.assign(hit, a);
        else d.accounts.push({ ...a, id: uid() } as Account);
      },
      { silent: true },
    );
  },
  removeAccount(id: string) {
    commit(
      (d) => {
        d.accounts = d.accounts.filter((a) => a.id !== id);
        for (const s of d.snapshots) delete s.balances[id];
      },
      { silent: true },
    );
  },
  /** Record balances "right now". One snapshot per day; a second check-in the same day updates it. */
  checkin(balances: Record<string, number>, day = dayKey()) {
    let gained = 0;
    commit((d) => {
      const hit = d.snapshots.find((s) => s.date === day);
      if (hit) Object.assign(hit.balances, balances);
      else {
        d.snapshots.push({ date: day, ts: Date.now(), balances });
        d.snapshots.sort((a, b) => a.date.localeCompare(b.date));
      }
      if (grant(d, `assets:${day}`, 'assets', 20, tr('资产盘点', 'Asset check-in'), d.attributes.some((a) => a.id === 'wealth') ? 'wealth' : d.attributes[0]?.id)) gained = 20;
    });
    if (gained) burst(`+${gained} XP`);
  },
  setAssets(cfg: Partial<State['assets']>) {
    commit((d) => Object.assign(d.assets, cfg), { silent: true });
  },

  /* ---- research ---- */
  savePaper(p: Omit<Paper, 'id' | 'updatedAt'> & { id?: string }) {
    commit((d) => {
      let paper = p.id ? d.papers.find((x) => x.id === p.id) : undefined;
      if (paper) Object.assign(paper, p, { updatedAt: Date.now() });
      else {
        paper = { ...p, id: uid(), updatedAt: Date.now() } as Paper;
        d.papers.push(paper);
      }
      syncPaper(d, paper);
      logCitations(d);
    });
  },
  setPaperStatus(id: string, status: PaperStatus) {
    commit((d) => {
      const p = d.papers.find((x) => x.id === id);
      if (!p) return;
      p.status = status;
      p.updatedAt = Date.now();
      syncPaper(d, p);
    });
    if (status === 'accepted' && !state.profile.reduceMotion) celebrate();
  },
  setCitations(id: string, citations: number) {
    commit((d) => {
      const p = d.papers.find((x) => x.id === id);
      if (!p) return;
      p.citations = Math.max(0, Math.round(citations));
      p.updatedAt = Date.now();
      logCitations(d);
    });
  },
  removePaper(id: string) {
    commit((d) => {
      d.papers = d.papers.filter((p) => p.id !== id);
      d.events = d.events.filter((e) => !e.ref.startsWith(`paper:${id}:`));
      logCitations(d);
    });
  },
  importPapers(rows: Omit<Paper, 'id' | 'updatedAt'>[], scholar: Partial<State['scholar']>) {
    let added = 0;
    let updated = 0;
    commit((d) => {
      const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
      for (const r of rows) {
        const hit = d.papers.find((p) => norm(p.title) === norm(r.title));
        if (hit) {
          hit.citations = r.citations;
          hit.venue ||= r.venue;
          hit.year ||= r.year;
          hit.url ||= r.url;
          hit.updatedAt = Date.now();
          updated++;
        } else {
          const p: Paper = { ...r, id: uid(), updatedAt: Date.now() };
          d.papers.push(p);
          syncPaper(d, p);
          added++;
        }
      }
      Object.assign(d.scholar, scholar, { lastSync: Date.now() });
      logCitations(d);
    });
    return { added, updated };
  },
  /**
   * Merge the Google Scholar feed (built by the scheduled workflow). Idempotent per fetch:
   * papers matched by Scholar id, then title; new ones added; vanished ones flagged, never deleted.
   */
  applyScholarFeed(f: ScholarFeed) {
    if (!f.lastFetch || !f.totals || getState().scholar.gsFetch === f.lastFetch) return null;
    const firstImport = getState().scholar.gsTotal == null;
    let added = 0;
    let gained = 0;
    commit((d) => {
      const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
      for (const fp of f.papers) {
        let p = d.papers.find((x) => x.scholarId === fp.id) ?? d.papers.find((x) => !x.scholarId && norm(x.title) === norm(fp.title));
        if (!p) {
          if (fp.removed) continue;
          p = { id: uid(), title: fp.title, venue: fp.venue, year: fp.year ?? undefined, status: 'published', citations: fp.citations ?? 0, firstAuthor: false, url: fp.link || undefined, source: 'gscholar', updatedAt: Date.now() };
          d.papers.push(p);
          syncPaper(d, p);
          added++;
        }
        p.scholarId = fp.id;
        p.removed = !!fp.removed || undefined;
        if (fp.citations != null) p.citations = fp.citations;
        p.venue ||= fp.venue;
        p.year ||= fp.year ?? undefined;
        p.url ||= fp.link || undefined;
        p.updatedAt = Date.now();
      }
      // Backfill the citation curve from Scholar's daily history.
      const have = new Set(d.citationLog.map((x) => x.date));
      for (const h of f.history) if (!have.has(h.date)) d.citationLog.push({ date: h.date, total: h.total });
      d.citationLog.sort((a, b) => a.date.localeCompare(b.date));
      logCitations(d);
      // XP for new citations since the last applied fetch (2 XP each, capped).
      const prev = d.scholar.gsTotal;
      if (prev != null && f.totals!.citations > prev) {
        gained = Math.min(200, (f.totals!.citations - prev) * 2);
        grant(d, `cite:${f.lastFetch}`, 'paper', gained, tr(`新增 ${f.totals!.citations - prev} 次引用`, `${f.totals!.citations - prev} new citations`), d.attributes.some((a) => a.id === 'mind') ? 'mind' : d.attributes[0]?.id);
      }
      Object.assign(d.scholar, { provider: 'gscholar', authorId: f.authorId, lastSync: f.lastFetch, gsFetch: f.lastFetch, gsTotal: f.totals!.citations, byYear: f.profile.byYear?.length ? f.profile.byYear : d.scholar.byYear });
    }, { silent: firstImport });
    const delta = firstImport ? 0 : gained / 2;
    if (firstImport) notify({ title: tr('已连接 Google Scholar', 'Google Scholar connected'), body: tr(`导入了 ${f.papers.filter((p) => !p.removed).length} 篇论文`, `Imported ${f.papers.filter((p) => !p.removed).length} papers`), icon: 'graduation', tone: 'good' });
    else if (delta > 0 || added) notify({ title: 'Google Scholar', body: [delta > 0 ? tr(`+${delta} 次引用`, `+${delta} citations`) : '', added ? tr(`新增 ${added} 篇论文`, `${added} new paper(s)`) : ''].filter(Boolean).join(' · '), icon: 'quote', tone: 'gold' }, 7000);
    return { added, delta };
  },
  setScholar(s: Partial<State['scholar']>) {
    commit((d) => Object.assign(d.scholar, s), { silent: true });
  },

  /* ---- focus & earnings ---- */
  startFocus(rate: number, attr: Attr, note = '', link: { goalId?: string; questId?: string; projectId?: string } = {}) {
    commit((d) => {
      d.active = { start: Date.now(), rate, attr, note, pausedMs: 0, ...link };
    });
  },
  /** Start a focus session on a specific quest — inherits its goal and attribute. */
  focusOnQuest(questId: string) {
    const q = state.quests.find((x) => x.id === questId);
    if (!q) return;
    actions.startFocus(state.profile.hourlyRate, q.attr, q.title, { questId, goalId: q.goalId });
  },
  pauseFocus() {
    commit((d) => {
      const a = d.active;
      if (!a) return;
      if (a.pausedAt) {
        a.pausedMs += Date.now() - a.pausedAt;
        a.pausedAt = undefined;
      } else a.pausedAt = Date.now();
    });
  },
  updateActive(patch: Partial<NonNullable<State['active']>>) {
    commit((d) => {
      if (d.active) Object.assign(d.active, patch);
    });
  },
  stopFocus(keep = true) {
    let summary: WorkSession | null = null;
    let autoDone = '';
    commit((d) => {
      const a = d.active;
      if (!a) return;
      const end = Date.now();
      const paused = a.pausedMs + (a.pausedAt ? end - a.pausedAt : 0);
      const activeMs = Math.max(0, end - a.start - paused);
      d.active = null;
      if (!keep || activeMs < 60_000) return;
      const s: WorkSession = {
        id: uid(),
        start: a.start,
        end,
        activeMs,
        rate: a.rate,
        earned: (activeMs / 3_600_000) * a.rate,
        note: a.note,
        attr: a.attr,
        goalId: a.goalId,
        questId: a.questId,
        projectId: a.projectId,
      };
      d.sessions.push(s);
      const xp = Math.round(activeMs / 60_000); // 1 XP per focused minute
      grant(d, `focus:${s.id}`, 'focus', xp, a.note || tr('专注时段', 'Focus session'), a.attr);
      summary = s;
      // Linkage: enough focus on a quest today completes it.
      const q = a.questId ? d.quests.find((x) => x.id === a.questId) : undefined;
      const today = dayKey();
      if (q?.focusMin && !isDone(d, q, today)) {
        const spent = d.sessions.filter((x) => x.questId === q.id && dayKey(x.start) === today).reduce((acc, x) => acc + x.activeMs, 0);
        if (spent >= q.focusMin * 60_000) {
          setQuestDone(d, q, today, true);
          autoDone = q.title;
        }
      }
    });
    if (autoDone) notify({ title: tr('任务自动完成', 'Quest auto-completed'), body: tr(`专注时长已达标：「${autoDone}」`, `Focus target reached: “${autoDone}”`), icon: 'circle-check', tone: 'good' });
    return summary as WorkSession | null;
  },
  addSession(s: Omit<WorkSession, 'id' | 'earned'>) {
    commit((d) => {
      const full: WorkSession = { ...s, id: uid(), earned: (s.activeMs / 3_600_000) * s.rate };
      d.sessions.push(full);
      grant(d, `focus:${full.id}`, 'focus', Math.round(s.activeMs / 60_000), s.note || tr('专注时段', 'Focus session'), s.attr);
    });
  },
  removeSession(id: string) {
    commit((d) => {
      d.sessions = d.sessions.filter((s) => s.id !== id);
      revoke(d, `focus:${id}`);
    });
  },

  /* ---- trackers ---- */
  saveTracker(t: Omit<Tracker, 'id' | 'entries'> & { id?: string }) {
    commit((d) => {
      const hit = t.id && d.trackers.find((x) => x.id === t.id);
      if (hit) Object.assign(hit, t);
      else d.trackers.push({ ...t, id: uid(), entries: [] });
    });
  },
  removeTracker(id: string) {
    commit((d) => {
      for (const q of d.quests) if (q.log?.trackerId === id) q.log = undefined;
      d.trackers = d.trackers.filter((t) => t.id !== id);
      d.events = d.events.filter((e) => !e.ref.startsWith(`trk:${id}:`));
    });
  },
  logTracker(id: string, value: number, day = dayKey()) {
    let gained = 0;
    commit((d) => {
      gained = addEntry(d, id, value, day);
    });
    if (gained) burst(`+${gained} XP`);
  },
  removeEntry(id: string, day: string) {
    commit((d) => {
      const t = d.trackers.find((x) => x.id === id);
      if (!t) return;
      t.entries = t.entries.filter((e) => e.date !== day);
      revoke(d, `trk:${id}:${day}`);
    });
  },

  /* ---- reward shop ---- */
  saveReward(r: Omit<Reward, 'id' | 'redeemed'> & { id?: string }) {
    commit((d) => {
      const hit = r.id && d.rewards.find((x) => x.id === r.id);
      if (hit) Object.assign(hit, r);
      else d.rewards.push({ ...r, id: uid(), redeemed: 0 });
    });
  },
  removeReward(id: string) {
    commit((d) => {
      d.rewards = d.rewards.filter((r) => r.id !== id);
    });
  },
  redeem(id: string): boolean {
    const r = state.rewards.find((x) => x.id === id);
    if (!r || metrics(state).coins < r.cost) return false;
    commit((d) => {
      const rr = d.rewards.find((x) => x.id === id)!;
      rr.redeemed++;
      d.events.push(ev(`reward:${id}:${uid()}`, 'reward', 0, rr.title, undefined, -rr.cost));
    });
    burst(`−${r.cost}`, 'gold');
    return true;
  },
};

/* ------------------------------------------------------------------ */
/* Internal sync helpers                                              */
/* ------------------------------------------------------------------ */

function syncMilestone(d: State, m: Milestone) {
  const ref = `ms:${m.id}:done`;
  if (m.status === 'done') {
    m.doneAt ??= dayKey();
    grant(d, ref, 'milestone', MILESTONE_XP[m.size], m.title, m.attr);
  } else revoke(d, ref);
}

function syncPaper(d: State, p: Paper) {
  const order = ['idea', 'drafting', 'submitted', 'review', 'accepted', 'published'];
  const reached = order.indexOf(p.status);
  for (const [status, xp] of Object.entries(PAPER_XP)) {
    const ref = `paper:${p.id}:${status}`;
    if (order.indexOf(status) <= reached) grant(d, ref, 'paper', xp!, `${p.title}`, 'mind');
    else revoke(d, ref);
  }
}

function logCitations(d: State) {
  const total = d.papers.filter((p) => !p.removed).reduce((a, p) => a + (p.citations || 0), 0);
  const today = dayKey();
  const last = d.citationLog[d.citationLog.length - 1];
  if (last && last.date === today) last.total = total;
  else if (!last || last.total !== total) d.citationLog.push({ date: today, total });
}

function isDone(d: State, q: Quest, day: string) {
  return q.kind === 'once' ? !!q.doneAt : (d.completions[day] ?? []).includes(q.id);
}

/** Single source of truth for completing / un-completing a quest, including all linked effects. */
function setQuestDone(d: State, q: Quest, day: string, on: boolean): number {
  let gained = 0;
  const xp = QUEST_XP[q.difficulty];
  if (q.kind === 'once') {
    q.doneAt = on ? Date.now() : undefined;
    if (on) gained += grant(d, `quest:${q.id}`, 'quest', xp, q.title, q.attr) ? xp : 0;
    else revoke(d, `quest:${q.id}`);
  } else {
    const ref = `quest:${q.id}:${day}`;
    const list = d.completions[day] ?? [];
    d.completions[day] = on ? [...new Set([...list, q.id])] : list.filter((x) => x !== q.id);
    if (on) gained += grant(d, ref, 'quest', xp, q.title, q.attr) ? xp : 0;
    else revoke(d, ref);
    // Perfect day: every quest scheduled for that day is done.
    const due = scheduledDailies(d, day);
    const done = new Set(d.completions[day]);
    if (due.length >= 3 && due.every((x) => done.has(x.id))) {
      if (grant(d, `perfect:${day}`, 'perfect', PERFECT_DAY_XP, tr('全勤日奖励', 'Perfect day bonus'), 'spirit')) gained += PERFECT_DAY_XP;
    } else revoke(d, `perfect:${day}`);
    if (!d.completions[day].length) delete d.completions[day];
  }
  // Linkage: a quest can log a tracker value (e.g. "Run 5 km" → Running +5).
  if (q.log && d.trackers.some((t) => t.id === q.log!.trackerId)) {
    if (on) gained += addEntry(d, q.log.trackerId, q.log.amount, day);
    else removeAmount(d, q.log.trackerId, q.log.amount, day);
  }
  return gained;
}

function addEntry(d: State, trackerId: string, value: number, day: string): number {
  const t = d.trackers.find((x) => x.id === trackerId);
  if (!t || !Number.isFinite(value)) return 0;
  const hit = t.entries.find((e) => e.date === day);
  if (hit) hit.value = t.mode === 'total' ? +(hit.value + value).toFixed(4) : value;
  else t.entries.push({ date: day, value });
  t.entries.sort((a, b) => a.date.localeCompare(b.date));
  return grant(d, `trk:${t.id}:${day}`, 'tracker', TRACKER_XP, t.name, t.attr) ? TRACKER_XP : 0;
}

function removeAmount(d: State, trackerId: string, value: number, day: string) {
  const t = d.trackers.find((x) => x.id === trackerId);
  const hit = t?.entries.find((e) => e.date === day);
  if (!t || !hit) return;
  if (t.mode === 'total' && hit.value - value > 1e-9) hit.value = +(hit.value - value).toFixed(4);
  else {
    t.entries = t.entries.filter((e) => e !== hit);
    revoke(d, `trk:${t.id}:${day}`);
  }
}
