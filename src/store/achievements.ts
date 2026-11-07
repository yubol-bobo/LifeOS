/**
 * The achievement hall.
 *
 * Achievements are organised as *series* (one idea, several escalating stages) across categories.
 * Each stage is its own achievement with a tier, XP, coins and achievement points. Some series are
 * hidden until their first stage is unlocked. Ids of the original 28 achievements are preserved so
 * nothing already earned is lost or paid twice.
 */
import { addDays, dayKey, parseDay } from '../lib/date';
import { scheduledDailies } from './links';
import { attrLevel, type Metrics } from './rules';
import { bestReviewStreak, reviewFilled } from './review';
import type { State } from './types';

export type Tier = 'bronze' | 'silver' | 'gold' | 'mythic';
export type AchCat = 'quest' | 'streak' | 'plan' | 'goal' | 'project' | 'research' | 'focus' | 'wealth' | 'health' | 'mood' | 'review' | 'track' | 'level' | 'explore' | 'pet' | 'secret';

export const TIER_XP: Record<Tier, number> = { bronze: 50, silver: 120, gold: 300, mythic: 800 };
export const TIER_POINTS: Record<Tier, number> = { bronze: 10, silver: 25, gold: 50, mythic: 100 };
export const TIER_LABEL: Record<Tier, [string, string]> = { bronze: ['青铜', 'Bronze'], silver: ['白银', 'Silver'], gold: ['黄金', 'Gold'], mythic: ['传说', 'Mythic'] };

export const CATS: { id: AchCat; zh: string; en: string; icon: string }[] = [
  { id: 'quest', zh: '任务', en: 'Quests', icon: 'list-checks' },
  { id: 'streak', zh: '连胜', en: 'Streaks', icon: 'flame' },
  { id: 'plan', zh: '计划', en: 'Plans', icon: 'calendar' },
  { id: 'goal', zh: '目标', en: 'Goals', icon: 'flag' },
  { id: 'project', zh: '项目', en: 'Projects', icon: 'briefcase' },
  { id: 'research', zh: '学术', en: 'Research', icon: 'graduation' },
  { id: 'focus', zh: '专注', en: 'Focus', icon: 'timer' },
  { id: 'wealth', zh: '财富', en: 'Wealth', icon: 'coins' },
  { id: 'health', zh: '健康', en: 'Health', icon: 'droplets' },
  { id: 'mood', zh: '心情', en: 'Mood', icon: 'smile' },
  { id: 'review', zh: '复盘', en: 'Reflection', icon: 'notebook' },
  { id: 'track', zh: '追踪', en: 'Tracking', icon: 'activity' },
  { id: 'level', zh: '成长', en: 'Growth', icon: 'trending-up' },
  { id: 'explore', zh: '探索', en: 'Explorer', icon: 'sparkles' },
  { id: 'pet', zh: '宠物', en: 'Pet', icon: 'paw' },
  { id: 'secret', zh: '隐藏', en: 'Secrets', icon: 'lock' },
];

/* ------------------------------------------------------------------ */
/* Context: everything achievements can look at                       */
/* ------------------------------------------------------------------ */

