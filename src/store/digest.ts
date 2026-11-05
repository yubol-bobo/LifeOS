/**
 * Everything that happened on one day, gathered from all of LifeOS.
 * Used by the daily review ("the day in numbers"), the pet's AI summary (as the prompt input)
 * and the offline summary when no AI provider is set up.
 */
import { addDays, dayKey, parseDay } from '../lib/date';
import { money } from '../lib/format';
import { periodOf } from '../lib/period';
import { ACH_BY_ID } from './achievements';
import { filledSeries } from './assets';
import { upcoming } from './countdowns';
import { goalProgress, scheduledDailies } from './links';
import { planProgress } from './plans';
import { levelInfo, metrics } from './rules';
import type { Lang, Review, State } from './types';

export interface DayDigest {
  day: string;
  weekday: string;
  dateLabel: string;
  name: string;
  questsDone: string[];
  questsMissed: string[];
  focusMin: number;
  paidMin: number;
  earned: number;
  earnedLabel: string;
  focusBy: { label: string; min: number; paid: boolean }[];
  xp: number;
  level: number;
  leveledUp: boolean;
  achievements: string[];
  mood?: { v: number; note?: string };
  water: number;
  waterGoal: number;
  breaks: number;
  pomos: number;
  weekPlans: { title: string; pct: number; done: boolean }[];
  goals: { title: string; pct: number; daysLeft?: number }[];
  trackers: { name: string; value: number; unit: string }[];
  netWorth?: { total: number; delta?: number; label: string };
  citations?: { total: number; delta: number };
  countdowns: { title: string; days: number }[];
  streak: number;
  specials: string[];
  review?: Review;
}

const MOOD_WORD: Record<number, [string, string]> = { 1: ['很糟', 'awful'], 2: ['低落', 'low'], 3: ['一般', 'okay'], 4: ['不错', 'good'], 5: ['超棒', 'great'] };

