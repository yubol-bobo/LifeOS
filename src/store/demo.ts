import { addDays, dayKey, DAY } from '../lib/date';
import { rng, uid } from '../lib/id';
import { coinsFor, PAPER_XP, QUEST_XP, STEP_XP, MILESTONE_XP, TRACKER_XP } from './rules';
import { defaultState } from './store';
import { defaultRates } from './assets';
import { hourlyFrom } from './defaults';
import { periodOf } from '../lib/period';
import { bi, localizeState } from './builtin';
import { ACHIEVEMENTS, achContext } from './achievements';
import { metrics } from './rules';
import type { Account, Milestone, Paper, Quest, State, XpEvent } from './types';

/**
 * A believable sample life for previews (e.g. the GitHub Pages demo).
 * Every XP event is generated from the underlying records so the ledger is consistent.
 */
export function demoState(profile: Partial<State['profile']>): State {
  const r = rng(20261105);
  const s = defaultState();
  Object.assign(s.profile, { name: 'Alex', birthDate: '1998-06-12', hourlyRate: 45, ...profile });
  s.onboarded = true;
  s.demo = true;
  const zh = s.profile.lang === 'zh';
  const T = (a: string, b: string) => (bi(a, b), zh ? a : b);
  const today = dayKey();
  const events: XpEvent[] = [];
  const at = (day: string, h = 12) => new Date(day + 'T00:00:00').getTime() + h * 3_600_000;
  const push = (ref: string, kind: XpEvent['kind'], xp: number, label: string, ts: number, attr?: XpEvent['attr']) =>
    events.push({ id: uid(), ref, kind, xp, coins: coinsFor(xp), label, ts, attr });

  /* ---- quests ---- */
  const q = (title: string, attr: Quest['attr'], difficulty: Quest['difficulty'], kind: Quest['kind'] = 'daily'): Quest => ({
    // habits are old; one-off to-dos were added today (an open to-do from an earlier day shows as past due)
    id: uid(), title, attr, difficulty, kind, createdAt: kind === 'once' ? Date.now() : Date.now() - 90 * DAY,
  });
  s.quests = [
    q(T('深度写作 90 分钟', 'Deep writing · 90 min'), 'craft', 'hard'),
    q(T('精读 1 篇论文', 'Read one paper closely'), 'mind', 'normal'),
    q(T('跑步 5 公里', 'Run 5 km'), 'body', 'normal'),
    q(T('冥想 10 分钟', 'Meditate · 10 min'), 'spirit', 'easy'),
    q(T('记账 & 复盘', 'Log spending & reflect'), 'wealth', 'easy'),
    q(T('和家人/朋友联系', 'Reach out to someone'), 'bond', 'easy'),
    q(T('回复审稿意见', 'Reply to reviewer comments'), 'mind', 'hard', 'once'),
    q(T('预约体检', 'Book annual check-up'), 'body', 'easy', 'once'),
    q(T('整理 Zotero 文献库', 'Clean up Zotero library'), 'mind', 'easy', 'once'),
  ];
  const dailies = s.quests.filter((x) => x.kind === 'daily');
  dailies[0].focusMin = 90;
  dailies[2].days = [0, 2, 5]; // Mon, Wed, Sat
  dailies[5].days = [2, 6]; // Wed, Sun
  const scheduled = (x: Quest, d: string) => !x.days?.length || x.days.includes((new Date(d + 'T00:00:00').getDay() + 6) % 7);
  const habitRate = [0.72, 0.8, 0.65, 0.55, 0.6, 0.45];
  for (let i = 75; i >= 0; i--) {
    const d = addDays(today, -i);
    if (i > 0 && r() < 0.06) continue; // occasional rest days
    const ids: string[] = [];
    dailies.forEach((x, k) => {
      if (!scheduled(x, d)) return;
      const p = i === 0 ? 0.42 : habitRate[k] + (i < 30 ? 0.12 : 0);
      if (r() < p) {
        ids.push(x.id);
        push(`quest:${x.id}:${d}`, 'quest', QUEST_XP[x.difficulty], x.title, at(d, 8 + k * 2), x.attr);
      }
    });
    if (ids.length) s.completions[d] = ids;
    if (ids.length >= 3 && ids.length === dailies.filter((x) => scheduled(x, d)).length) push(`perfect:${d}`, 'perfect', 30, T('全勤日奖励', 'Perfect day bonus'), at(d, 22), 'spirit');
  }
  const once = s.quests.find((x) => x.kind === 'once' && x.attr === 'mind' && x.difficulty === 'easy')!;
  once.doneAt = Date.now() - 2 * DAY;
  push(`quest:${once.id}`, 'quest', QUEST_XP.easy, once.title, once.doneAt, 'mind');

  /* ---- milestones ---- */
  const step = (title: string, done: boolean) => ({ id: uid(), title, done });
  const ms = (m: Omit<Milestone, 'id'>): Milestone => ({ ...m, id: uid() });
  s.milestones = [
    ms({ title: T('本科毕业', 'Graduated college'), attr: 'mind', size: 'big', status: 'done', doneAt: '2020-06-20', steps: [] }),
    ms({ title: T('开始读博', 'Started the PhD'), attr: 'mind', size: 'epic', status: 'done', doneAt: '2022-08-29', steps: [] }),
    ms({ title: T('第一篇一作论文', 'First first-author paper'), attr: 'craft', size: 'big', status: 'done', doneAt: '2023-10-07', steps: [] }),
    ms({ title: T('完成第一个半程马拉松', 'Ran a half marathon'), attr: 'body', size: 'big', status: 'done', doneAt: '2024-11-03', steps: [] }),
    ms({ title: T('应急基金存够 6 个月', '6-month emergency fund'), attr: 'wealth', size: 'big', status: 'done', doneAt: '2025-09-15', steps: [] }),
    ms({
      title: T('博士资格答辩', 'PhD proposal defense'), attr: 'mind', size: 'epic', status: 'active', targetDate: addDays(today, 70), since: addDays(today, -60),
      krs: [{ id: uid(), kind: 'focus', target: 120 }, { id: uid(), kind: 'quests', target: 60 }],
      note: T('委员会已确定，春季前完成。', 'Committee set — wrap before spring.'),
      steps: [step(T('确定委员会', 'Form committee'), true), step(T('写完 proposal 初稿', 'Draft the proposal'), true), step(T('导师审阅', 'Advisor review'), false), step(T('预答辩彩排', 'Mock defense'), false)],
    }),
    ms({
      title: T('顶会 Oral', 'Oral at a top venue'), attr: 'craft', size: 'big', status: 'active', targetDate: addDays(today, 160), since: addDays(today, -40),
      krs: [{ id: uid(), kind: 'metric', metric: 'citations', target: 300 }],
      steps: [step(T('实验完成', 'Experiments done'), true), step(T('投稿', 'Submit'), false), step(T('Rebuttal', 'Rebuttal'), false)],
    }),
    ms({ title: T('暑期研究实习', 'Summer research internship'), attr: 'wealth', size: 'big', status: 'planned', targetDate: addDays(today, 220), krs: [{ id: uid(), kind: 'manual', title: T('投递 20 家', 'Apply to 20 labs'), target: 20, current: 7 }], steps: [step(T('更新简历', 'Update CV'), true), step(T('内推 3 家', '3 referrals'), false)] }),
    ms({ title: T('全程马拉松', 'Full marathon'), attr: 'body', size: 'epic', status: 'active', targetDate: addDays(today, 340), since: addDays(today, -30), krs: [{ id: uid(), kind: 'tracker', target: 400 }, { id: uid(), kind: 'quests', target: 80 }], steps: [] }),
    ms({ title: T('体重回到 68 kg', 'Back to 68 kg'), attr: 'body', size: 'small', status: 'active', targetDate: addDays(today, 45), since: addDays(today, -40), krs: [{ id: uid(), kind: 'tracker', target: 68 }], steps: [] }),
    ms({ title: T('博士毕业', 'Defend the PhD'), attr: 'mind', size: 'epic', status: 'planned', targetDate: '2028-05-15', steps: [] }),
    ms({ title: T('带父母去一次日本', 'Take my parents to Japan'), attr: 'bond', size: 'big', status: 'planned', targetDate: '2027-04-01', steps: [] }),
  ];
  for (const m of s.milestones) {
    if (m.status === 'done') push(`ms:${m.id}:done`, 'milestone', MILESTONE_XP[m.size], m.title, at(m.doneAt!), m.attr);
    m.steps.filter((x) => x.done).forEach((x, i) => push(`ms:${m.id}:step:${x.id}`, 'step', STEP_XP, `${m.title} · ${x.title}`, Date.now() - (20 - i) * DAY, m.attr));
  }

  /* ---- research ---- */
  const order = ['idea', 'drafting', 'submitted', 'review', 'accepted', 'published'] as const;
  // Typical days spent in each stage before moving on; the last move happened `daysAgo` days ago.
  const GAP = [21, 48, 6, 74, 58];
  const paper = (title: string, venue: string, year: number | undefined, status: Paper['status'], citations: number, firstAuthor: boolean, daysAgo: number): Paper => {
    const n = order.indexOf(status);
    const history: Paper['history'] = [];
    let t = Date.now() - daysAgo * DAY - (2 + n) * 3_600_000;
    for (let i = n; i >= 0; i--) {
      history.unshift({ status: order[i], ...(i ? { from: order[i - 1] } : {}), at: t });
      if (i) t -= GAP[i - 1] * DAY * (0.75 + 0.5 * r());
    }
    return { id: uid(), title, venue, year, status, citations, firstAuthor, source: 'manual', history, updatedAt: Date.now() };
  };
  s.papers = [
    paper('Calibrated Uncertainty for Long-Horizon Language Agents', 'NeurIPS', 2023, 'published', 64, true, 700),
    paper('Sparse Memory Routing in Retrieval-Augmented Models', 'ICLR', 2024, 'published', 41, true, 560),
    paper('A Benchmark for Multi-Step Scientific Reasoning', 'ACL', 2024, 'published', 88, false, 430),
    paper('Learning When to Ask: Clarification Policies for Assistants', 'EMNLP', 2025, 'published', 19, true, 300),
    paper('Self-Correcting Planners via Verifier Feedback', 'ICML', 2025, 'published', 12, false, 140),
    paper('Efficient Long-Context Distillation', 'TMLR', 2025, 'accepted', 3, false, 9),
    paper('Grounded Evaluation of Research Agents', 'ICLR 2027', undefined, 'review', 0, true, 23),
    paper('Curriculum Synthesis for Tool Use', 'ACL 2027', undefined, 'drafting', 0, true, 12),
    paper(T('想法：语言模型的元认知探针', 'Idea: metacognitive probes for LMs'), '', undefined, 'idea', 0, true, 4),
  ];
  // XP lands on the day each stage was actually reached
  for (const p of s.papers)
    for (const m of p.history ?? []) {
      const xp = PAPER_XP[m.status];
      if (xp) push(`paper:${p.id}:${m.status}`, 'paper', xp, p.title, m.at, 'mind');
    }
  const total = s.papers.reduce((a, p) => a + p.citations, 0);
  for (let m = 24; m >= 0; m--) {
    const d = new Date();
    d.setMonth(d.getMonth() - m, 1);
    const f = Math.pow((24 - m) / 24, 1.8);
    s.citationLog.push({ date: m === 0 ? today : dayKey(d), total: Math.round(total * f) });
  }
  s.scholar.byYear = [
    { year: 2023, citations: 9 },
    { year: 2024, citations: 58 },
    { year: 2025, citations: 102 },
    { year: 2026, citations: total - 169 },
  ];

  /* ---- focus sessions ---- */
  const attrs: XpEvent['attr'][] = ['craft', 'mind', 'craft', 'wealth'];
  const notes = [T('论文写作', 'Paper writing'), T('跑实验', 'Experiments'), T('读文献', 'Literature'), T('助教工时', 'TA hours')];
  for (let i = 27; i >= 1; i--) {
    const d = addDays(today, -i);
    const n = 1 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const start = at(d, 9 + k * 3 + r());
      const activeMs = (45 + r() * 110) * 60_000;
      const idx = Math.floor(r() * 4);
      const id = uid();
      s.sessions.push({ id, start, end: start + activeMs + 5 * 60_000, activeMs, rate: s.profile.hourlyRate, earned: (activeMs / 3_600_000) * s.profile.hourlyRate, note: notes[idx], attr: attrs[idx]! });
      push(`focus:${id}`, 'focus', Math.round(activeMs / 60_000), notes[idx], start + activeMs, attrs[idx]);
    }
  }

  /* ---- trackers ---- */
  const days = (n: number) => Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
  const w = days(40).filter(() => r() < 0.7);
  s.trackers = [
    { id: uid(), name: T('体重', 'Weight'), unit: 'kg', attr: 'body', mode: 'latest', goal: 68, lowerIsBetter: true, entries: w.map((d, i) => ({ date: d, value: +(72.4 - i * 0.12 + (r() - 0.5) * 0.6).toFixed(1) })) },
    { id: uid(), name: T('跑步', 'Running'), unit: 'km', attr: 'body', mode: 'total', goal: 100, entries: days(30).filter(() => r() < 0.4).map((d) => ({ date: d, value: +(3 + r() * 7).toFixed(1) })) },
    { id: uid(), name: T('阅读', 'Reading'), unit: T('页', 'pages'), attr: 'mind', mode: 'total', goal: 600, entries: days(30).filter(() => r() < 0.6).map((d) => ({ date: d, value: Math.round(10 + r() * 40) })) },
    { id: uid(), name: T('睡眠', 'Sleep'), unit: 'h', attr: 'spirit', mode: 'latest', goal: 8, entries: days(21).map((d) => ({ date: d, value: +(6.2 + r() * 2).toFixed(1) })) },
  ];

  /* ---- linkage: daily actions → trackers → goals ---- */
  const [weight, running, reading] = s.trackers;
  const goal = (en: string) => s.milestones.find((m) => m.title === T(({ 'PhD proposal defense': '博士资格答辩', 'Full marathon': '全程马拉松', 'Back to 68 kg': '体重回到 68 kg' } as Record<string, string>)[en], en))!;
  goal('Full marathon').krs![0].trackerId = running.id;
  goal('Back to 68 kg').krs![0].trackerId = weight.id;
  dailies[0].goalId = goal('PhD proposal defense').id;
  dailies[1].goalId = goal('PhD proposal defense').id;
  dailies[1].log = { trackerId: reading.id, amount: 20 };
  dailies[2].goalId = goal('Full marathon').id;
  dailies[2].log = { trackerId: running.id, amount: 5 };
  for (const x of s.sessions) if (x.attr === 'craft' || x.attr === 'mind') x.goalId = goal('PhD proposal defense').id;
  // running tracker reflects the run quests that were completed
  for (const [d, ids] of Object.entries(s.completions))
    if (ids.includes(dailies[2].id)) {
      const hit = running.entries.find((e) => e.date === d);
      if (hit) hit.value = +(hit.value + 5).toFixed(1);
      else running.entries.push({ date: d, value: 5 });
    }
  running.entries.sort((a, b) => a.date.localeCompare(b.date));
  for (const t of s.trackers) for (const e of t.entries) push(`trk:${t.id}:${e.date}`, 'tracker', TRACKER_XP, t.name, at(e.date, 21), t.attr);

  /* ---- reward shop ---- */
  s.rewards = [
    { id: uid(), title: T('一杯精品手冲', 'Fancy pour-over coffee'), cost: 60, icon: 'coffee', redeemed: 3 },
    { id: uid(), title: T('一集喜欢的剧', 'One episode of a show'), cost: 90, icon: 'tv', redeemed: 4 },
    { id: uid(), title: T('周末游戏之夜', 'Weekend game night'), cost: 300, icon: 'gamepad', redeemed: 1 },
    { id: uid(), title: T('去吃那家想吃的店', 'Dinner at that place'), cost: 600, icon: 'pizza', redeemed: 0 },
    { id: uid(), title: T('新耳机基金', 'New headphones fund'), cost: 2400, icon: 'headphones', redeemed: 0 },
    { id: uid(), title: T('说走就走的短途旅行', 'Spontaneous weekend trip'), cost: 5000, icon: 'plane', redeemed: 0 },
  ];
  for (const rw of s.rewards)
    for (let i = 0; i < rw.redeemed; i++)
      events.push({ id: uid(), ref: `reward:${rw.id}:${i}`, kind: 'reward', xp: 0, coins: -rw.cost, label: rw.title, ts: Date.now() - (10 + i * 5) * DAY });

  /* ---- pay & projects ("working for") ---- */
  s.pay = { mode: 'year', amount: 93600, hoursPerDay: 8, daysPerWeek: 5 }; // ≈ 45/h
  s.profile.hourlyRate = Math.round(hourlyFrom(s.pay) * 100) / 100;
  s.projects = [
    { id: uid(), name: T('博士研究', 'PhD research'), color: 'violet', category: 'research', status: 'active', note: T('资格答辩 + 两篇顶会', 'Proposal defense + two top-venue papers'), createdAt: Date.now() - 120 * DAY },
    { id: uid(), name: T('助教', 'Teaching assistant'), color: 'teal', rate: 30, category: 'work', status: 'active', deadline: addDays(today, 38), createdAt: Date.now() - 70 * DAY },
    { id: uid(), name: T('咨询副业', 'Consulting gig'), color: 'amber', rate: 120, category: 'work', status: 'active', createdAt: Date.now() - 40 * DAY },
    { id: uid(), name: T('全马训练', 'Marathon training'), color: 'orange', category: 'life', status: 'active', createdAt: Date.now() - 30 * DAY },
  ];
  for (const x of s.sessions) {
    const pr = x.note === notes[3] ? s.projects[1] : r() < 0.14 ? s.projects[2] : s.projects[0];
    x.projectId = pr.id;
    x.rate = pr.rate ?? s.profile.hourlyRate;
    x.earned = (x.activeMs / 3_600_000) * x.rate;
  }

  /* ---- projects ↔ everything, and cascading plans ---- */
  // a project still being planned, and one already finished (with when it moved)
  s.projects.push(
    { id: uid(), name: T('个人网站改版', 'Personal site redesign'), color: 'blue', category: 'life', status: 'planning', note: T('作品集 + 博客', 'Portfolio + blog'), history: [{ status: 'planning', at: Date.now() - 6 * DAY }], createdAt: Date.now() - 6 * DAY },
    { id: uid(), name: T('学会 Rust 基础', 'Learn the basics of Rust'), color: 'red', category: 'life', status: 'done', history: [{ status: 'planning', at: Date.now() - 80 * DAY }, { status: 'active', from: 'planning', at: Date.now() - 74 * DAY }, { status: 'done', from: 'active', at: Date.now() - 19 * DAY }], createdAt: Date.now() - 80 * DAY },
  );
  const [phd, , consult, marathonP] = s.projects;
  const g = (en: string) => s.milestones.find((m) => m.title === T(({ 'PhD proposal defense': '博士资格答辩', 'Full marathon': '全程马拉松', 'Oral at a top venue': '顶会 Oral' } as Record<string, string>)[en], en))!;
  g('PhD proposal defense').projectId = phd.id;
  g('Oral at a top venue').projectId = phd.id;
  g('Full marathon').projectId = marathonP.id;
  s.papers.forEach((p) => (p.projectId = phd.id));
  dailies[0].projectId = phd.id;
  dailies[1].projectId = phd.id;
  dailies[2].projectId = marathonP.id;
  const reviewQ = s.quests.find((q) => q.kind === 'once' && q.difficulty === 'hard')!;
  reviewQ.projectId = phd.id;
  s.quests.push({ id: uid(), title: T('整理客户需求文档', 'Write up client requirements'), kind: 'once', attr: 'wealth', difficulty: 'normal', createdAt: Date.now() - 3 * DAY, projectId: consult.id });
  s.quests.push({ id: uid(), title: T('交付第一版原型', 'Ship first prototype'), kind: 'once', attr: 'craft', difficulty: 'hard', createdAt: Date.now() - 2 * DAY, projectId: consult.id, doneAt: Date.now() - DAY });

  const Y = periodOf('year');
  const M = periodOf('month');
  const W = periodOf('week');
  const plan = (scope: 'year' | 'month' | 'week', period: string, title: string, extra: Partial<import('./types').Plan> = {}) => {
    const p = { id: uid(), scope, period, title, createdAt: Date.now() - 20 * DAY, ...extra };
    s.plans.push(p);
    return p;
  };
  const yDefense = plan('year', Y, T('通过博士资格答辩', 'Pass the PhD proposal defense'), { goalId: g('PhD proposal defense').id, projectId: phd.id });
  const yPapers = plan('year', Y, T('两篇顶会论文', 'Two top-venue papers'), { projectId: phd.id });
  const yRun = plan('year', Y, T('为全马打好基础', 'Build the base for a marathon'), { goalId: g('Full marathon').id, projectId: marathonP.id });
  plan('year', Y, T('存款达到 3 万美元', 'Savings reach $30k'));
  const mProposal = plan('month', M, T('proposal 定稿交给导师', 'Final proposal draft to advisor'), { parentId: yDefense.id, projectId: phd.id });
  const mRebuttal = plan('month', M, T('完成 ICLR rebuttal', 'Finish the ICLR rebuttal'), { parentId: yPapers.id, projectId: phd.id });
  const mRun = plan('month', M, T('本月跑量 120 km', '120 km this month'), { parentId: yRun.id, projectId: marathonP.id });
  plan('month', M, T('给爸妈订感恩节机票', 'Book Thanksgiving flights for parents'), { done: true });
  const wCh3 = plan('week', W, T('写完 proposal 第 3 章', 'Finish proposal chapter 3'), { parentId: mProposal.id, projectId: phd.id });
  const wReply = plan('week', W, T('逐条回复审稿意见', 'Answer every reviewer point'), { parentId: mRebuttal.id, projectId: phd.id });
  const wRun = plan('week', W, T('这周跑 3 次', 'Run 3 times this week'), { parentId: mRun.id, projectId: marathonP.id });
  plan('week', W, T('周日和家人视频', 'Sunday video call with family'));
  // counted plans with progress notes — the details that make looking back worthwhile
  const inMonth = (k: number) => {
    const d = addDays(today, -k);
    return d < `${M}-01` ? `${M}-01` : d;
  };
  const logNote = (p: import('./types').Plan, k: number, amount: number, note: string) => {
    const day = inMonth(k);
    const id = uid();
    (p.log ??= []).push({ id, ts: at(day, 22), day, amount, note });
    push(`plannote:${id}`, 'plan', 3, T(`进展笔记 · ${p.title}`, `Progress note · ${p.title}`), at(day, 22));
  };
  const mBooks = plan('month', M, T('这个月读 4 本书', 'Read 4 books this month'), { target: 4, unit: T('本', 'books') });
  logNote(mBooks, 9, 1, T('《三体》读完了，黑暗森林那段太震撼', 'Finished The Three-Body Problem — the dark forest part is stunning'));
  logNote(mBooks, 3, 1, T('《人类简史》，农业革命那章最有意思', 'Sapiens — the agricultural revolution chapter was the best'));
  const mFilms = plan('month', M, T('看 3 部好电影', 'Watch 3 great films'), { target: 3, unit: T('部', 'films') });
  logNote(mFilms, 6, 1, T('《奥本海默》IMAX，配乐太震撼', 'Oppenheimer in IMAX — that score'));
  const wBench = plan('week', W, T('卧推突破 70 kg', 'Bench press 70 kg'));
  logNote(wBench, 2, 0, T('今天 67.5 kg × 5，比上周 +2.5', '67.5 kg × 5 today, +2.5 on last week'));
  reviewQ.planId = wReply.id;
  dailies[2].planId = wRun.id;
  dailies[0].planId = wCh3.id;

  s.countdowns = [
    { id: uid(), title: T('ICLR rebuttal 截止', 'ICLR rebuttal deadline'), date: addDays(today, 6), icon: 'send', color: 'violet', projectId: phd.id, createdAt: addDays(today, -14) },
    { id: uid(), title: T('感恩节回家', 'Thanksgiving trip home'), date: addDays(today, 21), icon: 'plane', color: 'amber', createdAt: addDays(today, -30) },
    { id: uid(), title: T('妈妈生日', "Mom's birthday"), date: '1968-12-14', icon: 'cake', color: 'pink', repeat: 'yearly', createdAt: addDays(today, -200) },
    { id: uid(), title: T('NeurIPS 2027 截稿', 'NeurIPS 2027 deadline'), date: addDays(today, 190), icon: 'graduation', color: 'blue', projectId: phd.id, createdAt: addDays(today, -10) },
  ];

  /* ---- wellness & mood (correlated, so the insights have something to find) ---- */
  const runQ = dailies[2];
  for (let i = 55; i >= 1; i--) {
    const d = addDays(today, -i);
    const water = Math.round(3 + r() * 6);
    const breaks = Math.round(r() * 5);
    const pomos = Math.round(r() * 4);
    s.wellness[d] = { water, breaks, pomos, pomoMin: pomos * 25 };
    if (r() < 0.12) continue; // some days unlogged
    const focus = s.sessions.filter((x) => dayKey(x.start) === d).reduce((a, x) => a + x.activeMs, 0) / 3_600_000;
    const ran = (s.completions[d] ?? []).includes(runQ.id);
    const v = 2.6 + (focus >= 3 ? 0.9 : 0) + (ran ? 0.7 : 0) + (water >= 6 ? 0.4 : 0) + (breaks >= 3 ? 0.3 : 0) + (r() - 0.5) * 1.4;
    const mv = Math.max(1, Math.min(5, Math.round(v))) as 1 | 2 | 3 | 4 | 5;
    s.moods[d] = { v: mv, ts: at(d, 21) };
    push(`mood:${d}`, 'mood', 5, T('心情打卡', 'Mood check-in'), at(d, 21));
  }
  const lastMood = Object.keys(s.moods).sort().at(-1)!;
  s.moods[lastMood].note = T('跑完步写了两小时，状态很好。', 'Ran, then wrote for two hours. Felt great.');

  /* ---- daily reviews: a habit that grew over the last six weeks ---- */
  const wins = [
    T('终于把实验跑通了', 'Finally got the experiment working'),
    T('读完了那篇拖了一周的论文', 'Finished the paper I’d put off for a week'),
    T('跑了 8 公里，配速比上周快', 'Ran 8 km, faster than last week'),
    T('和导师聊得很顺', 'Great chat with my advisor'),
    T('把邮箱清零了', 'Inbox zero'),
    T('写完了引言的初稿', 'Drafted the introduction'),
  ];
  const lessons = [
    T('早上先做最难的事，效率高很多', 'Hardest thing first works'),
    T('下午三点后不要喝咖啡', 'No coffee after 3 pm'),
    T('写不下去时换个地方就好', 'Stuck? Change rooms'),
    T('番茄钟比硬撑有用', 'Pomodoros beat willpower'),
  ];
  const grates = [T('室友做的晚饭', 'Dinner my roommate made'), T('下午的阳光', 'Afternoon sun'), T('朋友的一条消息', 'A text from a friend'), T('图书馆的安静角落', 'A quiet library corner')];
  for (let i = 42; i >= 1; i--) {
    const d = addDays(today, -i);
    if (r() > (i < 14 ? 0.82 : 0.5)) continue;
    const rv: State['reviews'][string] = { updatedAt: at(d, 22), win: wins[Math.floor(r() * wins.length)] };
    if (r() < 0.6) rv.lesson = lessons[Math.floor(r() * lessons.length)];
    if (r() < 0.5) rv.grateful = grates[Math.floor(r() * grates.length)];
    if (r() < 0.25) rv.tomorrow = T('先写 30 分钟再看手机', 'Write 30 min before checking the phone');
    s.reviews[d] = rv;
    push(`review:${d}`, 'review', 15, T(`每日复盘 · ${d}`, `Daily review · ${d}`), at(d, 22), 'spirit');
    const filled = [rv.win, rv.lesson, rv.grateful, rv.tomorrow].filter(Boolean).length;
    if (filled >= 3) push(`review+:${d}`, 'review', 10, T('深度复盘', 'Deep review'), at(d, 22), 'spirit');
  }
  const yd = addDays(today, -1);
  if (s.reviews[yd])
    s.reviews[yd].ai = T(
      '🌱 稳稳推进的一天\n• 完成 5 个任务，专注 4.2 小时，入账 $189。\n• 心情不错，喝水 7/8 杯，起身 4 次。\n• 「博士资格答辩」推进到 70%，ICLR rebuttal 还有 6 天。\n• 冷知识：章鱼有三颗心脏——今天的你也像同时开了三个引擎。\n明天先把引言改完，再奖励自己一杯手冲。',
      '🌱 A steady step forward\n• 5 quests done, 4.2 h of focus, $189 earned.\n• Good mood, water 7/8, 4 stand-up breaks.\n• “PhD proposal defense” is at 70%; ICLR rebuttal in 6 days.\n• Fun fact: an octopus has three hearts — today you ran on about as many engines.\nTomorrow: finish the intro first, then treat yourself to a pour-over.',
    );

  /* ---- assets: weekly check-ins for half a year ---- */
  s.assets = { base: 'USD', rates: { ...defaultRates('USD') }, cadence: 'weekly' };
  const acct = (name: string, kind: Account['kind'], currency: string, color: Account['color']): Account => ({ id: uid(), name, kind, currency, color });
  s.accounts = [
    acct(T('日常支票账户', 'Everyday checking'), 'bank', 'USD', 'blue'),
    acct(T('高息储蓄', 'High-yield savings'), 'bank', 'USD', 'teal'),
    acct(T('券商账户', 'Brokerage'), 'invest', 'USD', 'violet'),
    acct('Roth IRA', 'retire', 'USD', 'lime'),
    acct(T('招行 + 余额宝', 'CNY savings'), 'bank', 'CNY', 'red'),
    acct('ETH', 'crypto', 'ETH', 'indigo'),
    acct(T('信用卡', 'Credit card'), 'debt', 'USD', 'slate'),
  ];
  let mkt = 1;
  for (let wk = 26; wk >= 0; wk--) {
    const d = addDays(today, -wk * 7 - 3);
    const t = (26 - wk) / 26;
    mkt *= 1 + (r() - 0.42) * 0.05;
    const bal = [4200 + (r() - 0.5) * 1600, 12000 + t * 6200, 21000 * mkt + t * 3000, 6500 + t * 3300 * mkt, 30000 + t * 6000, 0.8, 900 + r() * 1300];
    const balances: Record<string, number> = {};
    s.accounts.forEach((a, i) => (balances[a.id] = a.kind === 'crypto' ? bal[i] : Math.round(bal[i])));
    s.snapshots.push({ date: d, ts: at(d, 20), balances });
    push(`assets:${d}`, 'assets', 20, T('资产盘点', 'Asset check-in'), at(d, 20), 'wealth');
  }

  s.events = events.sort((a, b) => a.ts - b.ts);
  // Achievements a life like this would have earned along the way — dated in the past, not "today".
  for (let pass = 0, i = 0; pass < 4; pass++) {
    const ctx = achContext(s, metrics(s));
    let added = 0;
    for (const a of ACHIEVEMENTS) {
      if (s.achievements[a.id] || a.value(ctx) < a.target) continue;
      const ts = at(addDays(today, -2 - ((i++ * 7) % 70)), 21);
      s.achievements[a.id] = ts;
      s.events.push({ id: uid(), ref: `ach:${a.id}`, ts, kind: 'achievement', xp: a.xp, coins: coinsFor(a.xp), label: T(`🏆 ${a.zh[0]}`, `🏆 ${a.en[0]}`) });
      added++;
    }
    if (!added) break;
  }
  s.events.sort((a, b) => a.ts - b.ts);
  localizeState(s as unknown as Record<string, unknown>, s.profile.lang); // tag built-in text so it follows the language switch
  return s;
}