export function achContext(s: State, m: Metrics) {
  const st = s.stats ?? {};
  const hard = new Set(s.quests.filter((q) => q.difficulty === 'hard').map((q) => q.id));
  let hardDone = 0;
  let maxDay = 0;
  for (const ids of Object.values(s.completions)) {
    hardDone += ids.filter((id) => hard.has(id)).length;
    maxDay = Math.max(maxDay, ids.length);
  }
  hardDone += s.quests.filter((q) => q.kind === 'once' && q.doneAt && q.difficulty === 'hard').length;
  const plansDone = (sc: string) => s.plans.filter((p) => p.scope === sc && p.done).length;
  const focusDays = new Set(s.sessions.map((x) => dayKey(x.start))).size;
  const longest = Math.max(0, ...s.sessions.map((x) => x.activeMs)) / 3_600_000;
  const well = Object.values(s.wellness ?? {});
  const goal = s.pet?.waterGoal ?? 8;
  const moods = Object.values(s.moods ?? {});
  const levels = s.attributes.map((a) => attrLevel(m.attrXp[a.id] ?? 0));
  // consecutive weeks with every week plan done
  let weekStreak = 0;
  const weeks = [...new Set(s.plans.filter((p) => p.scope === 'week').map((p) => p.period))].sort().reverse();
  for (const w of weeks) {
    const items = s.plans.filter((p) => p.scope === 'week' && p.period === w);
    if (items.length && items.every((p) => p.done)) weekStreak++;
    else if (weekStreak > 0 || w < weeks[0]) break;
  }
  const weekendDays = Object.entries(s.completions).filter(([d]) => [0, 6].includes(parseDay(d).getDay())).reduce((a, [, ids]) => a + ids.length, 0);
  const unlocked = Object.keys(s.achievements).length;
  // "All in" days: every scheduled habit, a mood, the water goal and 3 h of focus on the same day
  let allInDays = 0;
  for (let i = 0; i < 60; i++) {
    const d = addDays(dayKey(), -i);
    const due = scheduledDailies(s, d);
    const done = new Set(s.completions[d] ?? []);
    const focus = s.sessions.filter((x) => dayKey(x.start) === d).reduce((a, x) => a + x.activeMs, 0);
    if (due.length && due.every((q) => done.has(q.id)) && s.moods?.[d] && (s.wellness?.[d]?.water ?? 0) >= goal && focus >= 3 * 3_600_000) allInDays++;
  }
  const reviews = Object.values(s.reviews ?? {});
  const questDone = (id?: string) => {
    if (!id) return false;
    const q = s.quests.find((x) => x.id === id);
    return !!q?.doneAt;
  };
  return {
    ...m,
    reviews: reviews.filter((r) => reviewFilled(r) > 0).length,
    unpaidHours: s.sessions.filter((x) => !x.rate).reduce((a, x) => a + x.activeMs, 0) / 3_600_000,
    reviewStreak: bestReviewStreak(s),
    deepReviews: reviews.filter((r) => reviewFilled(r) >= 3).length,
    aiSummaries: reviews.filter((r) => (r.ai ?? '').trim()).length,
    tomorrowDone: reviews.filter((r) => questDone(r.tomorrowQuest)).length,
    hardDone,
    maxQuestsDay: maxDay,
    weekPlans: plansDone('week'),
    monthPlans: plansDone('month'),
    yearPlans: plansDone('year'),
    weekPlanStreak: weekStreak,
    planItems: s.plans.length,
    projects: s.projects.length,
    projectsDone: s.projects.filter((p) => p.status === 'done').length,
    epicDone: s.milestones.filter((x) => x.status === 'done' && x.size === 'epic').length,
    goalsWithKr: s.milestones.filter((x) => (x.krs?.length ?? 0) > 0).length,
    focusDays,
    longestSession: longest,
    sessionsCount: s.sessions.length,
    pomos: well.reduce((a, w) => a + (w.pomos ?? 0), 0),
    waterCups: well.reduce((a, w) => a + (w.water ?? 0), 0),
    waterDays: well.filter((w) => (w.water ?? 0) >= goal).length,
    breaks: well.reduce((a, w) => a + (w.breaks ?? 0), 0),
    moodGreat: moods.filter((x) => x.v === 5).length,
    moodNotes: moods.filter((x) => x.note).length,
    trackers: s.trackers.length,
    accounts: s.accounts.length,
    maxAttr: Math.max(1, ...levels),
    minAttr: levels.length ? Math.min(...levels) : 1,
    countdowns: s.countdowns.length,
    customized: Number(s.ui.hidden.length > 0 || s.ui.widgets.length > 0) + Number(s.attributes.some((a, i) => !['mind', 'body', 'wealth', 'craft', 'bond', 'spirit'][i] || a.id !== ['mind', 'body', 'wealth', 'craft', 'bond', 'spirit'][i])),
    scholar: Number(!!(s.scholar.gsFetch || s.scholar.lastSync)),
    unlocked,
    allInDays,
    weekendDays,
    stat: (k: string) => st[k] ?? 0,
  };
}
export type AchCtx = ReturnType<typeof achContext>;

/* ------------------------------------------------------------------ */
/* Series                                                             */
/* ------------------------------------------------------------------ */

