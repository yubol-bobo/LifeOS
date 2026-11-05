export type Attr = 'mind' | 'body' | 'wealth' | 'craft' | 'bond' | 'spirit';
export const ATTRS: Attr[] = ['mind', 'body', 'wealth', 'craft', 'bond', 'spirit'];

export type Lang = 'zh' | 'en';
export type ThemePref = 'light' | 'dark' | 'system';

export interface Profile {
  name: string;
  birthDate: string; // YYYY-MM-DD
  lifeExpectancy: number; // years
  currency: string;
  hourlyRate: number;
  focusGoalMin: number; // daily focus goal in minutes
  lang: Lang;
  theme: ThemePref;
  reduceMotion: boolean;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Quest {
  id: string;
  title: string;
  kind: 'daily' | 'once';
  attr: Attr;
  difficulty: Difficulty;
  createdAt: number;
  doneAt?: number; // for one-off quests
  archived?: boolean;
  /** Linkage — what this quest feeds automatically. */
  goalId?: string; // counts toward a milestone's key results
  days?: number[]; // daily quests: scheduled weekdays, 0 = Mon … 6 = Sun (empty = every day)
  focusMin?: number; // auto-completes after this many focused minutes on it today
  log?: { trackerId: string; amount: number }; // logs to a tracker when completed
}

export type MilestoneSize = 'small' | 'big' | 'epic';
export type MilestoneStatus = 'planned' | 'active' | 'done';

export interface Step {
  id: string;
  title: string;
  done: boolean;
}

/**
 * Key results make a milestone measurable. Progress is computed from live data,
 * so nothing here needs manual upkeep except `manual` KRs.
 */
export type KrKind = 'quests' | 'focus' | 'tracker' | 'metric' | 'manual';
export type KrMetric = 'citations' | 'hIndex' | 'papers' | 'earned' | 'level' | 'streak';

export interface KeyResult {
  id: string;
  kind: KrKind;
  target: number;
  title?: string; // for manual KRs
  current?: number; // for manual KRs
  trackerId?: string;
  metric?: KrMetric;
}

export interface Milestone {
  id: string;
  title: string;
  note?: string;
  attr: Attr;
  size: MilestoneSize;
  status: MilestoneStatus;
  targetDate?: string;
  doneAt?: string;
  since?: string; // start of the counting window for KRs
  steps: Step[];
  krs?: KeyResult[];
}

export type PaperStatus = 'idea' | 'drafting' | 'submitted' | 'review' | 'accepted' | 'published';
export const PAPER_FLOW: PaperStatus[] = ['idea', 'drafting', 'submitted', 'review', 'accepted', 'published'];

export interface Paper {
  id: string;
  title: string;
  venue?: string;
  year?: number;
  status: PaperStatus;
  citations: number;
  firstAuthor: boolean;
  url?: string;
  source?: 'manual' | 'openalex' | 's2';
  updatedAt: number;
}

export interface ScholarConfig {
  provider: 'openalex' | 's2';
  authorId: string;
  lastSync?: number;
  byYear?: { year: number; citations: number }[];
}

export interface WorkSession {
  id: string;
  start: number;
  end: number;
  activeMs: number;
  rate: number;
  earned: number;
  note?: string;
  attr: Attr;
  goalId?: string;
  questId?: string;
}

export interface ActiveSession {
  start: number;
  rate: number;
  note: string;
  attr: Attr;
  pausedMs: number;
  pausedAt?: number;
  goalId?: string;
  questId?: string;
}

export interface Tracker {
  id: string;
  name: string;
  unit: string;
  attr: Attr;
  mode: 'total' | 'latest'; // accumulate entries vs. latest reading
  goal?: number;
  lowerIsBetter?: boolean;
  entries: { date: string; value: number }[];
}

export interface Reward {
  id: string;
  title: string;
  cost: number;
  icon: string;
  redeemed: number;
}

export type EventKind = 'quest' | 'perfect' | 'milestone' | 'step' | 'focus' | 'paper' | 'tracker' | 'reward' | 'achievement';

/** Single ledger for XP & coins. Idempotent by `ref`. */
export interface XpEvent {
  id: string;
  ref: string;
  ts: number;
  kind: EventKind;
  xp: number;
  coins: number;
  attr?: Attr;
  label: string;
}

export interface State {
  version: 1;
  onboarded: boolean;
  demo: boolean;
  profile: Profile;
  quests: Quest[];
  completions: Record<string, string[]>; // dayKey -> daily quest ids
  milestones: Milestone[];
  papers: Paper[];
  citationLog: { date: string; total: number }[];
  scholar: ScholarConfig;
  sessions: WorkSession[];
  active: ActiveSession | null;
  trackers: Tracker[];
  rewards: Reward[];
  events: XpEvent[];
  achievements: Record<string, number>;
}
