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

/** Editable project categories (Research, Work, Life, …). */
export interface Category {
  id: string;
  zh: string;
  en: string;
  icon: string;
  color: PaletteKey;
}

/**
 * A project is the hub everything can hang off: quests (tasks), goals, papers, plans,
 * focus sessions and income (it doubles as the wage timer's "working for" entry), countdowns.
 */
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'done';

export interface Project {
  id: string;
  name: string;
  color: PaletteKey;
  rate?: number;
  category?: string;
  status?: ProjectStatus;
  history?: { status: ProjectStatus; from?: ProjectStatus; at: number }[]; // status changes, oldest first
  deadline?: string;
  note?: string;
  createdAt?: number;
}

export type PlanScope = 'year' | 'month' | 'week';

/** A plan item at one time scale. Children (the scale below) and linked quests roll progress up. */
/** One step of progress on a plan, with an optional note ("Finished Three-Body", "Bench +5 kg"). */
export interface PlanLog {
  id: string;
  ts: number;
  day: string;
  amount: number; // 0 = a note without a count
  note?: string;
  questId?: string; // logged automatically when this linked quest was completed
}

export interface Plan {
  id: string;
  scope: PlanScope;
  period: string; // 2026 · 2026-11 · 2026-W45
  title: string;
  parentId?: string;
  projectId?: string;
  goalId?: string;
  done?: boolean;
  auto?: boolean; // completed automatically by progress roll-up
  note?: string;
  target?: number; // counted plan: e.g. 8 (books)
  unit?: string; // e.g. "本" / "books"
  log?: PlanLog[]; // progress notes, newest last
  createdAt: number;
}

export interface Countdown {
  id: string;
  title: string;
  date: string;
  icon: string;
  color: PaletteKey;
  projectId?: string;
  repeat?: 'yearly';
  createdAt: string;
}

/** A quick-pick activity for unpaid focus (gym, paper writing…). Fully editable. */
export interface FocusPreset {
  id: string;
  name: string;
  icon: string;
  attr: Attr;
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
  desktopProjects?: string[]; // projects shown on the Project progress tile (unset = the ones in progress)
  /** Custom desktop layout per view; unset = the built-in layout. */
  dash?: Partial<Record<'landscape' | 'portrait', DashLayout>>;
}

/** Tile order plus optional spans: [columns, rows?]. */
export interface DashLayout {
  order?: string[];
  size?: Record<string, [number, number?]>;
}

export interface MoodEntry {
  v: 1 | 2 | 3 | 4 | 5;
  note?: string;
  ts: number;
}

/** One day's review. Every field is optional — a single line still counts. */
export interface Review {
  win?: string; // what went well / what you're proud of
  lesson?: string; // what you learned or noticed
  friction?: string; // what got in the way, and what to try next time
  grateful?: string;
  deep?: string; // answer to the day's rotating question
  tomorrow?: string; // the one thing that matters tomorrow
  tomorrowQuest?: string; // quest created from `tomorrow`
  ai?: string; // the pet's summary (editable)
  updatedAt: number;
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
  reviewNudge?: boolean; // gentle evening nudge to write the day's review
  nightSummary?: boolean; // pop the day summary at midnight
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
  focusGoalMin: number; // daily goal for project time, minutes (0 = no goal)
  workGoalMin?: number; // daily goal for paid work, minutes (0 / unset = no goal)
  lang: Lang;
  theme: ThemePref;
  reduceMotion: boolean;
  weekStart?: 0 | 1; // first day of the week: 1 = Monday (default), 0 = Sunday
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
  projectId?: string; // a task of this project
  planId?: string; // feeds this plan (week / month / year); pulled in from a plan, or linked in the editor
  planAmount?: number; // how much each completion adds to a counted plan (default 1), e.g. +3 chapters
  due?: string; // optional due date (YYYY-MM-DD)
  step?: boolean; // a project step (lives in the project, never on today's list). One-off quests with a project
  // count as steps unless this is explicitly false (a to-do you added to Today and tagged with a project).
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
  projectId?: string;
}

export type PaperStatus = 'idea' | 'drafting' | 'submitted' | 'review' | 'accepted' | 'published';
export const PAPER_FLOW: PaperStatus[] = ['idea', 'drafting', 'submitted', 'review', 'accepted', 'published'];

/** One stage change on the paper board: when the paper entered `status` (and from where). */
export interface PaperMove {
  status: PaperStatus;
  from?: PaperStatus;
  at: number;
}

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
  projectId?: string;
  removed?: boolean; // no longer on the Scholar profile (kept, not deleted)
  history?: PaperMove[]; // stage changes, oldest first (papers created before 0.8 have none)
  importedAs?: PaperStatus; // synced from Scholar / OpenAlex / S2 at this stage: earlier stages give no XP
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
  rate: number; // 0 = unpaid effort
  targetMin?: number; // countdown it was started with
  earned: number;
  note?: string;
  attr: Attr;
  goalId?: string;
  questId?: string;
  projectId?: string;
}

export interface ActiveSession {
  start: number;
  rate: number; // 0 = unpaid effort (gym, writing, study…) — still earns XP
  targetMin?: number; // optional countdown
  hit?: boolean; // countdown reached (celebrated)
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

export type EventKind = 'quest' | 'perfect' | 'milestone' | 'step' | 'focus' | 'paper' | 'tracker' | 'reward' | 'achievement' | 'mood' | 'wellness' | 'assets' | 'plan' | 'review';

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
  parked?: ActiveSession[]; // paused sessions set aside while you switched to another task (newest first)
  trackers: Tracker[];
  rewards: Reward[];
  events: XpEvent[];
  achievements: Record<string, number>;
  attributes: AttrDef[];
  projects: Project[];
  pay: PayConfig;
  ui: UiPrefs;
  moods: Record<string, MoodEntry>;
  reviews: Record<string, Review>; // dayKey -> review
  focusPresets: FocusPreset[]; // unpaid-focus quick picks
  wellness: Record<string, Wellness>;
  pet: PetConfig;
  pomo: PomoState | null;
  accounts: Account[];
  snapshots: Snapshot[];
  assets: AssetConfig;
  categories: Category[];
  plans: Plan[];
  countdowns: Countdown[];
  stats: Record<string, number>; // counters for achievements (pet pats, spotlight uses, night quests…)
  equip: { title?: string; wall?: string; acc?: string };
}