interface StageDef {
  n: number;
  tier: Tier;
  id?: string; // keep legacy ids
  zh?: string;
  en?: string;
}
interface SeriesDef {
  key: string;
  cat: AchCat;
  icon: string;
  zh: [string, string]; // name, description with {n}
  en: [string, string];
  value: (c: AchCtx) => number;
  stages: StageDef[];
  hidden?: boolean;
  title?: boolean; // the final stage grants a wearable title
}

const S = (key: string, cat: AchCat, icon: string, zh: [string, string], en: [string, string], value: (c: AchCtx) => number, stages: StageDef[], extra: Partial<SeriesDef> = {}): SeriesDef => ({ key, cat, icon, zh, en, value, stages, ...extra });
const st = (n: number, tier: Tier, id?: string, zh?: string, en?: string): StageDef => ({ n, tier, id, zh, en });

export const SERIES: SeriesDef[] = [
  /* ---- quests ---- */
  S('quests', 'quest', 'list-checks', ['任务达人', '累计完成 {n} 个任务'], ['Questing', 'Complete {n} quests'], (c) => c.questsDone, [
    st(1, 'bronze', 'first-quest', '第一步', 'First Step'),
    st(10, 'bronze', undefined, '热身完毕', 'Warmed Up'),
    st(50, 'bronze', undefined, '渐入佳境', 'In the Groove'),
    st(100, 'silver', 'quest-100', '日积月累', 'Compound Interest'),
    st(250, 'silver', undefined, '稳扎稳打', 'Steady Hands'),
    st(500, 'gold', 'quest-500', '千锤百炼', 'Relentless'),
    st(1000, 'gold', undefined, '千里之行', 'A Thousand Steps'),
    st(2500, 'mythic', undefined, '行动派', 'Unstoppable'),
  ], { title: true }),
  S('hard', 'quest', 'mountain', ['硬骨头', '完成 {n} 个硬核任务'], ['Hard Mode', 'Complete {n} hard quests'], (c) => c.hardDone, [st(10, 'bronze'), st(50, 'silver'), st(200, 'gold')]),
  S('perfect', 'quest', 'star', ['全勤', '{n} 个全勤日'], ['Perfect Days', '{n} perfect days'], (c) => c.perfectDays, [st(1, 'bronze', undefined, '完美的一天', 'One Perfect Day'), st(10, 'silver', 'perfect-10', '完美主义', 'Perfectionist'), st(50, 'gold'), st(100, 'mythic', undefined, '百分百', 'Flawless')], { title: true }),
  S('bigday', 'quest', 'zap', ['爆发日', '一天内完成 {n} 个每日习惯'], ['Big Day', 'Complete {n} daily habits in one day'], (c) => c.maxQuestsDay, [st(5, 'bronze'), st(8, 'silver'), st(12, 'gold')]),

  /* ---- streaks ---- */
  S('streak', 'streak', 'flame', ['连胜', '连续 {n} 天完成任务'], ['Streak', 'Keep a {n}-day streak'], (c) => c.streak.best, [
    st(3, 'bronze', undefined, '三连', 'Hat Trick'),
    st(7, 'bronze', 'streak-7', '连续七天', 'Week On Fire'),
    st(14, 'silver', undefined, '两周不断', 'Fortnight'),
    st(30, 'silver', 'streak-30', '月度不断', 'Unbroken Month'),
    st(60, 'gold', undefined, '习惯成自然', 'Second Nature'),
    st(100, 'mythic', 'streak-100', '百日筑基', 'Hundred Days'),
    st(365, 'mythic', undefined, '一整年', 'A Whole Year'),
  ], { title: true }),

  /* ---- plans ---- */
  S('weekplans', 'plan', 'list-checks', ['周计划', '完成 {n} 条周计划'], ['Week Plans', 'Complete {n} week plan items'], (c) => c.weekPlans, [st(1, 'bronze', undefined, '本周搞定', 'Week Done'), st(10, 'silver'), st(50, 'gold'), st(200, 'mythic')]),
  S('monthplans', 'plan', 'calendar', ['月计划', '完成 {n} 条月计划'], ['Month Plans', 'Complete {n} month plan items'], (c) => c.monthPlans, [st(1, 'bronze'), st(12, 'silver'), st(48, 'gold')]),
  S('yearplans', 'plan', 'mountain', ['年度计划', '完成 {n} 条年度计划'], ['Year Plans', 'Complete {n} year plan items'], (c) => c.yearPlans, [st(1, 'gold', undefined, '说到做到', 'Said & Done'), st(5, 'mythic', undefined, '年度赢家', 'Year Winner')], { title: true }),
  S('weekstreak', 'plan', 'route', ['周周清', '连续 {n} 周完成全部周计划'], ['Clean Weeks', 'Finish every week plan item {n} weeks in a row'], (c) => c.weekPlanStreak, [st(2, 'silver'), st(4, 'gold'), st(12, 'mythic')]),

  /* ---- goals ---- */
  S('milestones', 'goal', 'flag', ['里程碑', '达成 {n} 个里程碑'], ['Milestones', 'Reach {n} milestones'], (c) => c.milestonesDone, [st(1, 'bronze', 'milestone-1', '里程碑', 'Milestone'), st(5, 'silver'), st(10, 'gold', 'milestone-10', '登高望远', 'Summit Collector'), st(25, 'mythic')]),
  S('epic', 'goal', 'mountain', ['史诗', '达成 {n} 个史诗级目标'], ['Epic', 'Reach {n} epic goals'], (c) => c.epicDone, [st(1, 'gold'), st(3, 'mythic', undefined, '史诗人生', 'Epic Life')], { title: true }),
  S('okr', 'goal', 'target', ['可衡量', '给 {n} 个目标设置关键结果'], ['Measurable', 'Give {n} goals key results'], (c) => c.goalsWithKr, [st(1, 'bronze'), st(5, 'silver')]),

  /* ---- projects ---- */
  S('projects', 'project', 'briefcase', ['项目', '创建 {n} 个项目'], ['Projects', 'Create {n} projects'], (c) => c.projects, [st(1, 'bronze'), st(5, 'silver')]),
  S('shipped', 'project', 'rocket', ['交付', '完成 {n} 个项目'], ['Shipped', 'Finish {n} projects'], (c) => c.projectsDone, [st(1, 'silver', undefined, '交付！', 'Shipped!'), st(5, 'gold'), st(20, 'mythic', undefined, '连续交付', 'Serial Shipper')], { title: true }),

  /* ---- research ---- */
  S('submit', 'research', 'send', ['投稿', '投出 {n} 篇论文'], ['Submissions', 'Submit {n} papers'], (c) => c.papersSubmitted, [st(1, 'bronze', 'paper-submit', '投出去了', 'Hit Submit'), st(5, 'silver'), st(15, 'gold')]),
  S('accepted', 'research', 'book-open', ['发表', '{n} 篇论文被接收'], ['Published', 'Get {n} papers accepted'], (c) => c.papersPublished, [st(1, 'silver', 'paper-pub', '白纸黑字', 'In Print'), st(5, 'gold'), st(10, 'gold', 'paper-10', '著作等身', 'Prolific'), st(25, 'mythic')], { title: true }),
  S('cites', 'research', 'quote', ['被引用', '总引用达到 {n}'], ['Citations', 'Reach {n} citations'], (c) => c.totalCitations, [
    st(10, 'bronze'),
    st(100, 'silver', 'cite-100', '被看见', 'Being Read'),
    st(500, 'gold'),
    st(1000, 'mythic', 'cite-1000', '学术影响力', 'Influence'),
    st(5000, 'mythic', undefined, '领域之声', 'Voice of the Field'),
  ], { title: true }),
  S('hindex', 'research', 'sigma', ['h 指数', 'h-index 达到 {n}'], ['h-index', 'Reach an h-index of {n}'], (c) => c.hIndex, [st(5, 'silver'), st(10, 'gold', 'h-10', 'h 指数 10', 'h-index 10'), st(20, 'mythic')]),
  S('i10', 'research', 'library', ['i10', 'i10-index 达到 {n}'], ['i10', 'Reach an i10-index of {n}'], (c) => c.i10, [st(5, 'silver'), st(20, 'gold')]),

  /* ---- focus ---- */
  S('effort', 'focus', 'dumbbell', ['不为钱的努力', '不计薪的专注累计 {n} 小时'], ['For the Love of It', 'Log {n} hours of unpaid effort'], (c) => c.unpaidHours, [st(10, 'bronze'), st(50, 'silver'), st(200, 'gold'), st(1000, 'mythic')], { title: true }),
  S('countdown', 'focus', 'hourglass', ['说到做到', '完成 {n} 次专注倒计时'], ['On the Clock', 'Finish {n} focus countdowns'], (c) => c.stat('focusTargets'), [st(1, 'bronze'), st(10, 'silver'), st(50, 'gold'), st(200, 'mythic')]),
  S('focus', 'focus', 'timer', ['专注', '累计专注 {n} 小时'], ['Focus', 'Focus for {n} hours'], (c) => c.focusHours, [
    st(1, 'bronze', undefined, '第一个小时', 'First Hour'),
    st(10, 'bronze', 'focus-10', '专注入门', 'Warming Up'),
    st(50, 'silver'),
    st(100, 'gold', 'focus-100', '深度工作', 'Deep Work'),
    st(500, 'gold'),
    st(1000, 'mythic', 'focus-1000', '万时定律', 'Mastery Clock'),
    st(5000, 'mythic', undefined, '时间的主人', 'Master of Time'),
  ], { title: true }),
  S('longfocus', 'focus', 'hourglass', ['心流', '单次专注超过 {n} 小时'], ['Flow', 'A single session over {n} hours'], (c) => c.longestSession, [st(1, 'bronze'), st(2, 'silver'), st(4, 'gold')]),
  S('focusdays', 'focus', 'calendar', ['坚持专注', '在 {n} 个不同的日子专注过'], ['Showing Up', 'Focus on {n} different days'], (c) => c.focusDays, [st(7, 'bronze'), st(30, 'silver'), st(100, 'gold'), st(365, 'mythic')]),
  S('pomo', 'focus', 'timer', ['番茄', '完成 {n} 个番茄钟'], ['Pomodoros', 'Finish {n} pomodoros'], (c) => c.pomos, [st(1, 'bronze', undefined, '第一个番茄', 'First Tomato'), st(25, 'silver'), st(100, 'gold'), st(500, 'mythic', undefined, '番茄园', 'Tomato Farm')]),

  /* ---- wealth ---- */
  S('earned', 'wealth', 'coins', ['收入', '时薪计累计收入 {n}'], ['Earnings', 'Earn {n} with the wage timer'], (c) => c.earned, [st(100, 'bronze'), st(1000, 'silver', 'earn-1k', '第一桶金', 'First Thousand'), st(10000, 'gold', 'earn-10k', '五位数', 'Five Figures'), st(100000, 'mythic', undefined, '六位数', 'Six Figures')], { title: true }),
  S('checkins', 'wealth', 'wallet', ['盘点', '完成 {n} 次资产盘点'], ['Check-ins', 'Do {n} asset check-ins'], (c) => c.checkins, [st(1, 'bronze'), st(4, 'bronze', 'assets-4', '理财新手', 'Bookkeeper'), st(12, 'silver'), st(26, 'gold', 'assets-26', '半年对账', 'Half-Year Ledger'), st(52, 'mythic', undefined, '一年账本', 'Year of Ledgers')]),
  S('treats', 'wealth', 'gift', ['犒劳', '在商店兑换 {n} 次奖励'], ['Treats', 'Redeem {n} rewards'], (c) => c.rewardsRedeemed, [st(1, 'bronze', 'reward-1', '犒劳自己', 'Treat Yourself'), st(10, 'silver'), st(50, 'gold')]),
  S('saver', 'wealth', 'landmark', ['存钱罐', '金币余额达到 {n}'], ['Piggy Bank', 'Hold {n} coins at once'], (c) => c.coins, [st(500, 'bronze'), st(2000, 'silver'), st(10000, 'gold')]),

  /* ---- health ---- */
  S('hydrated', 'health', 'droplets', ['喝够水', '{n} 天喝够每日目标'], ['Hydrated', 'Hit your water goal on {n} days'], (c) => c.waterDays, [st(1, 'bronze'), st(7, 'silver'), st(30, 'gold'), st(100, 'mythic', undefined, '水润人生', 'Well Watered')], { title: true }),
  S('cups', 'health', 'droplets', ['一杯一杯', '累计喝水 {n} 杯'], ['Cup by Cup', 'Drink {n} cups in total'], (c) => c.waterCups, [st(50, 'bronze'), st(500, 'silver'), st(2000, 'gold')]),
  S('breaks', 'health', 'footprints', ['起身', '累计起身活动 {n} 次'], ['Stand Up', 'Take {n} stand-up breaks'], (c) => c.breaks, [st(10, 'bronze'), st(100, 'silver'), st(500, 'gold')]),
  S('bedtime', 'health', 'moon', ['早点睡', '听宠物的话按时睡觉 {n} 次'], ['Lights Out', 'Go to bed on time {n} times'], (c) => c.stat('bedtimeOk'), [st(1, 'bronze'), st(7, 'silver'), st(30, 'gold')]),

  /* ---- mood ---- */
  /* ---- reflection ---- */
  S('reviews', 'review', 'notebook', ['复盘', '写下 {n} 天的每日复盘'], ['Reflection', 'Write {n} daily reviews'], (c) => c.reviews, [
    st(1, 'bronze', undefined, '第一页', 'First Page'),
    st(7, 'bronze', undefined, '一周回望', 'A Week in Words'),
    st(30, 'silver', undefined, '月度日记', 'Monthly Diarist'),
    st(100, 'gold', undefined, '百日自省', 'Hundred Days'),
    st(365, 'mythic', undefined, '自省者', 'The Reflective'),
  ], { title: true }),
  S('reviewstreak', 'review', 'flame', ['复盘连胜', '连续 {n} 天复盘'], ['Reflection Streak', 'Review {n} days in a row'], (c) => c.reviewStreak, [st(3, 'bronze'), st(7, 'silver'), st(30, 'gold'), st(100, 'mythic')]),
  S('deepreview', 'review', 'telescope', ['深度复盘', '{n} 次写满三个以上的问题'], ['Deep Dive', 'Answer 3+ prompts on {n} days'], (c) => c.deepReviews, [st(5, 'bronze'), st(25, 'silver'), st(100, 'gold')]),
  S('tomorrow', 'review', 'target', ['言出必行', '{n} 次完成了复盘里定下的「明天最重要的事」'], ['Follow-Through', "Finish tomorrow's one thing {n} times"], (c) => c.tomorrowDone, [st(1, 'bronze'), st(10, 'silver'), st(50, 'gold')]),
  S('aisummary', 'review', 'sparkles', ['宠物秘书', '保存 {n} 篇宠物写的今日总结'], ['Pet Secretary', 'Save {n} summaries from your pet'], (c) => c.aiSummaries, [st(1, 'bronze'), st(30, 'silver'), st(100, 'gold')]),
  S('mooddays', 'mood', 'smile', ['觉察', '记录 {n} 天心情'], ['Self-Aware', 'Log your mood on {n} days'], (c) => c.moodDays, [st(1, 'bronze'), st(7, 'bronze'), st(30, 'silver', 'mood-30', '情绪觉察', 'Self-Aware'), st(100, 'gold'), st(365, 'mythic')]),
  S('greatdays', 'mood', 'sun', ['好日子', '{n} 个「超棒」的日子'], ['Great Days', '{n} great days'], (c) => c.moodGreat, [st(10, 'silver'), st(50, 'gold')]),
  S('journal', 'mood', 'notebook', ['日记', '给 {n} 天心情写下一句话'], ['Journal', 'Write a line on {n} days'], (c) => c.moodNotes, [st(10, 'bronze'), st(50, 'silver')]),

  /* ---- tracking ---- */
  S('entries', 'track', 'activity', ['数据控', '记录 {n} 条追踪数据'], ['Quantified', 'Log {n} tracker entries'], (c) => c.trackerEntries, [st(1, 'bronze'), st(30, 'silver', 'tracker-30', '数据控', 'Quantified Self'), st(100, 'silver'), st(500, 'gold')]),
  S('trackers', 'track', 'chart', ['多维度', '建立 {n} 个追踪项'], ['Dimensions', 'Create {n} trackers'], (c) => c.trackers, [st(3, 'bronze'), st(8, 'silver')]),

  /* ---- level & attributes ---- */
  S('level', 'level', 'trending-up', ['等级', '达到 {n} 级'], ['Level', 'Reach level {n}'], (c) => c.level.level, [
    st(5, 'bronze', 'level-5', '渐入佳境', 'Getting Good'),
    st(10, 'bronze'),
    st(15, 'silver', 'level-15', '远行', 'Lift Off'),
    st(20, 'silver'),
    st(30, 'mythic', 'level-30', '轨道之上', 'In Orbit'),
    st(40, 'gold'),
    st(50, 'mythic'),
    st(60, 'mythic'),
    st(75, 'mythic'),
    st(100, 'mythic', undefined, '永恒', 'Eternal'),
  ]),
  S('specialist', 'level', 'gem', ['专精', '任意一项属性达到 Lv.{n}'], ['Specialist', 'Any attribute reaches Lv.{n}'], (c) => c.maxAttr, [st(5, 'bronze'), st(10, 'silver'), st(20, 'gold')]),
  S('wellrounded', 'level', 'sparkles', ['全面发展', '所有属性都达到 Lv.{n}'], ['Well-Rounded', 'Every attribute reaches Lv.{n}'], (c) => c.minAttr, [st(3, 'silver'), st(5, 'gold'), st(10, 'mythic', undefined, '六边形战士', 'All-Rounder')], { title: true }),
  S('collector', 'level', 'trophy', ['收藏家', '解锁 {n} 个成就'], ['Collector', 'Unlock {n} achievements'], (c) => c.unlocked, [st(10, 'bronze'), st(30, 'silver'), st(60, 'gold'), st(100, 'mythic', undefined, '成就猎人', 'Achievement Hunter')], { title: true }),

  /* ---- explorer (learn the system) ---- */
  S('ex-sync', 'explore', 'cloud', ['云端', '开启多设备同步'], ['In the Cloud', 'Turn on multi-device sync'], (c) => c.stat('syncOn'), [st(1, 'bronze')]),
  S('ex-scholar', 'explore', 'graduation', ['学术雷达', '连接学术档案'], ['Scholar Radar', 'Connect your scholar profile'], (c) => c.scholar, [st(1, 'bronze')]),
  S('ex-spot', 'explore', 'search', ['快捷键达人', '使用聚焦搜索 {n} 次'], ['Keyboard Pro', 'Use Spotlight {n} times'], (c) => c.stat('spotlight'), [st(10, 'bronze')]),
  S('ex-custom', 'explore', 'palette', ['我的系统', '自定义程序坞、小组件或属性'], ['Made It Mine', 'Customize the dock, widgets or attributes'], (c) => c.customized, [st(1, 'bronze')]),
  S('ex-cd', 'explore', 'hourglass', ['期待', '创建 {n} 个倒计时'], ['Looking Forward', 'Create {n} countdowns'], (c) => c.countdowns, [st(1, 'bronze'), st(10, 'silver')]),
  S('ex-plan', 'explore', 'calendar', ['规划师', '写下 {n} 条计划'], ['Planner', 'Write {n} plan items'], (c) => c.planItems, [st(1, 'bronze'), st(50, 'silver')]),
  S('ex-theme', 'explore', 'moon', ['昼夜', '切换 {n} 次明暗主题'], ['Day & Night', 'Switch themes {n} times'], (c) => c.stat('themeSwitch'), [st(5, 'bronze')]),

  /* ---- pet ---- */
  S('pet-pats', 'pet', 'hand', ['摸摸头', '摸摸宠物 {n} 次'], ['Head Pats', 'Pet your pet {n} times'], (c) => c.stat('petPats'), [st(1, 'bronze'), st(50, 'silver'), st(300, 'gold', undefined, '最佳拍档', 'Best Buddies')], { title: true }),
  S('pet-perch', 'pet', 'paw', ['放到高处', '把宠物放到面板上 {n} 次'], ['Up You Go', 'Drop your pet onto a panel {n} times'], (c) => c.stat('petPerch'), [st(1, 'bronze'), st(20, 'silver')]),
  S('pet-play', 'pet', 'gamepad', ['玩伴', '和宠物玩 {n} 次'], ['Playmate', 'Play with your pet {n} times'], (c) => c.stat('petPlay'), [st(1, 'bronze'), st(25, 'silver')]),
  S('pet-find', 'pet', 'locate', ['你在哪', '找宠物 {n} 次'], ['Where Are You', 'Locate your pet {n} times'], (c) => c.stat('petLocate'), [st(3, 'bronze')]),

  /* ---- secrets (hidden until unlocked) ---- */
  S('sec-night', 'secret', 'moon', ['夜猫子', '在凌晨 0–4 点完成任务'], ['Night Owl', 'Finish a quest between midnight and 4 am'], (c) => c.stat('nightQuests'), [st(1, 'silver')], { hidden: true }),
  S('sec-early', 'secret', 'sun', ['早起的鸟儿', '在早上 6 点前完成任务'], ['Early Bird', 'Finish a quest before 6 am'], (c) => c.stat('earlyQuests'), [st(1, 'silver')], { hidden: true }),
  S('sec-weekend', 'secret', 'cake', ['周末战士', '周末累计完成 {n} 个每日习惯'], ['Weekend Warrior', 'Complete {n} daily habits on weekends'], (c) => c.weekendDays, [st(20, 'silver'), st(100, 'gold')], { hidden: true }),
  S('sec-undo', 'secret', 'refresh', ['回心转意', '取消勾选 {n} 次'], ['Second Thoughts', 'Untick a quest {n} times'], (c) => c.stat('unticks'), [st(10, 'bronze')], { hidden: true }),
  S('sec-past', 'secret', 'clock', ['补作业', '给过去的日子补打卡 {n} 次'], ['Catching Up', 'Log a past day {n} times'], (c) => c.stat('backfill'), [st(5, 'bronze')], { hidden: true }),
  S('sec-marathon', 'secret', 'flame', ['马拉松专注', '单次专注超过 6 小时'], ['Focus Marathon', 'Focus for over 6 hours in one go'], (c) => c.longestSession, [st(6, 'gold')], { hidden: true }),
  S('sec-allin', 'secret', 'crown', ['全能王', '同一天：完成全部习惯、记心情、喝够水、专注 3 小时'], ['All In', 'One day: every habit, mood logged, water goal, 3 h focus'], (c) => c.allInDays, [st(1, 'mythic')], { hidden: true, title: true }),
];

