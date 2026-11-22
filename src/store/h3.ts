import { addDays, dayKey, parseDay } from '../lib/date';
import { filledSeries } from './assets';
import { isScheduled } from './links';
import { periodBounds, type ReportKind } from './report';
import type { Attr, H3Assessment, H3Position, H3Quad, State } from './types';

/**
 * Human 3.0 (Dan Koe): four quadrants of life, each at one of three levels (1.0 Conformist,
 * 2.0 Individualist, 3.0 Synthesist), each level passing through three phases (Dissonance,
 * Uncertainty, Discovery). Written "Vocation 2.1". The per-quadrant descriptions below are LifeOS's
 * plain-language reading of the framework, meant as prompts for an honest self-assessment.
 */

export const QUADS: H3Quad[] = ['mind', 'body', 'spirit', 'vocation'];

type T = [string, string];
export const QUAD_META: Record<H3Quad, { name: T; covers: T; color: string; icon: string; levels: [T, T, T] }> = {
  mind: {
    name: ['心智 Mind', 'Mind'],
    covers: ['想法、情绪、信念；怎么理解世界、怎么学习和思考', 'Thoughts, emotions and beliefs; how you understand the world, learn and think'],
    color: '#7c9cff',
    icon: 'brain',
    levels: [
      ['观点大多来自别人；被情绪推着走，很少质疑自己的信念。', 'Views mostly borrowed; carried by emotions; beliefs rarely questioned.'],
      ['有意识地学习，形成自己的观点；能觉察自己的想法和情绪。', 'Learns on purpose and forms own views; notices own thoughts and emotions.'],
      ['能同时容纳多种视角，把不同领域连起来，建立自己的思维模型。', 'Holds several perspectives at once, connects fields, builds own models of the world.'],
    ],
  },
  body: {
    name: ['身体 Body', 'Body'],
    covers: ['健康、运动、饮食、睡眠、精力', 'Health, training, food, sleep and energy'],
    color: '#5fe0b4',
    icon: 'dumbbell',
    levels: [
      ['作息、饮食、运动都随遇而安；精力时好时坏，身体出问题才在意。', 'Sleep, food and movement run on defaults; energy is hit-or-miss; attention only when something breaks.'],
      ['有自己的训练、睡眠和饮食习惯，会记录、会调整。', 'Own routines for training, sleep and food; tracks and adjusts them.'],
      ['身体是一套整合的系统，为生活其他部分供能；会主动实验，精力充沛。', 'Health is an integrated system that powers everything else; experiments deliberately; energy to spare.'],
    ],
  },
  spirit: {
    name: ['精神 Spirit', 'Spirit'],
    covers: ['关系、社群、归属感、意义感', 'Relationships, community, belonging and meaning'],
    color: '#ff8ad8',
    icon: 'heart',
    levels: [
      ['靠融入群体获得归属；意义感来自别人的期待。', 'Belongs by fitting in; meaning comes from what others expect.'],
      ['选择自己的价值观和身边的人；脱离旧圈子时可能会孤独。', 'Chooses own values and people; may feel alone while outgrowing old circles.'],
      ['有主动经营的深度关系和社群；意义来自贡献，内心安定。', 'Deep, chosen relationships and community; meaning comes from contributing; at peace.'],
    ],
  },
  vocation: {
    name: ['事业 Vocation', 'Vocation'],
    covers: ['职业、学术、生意、技能、财富与贡献', 'Career, research, business, skills, money and contribution'],
    color: '#ffd166',
    icon: 'briefcase',
    levels: [
      ['做别人定义好的工作，用时间换钱，方向由外部决定。', 'Work someone else defined; trades time for money; direction set from outside.'],
      ['主动打磨技能、走自己的路：副业、转向、学术或创业。', 'Sharpens skills and carves own path: side projects, career moves, research or a business.'],
      ['建立把兴趣、能力和价值结合起来的系统；工作是自我表达，影响力可以放大。', 'Builds systems that combine interests, skills and value; work is self-expression with leverage.'],
    ],
  },
};

export const LEVEL_NAME: Record<1 | 2 | 3, T> = { 1: ['随大流者', 'Conformist'], 2: ['个人主义者', 'Individualist'], 3: ['综合者', 'Synthesist'] };
export const PHASE_META: Record<1 | 2 | 3, { name: T; desc: T }> = {
  1: { name: ['不协调', 'Dissonance'], desc: ['原来的方式开始不合适了：摩擦、不满、卡住。', 'The current way stops fitting: friction, dissatisfaction, feeling stuck.'] },
  2: { name: ['迷茫', 'Uncertainty'], desc: ['放下旧方式、在试新的，但还不确定。', 'Letting go of the old way and experimenting, not sure yet.'] },
  3: { name: ['发现', 'Discovery'], desc: ['找到了这一级的新方式，正在稳定和整合，快可以往上走了。', 'Found this level’s new way and integrating it; nearly ready for the next level.'] },
};

/** 1.1 → 1, 3.3 → 9: a single number for charts. */
export const stepOf = (p: Pick<H3Position, 'level' | 'phase'>) => (p.level - 1) * 3 + p.phase;
export const fmtPos = (p: Pick<H3Position, 'level' | 'phase'>) => `${p.level}.${p.phase}`;
export const fromStep = (n: number): Pick<H3Position, 'level' | 'phase'> => ({ level: (Math.floor((n - 1) / 3) + 1) as 1 | 2 | 3, phase: (((n - 1) % 3) + 1) as 1 | 2 | 3 });

