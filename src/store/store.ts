import { useSyncExternalStore } from 'react';
import { dayKey } from '../lib/date';
import { uid } from '../lib/id';
import { burst, notify } from '../os/notify';
import { celebrate } from '../ui/celebrate';
import {
  ACHIEVEMENTS,
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
import type {
  Attr,
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
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<State>;
    const d = defaultState();
    return { ...d, ...parsed, profile: { ...d.profile, ...parsed.profile }, scholar: { ...d.scholar, ...parsed.scholar } };
  } catch {
    return defaultState();
  }
}

let state: State = load();
const subs = new Set<() => void>();
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

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => sel(state),
  );
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
  const draft: State = structuredClone(state);
  mutate(draft);

  // Achievements are re-evaluated after every change and stay unlocked once earned.
  let m = metrics(draft);
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!draft.achievements[a.id] && a.value(m) >= a.target) {
      draft.achievements[a.id] = Date.now();
      draft.events.push(ev(`ach:${a.id}`, 'achievement', a.xp, `🏆 ${a.zh[0]} / ${a.en[0]}`));
      unlocked.push(a.id);
    }
  }
  if (unlocked.length) m = metrics(draft);

  state = draft;
  persist();
  subs.forEach((f) => f());

  if (opts.silent) return;
  for (const id of unlocked.slice(0, 3)) {
    const a = ACHIEVEMENTS.find((x) => x.id === id)!;
    const [title] = state.profile.lang === 'zh' ? a.zh : a.en;
    notify({ title: tr('成就解锁', 'Achievement unlocked'), body: `${title} · +${a.xp} XP`, icon: a.icon, tone: 'gold' }, 6500);
  }
  const after = m.level.level;
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
    commit((d) => Object.assign(d.profile, p), { silent: true });
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
      const xp = QUEST_XP[q.difficulty];
      if (q.kind === 'once') {
        if (q.doneAt) {
          q.doneAt = undefined;
          revoke(d, `quest:${id}`);
        } else {
          q.doneAt = Date.now();
          grant(d, `quest:${id}`, 'quest', xp, q.title, q.attr);
          gained = xp;
        }
        return;
      }
      const list = (d.completions[day] ??= []);
      const ref = `quest:${id}:${day}`;
      if (list.includes(id)) {
        d.completions[day] = list.filter((x) => x !== id);
        revoke(d, ref);
      } else {
        list.push(id);
        grant(d, ref, 'quest', xp, q.title, q.attr);
        gained = xp;
      }
      // Perfect day bonus when every active daily quest is done.
      const dailies = d.quests.filter((x) => x.kind === 'daily' && !x.archived);
      const done = new Set(d.completions[day] ?? []);
      const perfect = dailies.length >= 3 && dailies.every((x) => done.has(x.id));
      if (perfect) {
        if (grant(d, `perfect:${day}`, 'perfect', PERFECT_DAY_XP, tr('全勤日奖励', 'Perfect day bonus'), 'spirit'))
          gained += PERFECT_DAY_XP;
      } else revoke(d, `perfect:${day}`);
      if (!d.completions[day]?.length) delete d.completions[day];
    });
    if (gained) burst(`+${gained} XP`);
  },

  /* ---- milestones ---- */
  saveMilestone(m: Omit<Milestone, 'id'> & { id?: string }) {
    commit((d) => {
      const existing = m.id && d.milestones.find((x) => x.id === m.id);
      if (existing) Object.assign(existing, m);
      else d.milestones.push({ ...m, id: uid() } as Milestone);
      syncMilestone(d, (existing as Milestone) || d.milestones[d.milestones.length - 1]);
    });
  },
  removeMilestone(id: string) {
    commit((d) => {
      d.milestones = d.milestones.filter((m) => m.id !== id);
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
      const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9一-龥]/g, '');
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
  setScholar(s: Partial<State['scholar']>) {
    commit((d) => Object.assign(d.scholar, s), { silent: true });
  },

  /* ---- focus & earnings ---- */
  startFocus(rate: number, attr: Attr, note = '') {
    commit((d) => {
      d.active = { start: Date.now(), rate, attr, note, pausedMs: 0 };
    });
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
      };
      d.sessions.push(s);
      const xp = Math.round(activeMs / 60_000); // 1 XP per focused minute
      grant(d, `focus:${s.id}`, 'focus', xp, a.note || tr('专注时段', 'Focus session'), a.attr);
      summary = s;
    });
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
      d.trackers = d.trackers.filter((t) => t.id !== id);
      d.events = d.events.filter((e) => !e.ref.startsWith(`trk:${id}:`));
    });
  },
  logTracker(id: string, value: number, day = dayKey()) {
    let gained = 0;
    commit((d) => {
      const t = d.trackers.find((x) => x.id === id);
      if (!t || !Number.isFinite(value)) return;
      const hit = t.entries.find((e) => e.date === day);
      if (hit) hit.value = t.mode === 'total' ? hit.value + value : value;
      else t.entries.push({ date: day, value });
      t.entries.sort((a, b) => a.date.localeCompare(b.date));
      if (grant(d, `trk:${id}:${day}`, 'tracker', TRACKER_XP, t.name, t.attr)) gained = TRACKER_XP;
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
  const total = d.papers.reduce((a, p) => a + (p.citations || 0), 0);
  const today = dayKey();
  const last = d.citationLog[d.citationLog.length - 1];
  if (last && last.date === today) last.total = total;
  else if (!last || last.total !== total) d.citationLog.push({ date: today, total });
}