/* ------------------------------------------------------------------ */
/* Flatten into individual achievements                               */
/* ------------------------------------------------------------------ */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

export interface Achievement {
  id: string;
  series: string;
  cat: AchCat;
  icon: string;
  tier: Tier;
  target: number;
  stage: number;
  stages: number;
  hidden: boolean;
  title: boolean; // grants a wearable title
  zh: [string, string];
  en: [string, string];
  xp: number;
  points: number;
  value: (c: AchCtx) => number;
}

const fmt = (t: string, n: number) => t.replace('{n}', n.toLocaleString());

export const ACHIEVEMENTS: Achievement[] = SERIES.flatMap((s) =>
  s.stages.map((g, i) => ({
    id: g.id ?? `${s.key}-${g.n}`,
    series: s.key,
    cat: s.cat,
    icon: s.icon,
    tier: g.tier,
    target: g.n,
    stage: i,
    stages: s.stages.length,
    hidden: !!s.hidden,
    title: !!s.title && i === s.stages.length - 1,
    zh: [g.zh ?? (s.stages.length > 1 ? `${s.zh[0]} ${ROMAN[i]}` : s.zh[0]), fmt(s.zh[1], g.n)] as [string, string],
    en: [g.en ?? (s.stages.length > 1 ? `${s.en[0]} ${ROMAN[i]}` : s.en[0]), fmt(s.en[1], g.n)] as [string, string],
    xp: TIER_XP[g.tier],
    points: TIER_POINTS[g.tier],
    value: s.value,
  })),
);

export const ACH_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const TOTAL_POINTS = ACHIEVEMENTS.reduce((a, x) => a + x.points, 0);
