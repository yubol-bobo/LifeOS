import type { AppId } from '../os/apps';

/** Attribute ids are user-defined; the six defaults keep their historic ids. */
export type Attr = string;

export type PaletteKey = 'blue' | 'orange' | 'jade' | 'amber' | 'pink' | 'violet' | 'teal' | 'red' | 'lime' | 'indigo' | 'slate' | 'brown';

export interface AttrDef {
  id: Attr;
  zh: string;
  en: string;
  icon: string;
  color: PaletteKey;
}

/** "Working for" — clients, projects, employers. Each may carry its own rate. */
export interface Project {
  id: string;
  name: string;
  color: PaletteKey;
  rate?: number;
}

export interface PayConfig {
  mode: 'hour' | 'day' | 'month' | 'year';
  amount: number;
  hoursPerDay: number;
  daysPerWeek: number;
}

export interface UiPrefs {
  dock: AppId[]; // order
  hidden: AppId[]; // hidden from the dock (still reachable via Spotlight)
  widgets: string[]; // hidden desktop widgets
}

export interface MoodEntry {
  v: 1 | 2 | 3 | 4 | 5;
  note?: string;
  ts: number;
}

export interface Wellness {
  water: number;
  breaks: number;
  pomos: number;
  pomoMin: number;
}

export type PetKind = 'mochi' | 'bolt' | 'nova';

export interface PetConfig {
  enabled: boolean;
  kind: PetKind;
  name: string;
  waterMin: number; // minimum minutes between water reminders; 0 = water reminders off
  waterGoal: number; // cups per day
  cupMl: number;
  wakeHour: number;
  sleepHour: number;
  sitMin: number; // 0 = off
  eye20: boolean; // 20-20-20 eye breaks
  bedtime: number; // minutes after midnight; 0 = off
  pomoWork: number;
  pomoBreak: number;
  sound: boolean;
  sysNotify: boolean;
  roam: 'calm' | 'lively';
}

export type AccountKind = 'cash' | 'bank' | 'invest' | 'retire' | 'crypto' | 'property' | 'debt' | 'other';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  currency: string;
  color: PaletteKey;
  archived?: boolean;
}

/** One check-in: the balance of every account at a moment. Debts are stored as positive owed amounts. */
export interface Snapshot {
  date: string;
  ts: number;
  balances: Record<string, number>;
}

export interface AssetConfig {
  base: string; // reporting currency
  rates: Record<string, number>; // 1 unit of currency = rate × base
  cadence: 'off' | 'daily' | 'weekly' | 'monthly';
  ratesAt?: number;
}

export interface PomoState {
  phase: 'work' | 'break';
  startedAt: number;
  endsAt: number;
  pausedLeft?: number; // ms left while paused
}

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
export type KrMetric = 'citations' | 'hIndex' | 'papers' | 'earned' | 'level' | 'streak' | 'netWorth';

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
  source?: 'manual' | 'openalex' | 's2' | 'gscholar';
  scholarId?: string; // Google Scholar citation_id
  removed?: boolean; // no longer on the Scholar profile (kept, not deleted)
  updatedAt: number;
}

export interface ScholarConfig {
  provider: 'openalex' | 's2' | 'gscholar';
  authorId: string;
  lastSync?: number;
  gsFetch?: number; // lastFetch of the Google Scholar feed already applied
  gsTotal?: number; // total citations at that fetch
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
  projectId?: string;
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
  projectId?: string;
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

export type EventKind = 'quest' | 'perfect' | 'milestone' | 'step' | 'focus' | 'paper' | 'tracker' | 'reward' | 'achievement' | 'mood' | 'wellness' | 'assets';

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
  attributes: AttrDef[];
  projects: Project[];
  pay: PayConfig;
  ui: UiPrefs;
  moods: Record<string, MoodEntry>;
  wellness: Record<string, Wellness>;
  pet: PetConfig;
  pomo: PomoState | null;
  accounts: Account[];
  snapshots: Snapshot[];
  assets: AssetConfig;
}