export function dayDigest(s: State, day = dayKey(), lang: Lang = s.profile.lang): DayDigest {
  const zh = lang === 'zh';
  const date = parseDay(day);
  const inDay = (ts: number) => dayKey(ts) === day;
  const m = metrics(s);
  const done = new Set(s.completions[day] ?? []);
  const dailies = scheduledDailies(s, day);
  const questsDone = [
    ...dailies.filter((q) => done.has(q.id)).map((q) => q.title),
    ...s.quests.filter((q) => q.kind === 'once' && q.doneAt && inDay(q.doneAt)).map((q) => q.title),
  ];
  const questsMissed = dailies.filter((q) => !done.has(q.id)).map((q) => q.title);

  const sessions = s.sessions.filter((x) => inDay(x.start));
  const by = new Map<string, { min: number; paid: boolean }>();
  for (const x of sessions) {
    const label = s.projects.find((p) => p.id === x.projectId)?.name ?? x.note ?? (zh ? '专注' : 'Focus');
    const cur = by.get(label) ?? { min: 0, paid: false };
    cur.min += x.activeMs / 60_000;
    cur.paid ||= x.earned > 0;
    by.set(label, cur);
  }
  const earned = sessions.reduce((a, x) => a + x.earned, 0);
  const events = s.events.filter((e) => inDay(e.ts));
  const xp = events.reduce((a, e) => a + Math.max(0, e.xp), 0);
  const xpBefore = s.events.filter((e) => e.ts < date.getTime()).reduce((a, e) => a + e.xp, 0);
  const xpAfter = s.events.filter((e) => e.ts < date.getTime() + 86_400_000).reduce((a, e) => a + e.xp, 0);
  const achievements = Object.entries(s.achievements)
    .filter(([, ts]) => inDay(ts))
    .map(([id]) => ACH_BY_ID.get(id))
    .filter((a) => !!a)
    .map((a) => (zh ? a!.zh[0] : a!.en[0]));

  const w = s.wellness?.[day];
  const mood = s.moods?.[day];
  const week = periodOf('week', date);
  const weekPlans = s.plans.filter((p) => p.scope === 'week' && p.period === week).map((p) => ({ title: p.title, pct: Math.round((p.done ? 1 : planProgress(s, p, m).pct) * 100), done: !!p.done }));
  const goals = s.milestones
    .filter((g) => g.status === 'active')
    .map((g) => ({ g, pct: goalProgress(s, g, m).pct }))
    .filter((x) => x.pct != null)
    .slice(0, 4)
    .map(({ g, pct }) => ({ title: g.title, pct: Math.round((pct ?? 0) * 100), daysLeft: g.targetDate ? Math.round((parseDay(g.targetDate).getTime() - date.getTime()) / 86_400_000) : undefined }));
  const trackers = s.trackers.flatMap((t) => t.entries.filter((e) => e.date === day).map((e) => ({ name: t.name, value: e.value, unit: t.unit })));

  const series = filledSeries(s);
  const snapIdx = series.findIndex((x) => x.snap.date === day);
  const netWorth = snapIdx >= 0 ? { total: series[snapIdx].total, delta: snapIdx > 0 ? series[snapIdx].total - series[snapIdx - 1].total : undefined, label: money(series[snapIdx].total, s.assets.base, 0) } : undefined;
  const cl = s.citationLog;
  const ci = cl.findIndex((x) => x.date === day);
  const citations = ci >= 0 ? { total: cl[ci].total, delta: ci > 0 ? cl[ci].total - cl[ci - 1].total : 0 } : undefined;

  const countdowns = upcoming(s)
    .filter((c) => c.daysLeft >= 0 && c.daysLeft <= 30)
    .slice(0, 4)
    .map((c) => ({ title: c.title, days: c.daysLeft }));

  const specials: string[] = [];
  if (s.profile.birthDate?.slice(5) === day.slice(5)) specials.push(zh ? '今天是你的生日' : "It's your birthday");
  for (const c of upcoming(s)) if (c.daysLeft === 0) specials.push(zh ? `今天就是「${c.title}」` : `Today is “${c.title}”`);

  let streak = 0;
  for (let d = day; (s.completions[d]?.length ?? 0) > 0; d = addDays(d, -1)) streak++;

  return {
    day,
    weekday: date.toLocaleDateString(zh ? 'zh-CN' : 'en-US', { weekday: 'long' }),
    dateLabel: date.toLocaleDateString(zh ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    name: s.profile.name,
    questsDone,
    questsMissed,
    focusMin: Math.round(sessions.reduce((a, x) => a + x.activeMs, 0) / 60_000),
    paidMin: Math.round(sessions.filter((x) => x.earned > 0).reduce((a, x) => a + x.activeMs, 0) / 60_000),
    earned,
    earnedLabel: money(earned, s.profile.currency),
    focusBy: [...by].map(([label, v]) => ({ label, min: Math.round(v.min), paid: v.paid })).sort((a, b) => b.min - a.min),
    xp,
    level: levelInfo(xpAfter).level,
    leveledUp: levelInfo(xpAfter).level > levelInfo(xpBefore).level,
    achievements,
    mood: mood ? { v: mood.v, note: mood.note } : undefined,
    water: w?.water ?? 0,
    waterGoal: s.pet?.waterGoal ?? 8,
    breaks: w?.breaks ?? 0,
    pomos: w?.pomos ?? 0,
    weekPlans,
    goals,
    trackers,
    netWorth,
    citations,
    countdowns,
    streak,
    specials,
    review: s.reviews?.[day],
  };
}

const hm = (min: number, zh: boolean) => {
  const h = Math.floor(min / 60);
  const mm = min % 60;
  return zh ? (h ? `${h} 小时${mm ? ` ${mm} 分钟` : ''}` : `${mm} 分钟`) : h ? `${h}h${mm ? ` ${mm}m` : ''}` : `${mm}m`;
};

/** Compact, labelled facts for the LLM prompt (no fluff, only what exists). */
export function digestForPrompt(d: DayDigest, lang: Lang) {
  const zh = lang === 'zh';
  const L = (a: string, b: string) => (zh ? a : b);
  const lines: string[] = [];
  lines.push(`${L('日期', 'Date')}: ${d.dateLabel} (${d.weekday})`);
  if (d.name) lines.push(`${L('名字', 'Name')}: ${d.name}`);
  if (d.specials.length) lines.push(`${L('特别', 'Special')}: ${d.specials.join('; ')}`);
  lines.push(`${L('完成的任务', 'Quests done')}: ${d.questsDone.length ? d.questsDone.join('; ') : L('无', 'none')}`);
  if (d.questsMissed.length) lines.push(`${L('未完成的每日习惯', 'Daily habits not done')}: ${d.questsMissed.join('; ')}`);
  if (d.focusMin) lines.push(`${L('专注', 'Focus')}: ${hm(d.focusMin, zh)} — ${d.focusBy.map((x) => `${x.label} ${hm(x.min, zh)}${x.paid ? '' : L('（不计薪）', ' (unpaid)')}`).join(', ')}`);
  if (d.earned > 0) lines.push(`${L('今日入账（时薪计）', 'Earned today (wage timer)')}: ${d.earnedLabel}`);
  lines.push(`XP: +${d.xp}${d.leveledUp ? L(`，升到了 Lv.${d.level}`, `, levelled up to Lv.${d.level}`) : ` (Lv.${d.level})`}; ${L('连胜', 'streak')} ${d.streak}`);
  if (d.achievements.length) lines.push(`${L('解锁成就', 'Achievements')}: ${d.achievements.slice(0, 5).join(', ')}${d.achievements.length > 5 ? L(` 等 ${d.achievements.length} 个`, ` (+${d.achievements.length - 5} more)`) : ''}`);
  if (d.mood) lines.push(`${L('心情', 'Mood')}: ${d.mood.v}/5 (${MOOD_WORD[d.mood.v][zh ? 0 : 1]})${d.mood.note ? ` — “${d.mood.note}”` : ''}`);
  lines.push(`${L('身体', 'Body')}: ${L('喝水', 'water')} ${d.water}/${d.waterGoal}, ${L('起身', 'breaks')} ${d.breaks}, ${L('番茄', 'pomodoros')} ${d.pomos}`);
  if (d.weekPlans.length) lines.push(`${L('本周计划', 'This week’s plan')}: ${d.weekPlans.map((p) => `${p.title} ${p.done ? '✓' : p.pct + '%'}`).join('; ')}`);
  if (d.goals.length) lines.push(`${L('目标进度', 'Goals')}: ${d.goals.map((g) => `${g.title} ${g.pct}%${g.daysLeft != null ? L(`（剩 ${g.daysLeft} 天）`, ` (${g.daysLeft} days left)`) : ''}`).join('; ')}`);
  if (d.trackers.length) lines.push(`${L('记录', 'Logged')}: ${d.trackers.map((t) => `${t.name} ${t.value} ${t.unit}`).join(', ')}`);
  if (d.netWorth) lines.push(`${L('净资产盘点', 'Net worth check-in')}: ${d.netWorth.label}${d.netWorth.delta != null ? ` (${d.netWorth.delta >= 0 ? '+' : ''}${Math.round(d.netWorth.delta)})` : ''}`);
  if (d.citations) lines.push(`${L('引用', 'Citations')}: ${d.citations.total} (${d.citations.delta >= 0 ? '+' : ''}${d.citations.delta})`);
  if (d.countdowns.length) lines.push(`${L('即将到来', 'Coming up')}: ${d.countdowns.map((c) => `${c.title} ${L(`${c.days} 天后`, `in ${c.days} days`)}`).join('; ')}`);
  const r = d.review;
  if (r) {
    const parts: [string | undefined, string, string][] = [
      [r.win, '高光', 'Win'],
      [r.lesson, '收获', 'Learned'],
      [r.friction, '卡点', 'Friction'],
      [r.grateful, '感恩', 'Grateful'],
      [r.deep, '思考', 'Thought'],
      [r.tomorrow, '明天最重要的事', 'Tomorrow’s one thing'],
    ];
    for (const [v, a, b] of parts) if (v?.trim()) lines.push(`${L('复盘·', 'Review · ')}${L(a, b)}: ${v.trim()}`);
  }
  return lines.join('\n');
}

/** A friendly summary without any AI — used when no provider is configured (or offline). */
export function localSummary(d: DayDigest, lang: Lang) {
  const zh = lang === 'zh';
  const out: string[] = [];
  const title = d.questsDone.length >= 5 || d.focusMin >= 240 ? (zh ? '扎实的一天' : 'A solid day') : d.questsDone.length || d.focusMin ? (zh ? '稳稳向前的一天' : 'A steady step forward') : zh ? '安静的一天' : 'A quiet day';
  out.push(`${title} · ${d.dateLabel}`);
  const did: string[] = [];
  if (d.questsDone.length) did.push(zh ? `完成了 ${d.questsDone.length} 个任务（${d.questsDone.slice(0, 3).join('、')}${d.questsDone.length > 3 ? '…' : ''}）` : `finished ${d.questsDone.length} quests (${d.questsDone.slice(0, 3).join(', ')}${d.questsDone.length > 3 ? '…' : ''})`);
  if (d.focusMin) did.push(zh ? `专注 ${hm(d.focusMin, true)}` : `focused ${hm(d.focusMin, false)}`);
  if (d.earned > 0) did.push(zh ? `入账 ${d.earnedLabel}` : `earned ${d.earnedLabel}`);
  if (did.length) out.push('• ' + (zh ? '今天' : 'Today you ') + did.join(zh ? '，' : ', ') + (zh ? '。' : '.'));
  out.push('• ' + (zh ? `获得 ${d.xp} XP${d.leveledUp ? `，升到了 Lv.${d.level}` : ''}${d.achievements.length ? `，解锁「${d.achievements.slice(0, 3).join('」「')}」${d.achievements.length > 3 ? ` 等 ${d.achievements.length} 个成就` : ''}` : ''}。` : `+${d.xp} XP${d.leveledUp ? `, up to Lv.${d.level}` : ''}${d.achievements.length ? `, unlocked ${d.achievements.slice(0, 3).join(', ')}${d.achievements.length > 3 ? ` and ${d.achievements.length - 3} more` : ''}` : ''}.`));
  const body: string[] = [];
  if (d.mood) body.push(zh ? `心情 ${MOOD_WORD[d.mood.v][0]}` : `mood ${MOOD_WORD[d.mood.v][1]}`);
  body.push(zh ? `喝水 ${d.water}/${d.waterGoal} 杯` : `water ${d.water}/${d.waterGoal}`);
  if (d.breaks) body.push(zh ? `起身 ${d.breaks} 次` : `${d.breaks} breaks`);
  out.push('• ' + body.join(zh ? '，' : ', ') + (zh ? '。' : '.'));
  const g = d.goals[0];
  if (g) out.push('• ' + (zh ? `「${g.title}」已完成 ${g.pct}%` : `“${g.title}” is ${g.pct}% done`) + (d.countdowns[0] ? (zh ? `；「${d.countdowns[0].title}」还有 ${d.countdowns[0].days} 天。` : `; “${d.countdowns[0].title}” in ${d.countdowns[0].days} days.`) : zh ? '。' : '.'));
  if (d.questsMissed.length) out.push(zh ? `明天可以先从「${d.questsMissed[0]}」开始。` : `Tomorrow, maybe start with “${d.questsMissed[0]}”.`);
  else out.push(zh ? '明天继续，保持这个节奏。' : 'Same rhythm tomorrow.');
  return out.join('\n');
}