/** Everyone at 3.x in all four: Koe's "3.0+ metatype". */
export const isMetatype = (a: H3Assessment) => QUADS.every((q) => a.quads[q].level === 3);

/* ---------------- attributes → quadrants ---------------- */

const DEFAULT_MAP: Record<string, H3Quad> = { mind: 'mind', body: 'body', bond: 'spirit', spirit: 'spirit', wealth: 'vocation', craft: 'vocation' };
export function quadOf(s: Pick<State, 'h3'>, attr: Attr): H3Quad {
  return s.h3?.map?.[attr] ?? DEFAULT_MAP[attr] ?? 'vocation';
}

/* ---------------- evidence from LifeOS for a period ---------------- */

export interface QuadEvidence {
  xp: number;
  quests: number; // done in this quadrant
  due: number; // daily check-ins scheduled in this quadrant
  rate: number | null; // daily habits kept
  extra: { label: T; value: string }[];
}

export function h3Evidence(s: State, kind: ReportKind, key: string): Record<H3Quad, QuadEvidence> {
  const { first, end } = periodBounds(kind, key);
  const today = dayKey();
  const last = end <= today ? addDays(end, -1) : today;
  const from = parseDay(first).getTime();
  const to = parseDay(addDays(last, 1)).getTime();
  const out = Object.fromEntries(QUADS.map((q) => [q, { xp: 0, quests: 0, due: 0, rate: null, extra: [] }])) as unknown as Record<H3Quad, QuadEvidence>;
  for (const e of s.events) if (e.ts >= from && e.ts < to && e.xp > 0 && e.attr) out[quadOf(s, e.attr)].xp += e.xp;
  const qAttr = new Map(s.quests.map((q) => [q.id, q.attr]));
  for (let d = first; d <= last; d = addDays(d, 1)) {
    for (const id of s.completions[d] ?? []) {
      const a = qAttr.get(id);
      if (a) out[quadOf(s, a)].quests++;
    }
    for (const q of s.quests) if (isScheduled(q, d) && q.createdAt < parseDay(addDays(d, 1)).getTime()) out[quadOf(s, q.attr)].due++;
  }
  for (const q of s.quests) if (q.kind === 'once' && q.doneAt && q.doneAt >= from && q.doneAt < to) out[quadOf(s, q.attr)].quests++;
  for (const q of QUADS) {
    const dailyDone = Object.entries(s.completions)
      .filter(([d]) => d >= first && d <= last)
      .reduce((a, [, ids]) => a + ids.filter((id) => s.quests.find((x) => x.id === id && x.kind === 'daily' && quadOf(s, x.attr) === q)).length, 0);
    out[q].rate = out[q].due ? dailyDone / out[q].due : null;
  }
  // quadrant-specific signals
  const days: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  const reviews = days.filter((d) => s.reviews[d]);
  const lessons = reviews.filter((d) => s.reviews[d].lesson?.trim()).length;
  out.mind.extra.push({ label: ['写复盘的天数', 'Days reviewed'], value: `${reviews.length}` }, { label: ['写下的收获', 'Lessons written'], value: `${lessons}` });
  const moods = days.map((d) => s.moods[d]?.v).filter((v): v is NonNullable<typeof v> => v != null);
  const grateful = reviews.filter((d) => s.reviews[d].grateful?.trim()).length;
  out.spirit.extra.push({ label: ['平均心情', 'Average mood'], value: moods.length ? `${(moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)} / 5` : '—' }, { label: ['写下的感恩', 'Gratitude notes'], value: `${grateful}` });
  const ses = s.sessions.filter((x) => x.start >= from && x.start < to);
  const focus = ses.reduce((a, x) => a + x.activeMs, 0);
  const earned = ses.reduce((a, x) => a + x.earned, 0);
  const series = filledSeries(s);
  const nw = (d: string) => [...series].reverse().find((x) => x.snap.date <= d)?.total;
  const n1 = nw(last);
  const n0 = nw(addDays(first, -1));
  out.vocation.extra.push(
    { label: ['专注时长', 'Focus'], value: `${(focus / 3_600_000).toFixed(1)}h` },
    { label: ['工作收入', 'Earned'], value: earned ? `${Math.round(earned).toLocaleString()} ${s.profile.currency}` : '—' },
    ...(n1 != null && n0 != null ? [{ label: ['净资产变化', 'Net worth change'] as T, value: `${n1 - n0 >= 0 ? '+' : '−'}${Math.round(Math.abs(n1 - n0)).toLocaleString()} ${s.assets.base}` }] : []),
  );
  const breaks = days.reduce((a, d) => a + (s.wellness?.[d]?.breaks ?? 0), 0);
  const water = days.reduce((a, d) => a + (s.wellness?.[d]?.water ?? 0), 0);
  out.body.extra.push({ label: ['喝水（杯）', 'Water (cups)'], value: `${water}` }, { label: ['起身活动', 'Stretch breaks'], value: `${breaks}` });
  return out;
}

/* ---------------- assessments ---------------- */

export const assessments = (s: Pick<State, 'h3'>) => s.h3?.assessments ?? [];
export const assessmentFor = (s: Pick<State, 'h3'>, kind: ReportKind, key: string) => assessments(s).find((a) => a.kind === kind && a.key === key);
/** The latest assessment made on or before a day. */
export const latestBefore = (s: Pick<State, 'h3'>, day: string, notId?: string) => [...assessments(s)].reverse().find((a) => a.date <= day && a.id !== notId);
