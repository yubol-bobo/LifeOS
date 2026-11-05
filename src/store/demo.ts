import { addDays, dayKey, DAY } from '../lib/date';
import { rng, uid } from '../lib/id';
import { coinsFor, PAPER_XP, QUEST_XP, STEP_XP, MILESTONE_XP, TRACKER_XP } from './rules';
import { defaultState } from './store';
import { defaultRates } from './assets';
import { hourlyFrom } from './defaults';
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
  const T = (a: string, b: string) => (zh ? a : b);
  const today = dayKey();
  const events: XpEvent[] = [];
  const at = (day: string, h = 12) => new Date(day + 'T00:00:00').getTime() + h * 3_600_000;
  const push = (ref: string, kind: XpEvent['kind'], xp: number, label: string, ts: number, attr?: XpEvent['attr']) =>
    events.push({ id: uid(), ref, kind, xp, coins: coinsFor(xp), label, ts, attr });

  /* ---- quests ---- */
  const q = (title: string, attr: Quest['attr'], difficulty: Quest['difficulty'], kind: Quest['kind'] = 'daily'): Quest => ({
    id: uid(), title, attr, difficulty, kind, createdAt: Date.now() - 90 * DAY,
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
  const paper = (title: string, venue: string, year: number | undefined, status: Paper['status'], citations: number, firstAuthor: boolean): Paper => ({
    id: uid(), title, venue, year, status, citations, firstAuthor, source: 'manual', updatedAt: Date.now(),
  });
  s.papers = [
    paper('Calibrated Uncertainty for Long-Horizon Language Agents', 'NeurIPS', 2023, 'published', 64, true),
    paper('Sparse Memory Routing in Retrieval-Augmented Models', 'ICLR', 2024, 'published', 41, true),
    paper('A Benchmark for Multi-Step Scientific Reasoning', 'ACL', 2024, 'published', 88, false),
    paper('Learning When to Ask: Clarification Policies for Assistants', 'EMNLP', 2025, 'published', 19, true),
    paper('Self-Correcting Planners via Verifier Feedback', 'ICML', 2025, 'published', 12, false),
    paper('Efficient Long-Context Distillation', 'TMLR', 2025, 'accepted', 3, false),
    paper('Grounded Evaluation of Research Agents', 'ICLR 2027', undefined, 'review', 0, true),
    paper('Curriculum Synthesis for Tool Use', 'ACL 2027', undefined, 'drafting', 0, true),
    paper(T('想法：语言模型的元认知探针', 'Idea: metacognitive probes for LMs'), '', undefined, 'idea', 0, true),
  ];
  const order = ['idea', 'drafting', 'submitted', 'review', 'accepted', 'published'];
  for (const p of s.papers)
    for (const [st, xp] of Object.entries(PAPER_XP))
      if (order.indexOf(st) <= order.indexOf(p.status)) push(`paper:${p.id}:${st}`, 'paper', xp!, p.title, Date.now() - 200 * DAY * r(), 'mind');
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
  const notes = [T('论文写作', 'Paper writing'), T('跑实验', 'Experiments'), T('读文献', 'Reading'), T('助教', 'TA hours')];
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
    { id: uid(), name: T('博士研究', 'PhD research'), color: 'violet' },
    { id: uid(), name: T('助教', 'Teaching assistant'), color: 'teal', rate: 30 },
    { id: uid(), name: T('咨询副业', 'Consulting gig'), color: 'amber', rate: 120 },
  ];
  for (const x of s.sessions) {
    const pr = x.note === notes[3] ? s.projects[1] : r() < 0.14 ? s.projects[2] : s.projects[0];
    x.projectId = pr.id;
    x.rate = pr.rate ?? s.profile.hourlyRate;
    x.earned = (x.activeMs / 3_600_000) * x.rate;
  }

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
  return s;
}
