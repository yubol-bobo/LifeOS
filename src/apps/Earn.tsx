import { open } from '../os/router';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAttrs } from '../store/attrs';
import { Pie3D } from '../scene/Pie3D';
import { useTheme } from '../os/theme';
import { openDay } from './DayXp';
import { dayKey, lastNDays, parseDay, startOfWeek } from '../lib/date';
import { duration, money } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { useLiveSession } from '../os/live';
import { burst, notify } from '../os/notify';
import { actions, useStore } from '../store/store';
import type { Attr, WorkSession } from '../store/types';
import { cssVar, effortRows, sliceColor } from './effort';
import { Columns } from '../ui/charts';
import { Bar, Button, Card, Empty, Field, Modal, Ring, Segmented, Stat } from '../ui/kit';
import { Odometer } from '../ui/Odometer';
import { AttrPicker } from './Quests';
import { PayCard, ProjectsEditor } from './Settings';
import { Icon } from '../ui/Icon';
import { CountdownPicker, useNextCountdown } from '../ui/CountdownPicker';
import { FocusGoal } from '../ui/FocusGoal';
import { ParkedList } from '../os/ParkedList';
import { fmtMinutes } from '../lib/nextCountdown';
import { GoalTag, ProjectTag } from './goals';
import { isScheduled, onToday } from '../store/links';

export function Earn() {
  const L = useL();
  const lang = useLang();
  const profile = useStore((s) => s.profile);
  const sessions = useStore((s) => s.sessions);
  const live = useLiveSession(80);
  const projects = useStore((s) => s.projects);
  const pay = useStore((s) => s.pay);
  const [projectId, setProjectId] = useState(() => {
    try {
      return localStorage.getItem('lifeos:last-project') ?? '';
    } catch {
      return '';
    }
  });
  const [payOpen, setPayOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const project = projects.find((p) => p.id === projectId);
  const rate = project?.rate ?? profile.hourlyRate;
  const [note, setNote] = useState('');
  const [attr, setAttr] = useState<Attr>('craft');
  // This page is paid work only; project time is started from the Projects app.
  const mode = 'paid' as const;
  const target = useNextCountdown(); // countdown minutes for the next start, 0 = count up (stackable)
  const [link, setLink] = useState('');
  const goals = useStore((s) => s.milestones).filter((g) => g.status !== 'done');
  const quests = useStore((s) => s.quests);
  const completions = useStore((s) => s.completions);
  const openQuests = quests.filter((q) => (q.kind === 'daily' ? isScheduled(q, dayKey()) && !(completions[dayKey()] ?? []).includes(q.id) : onToday(q) && !q.doneAt));
  const openSteps = quests.filter((q) => q.kind === 'once' && q.step && !q.archived && !q.doneAt && !onToday(q));
  const start = () => {
    const q = link.startsWith('q:') ? quests.find((x) => x.id === link.slice(2)) : undefined;
    const goalId = q ? q.goalId : link.startsWith('g:') ? link.slice(2) : undefined;
    actions.startFocus(rate, q ? q.attr : attr, note || q?.title || '', { goalId, questId: q?.id, projectId: project?.id });
    try {
      localStorage.setItem('lifeos:last-project', projectId);
    } catch {
      /* ignore */
    }
  };
  const [manual, setManual] = useState(false);
  const cur = profile.currency;

  // Gold chime every quarter hour of focused time.
  const quarter = live ? Math.floor(live.ms / 900_000) : 0;
  const lastQ = useRef(quarter);
  useEffect(() => {
    if (live?.paid && quarter > lastQ.current) {
      burst(`+${money(live.active.rate / 4, cur)}`, 'gold');
      if (quarter % 4 === 0) notify({ title: L(`专注满 ${quarter / 4} 小时`, `${quarter / 4} hour${quarter > 4 ? 's' : ''} of focus`), body: L(`本次已赚 ${money(live.earned, cur)}，保持节奏。`, `${money(live.earned, cur)} earned this session. Keep going.`), icon: 'coins', tone: 'gold' });
    }
    lastQ.current = quarter;
  }, [quarter]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = dayKey();
  const sow = startOfWeek().getTime();
  const now = new Date();
  const som = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const sum = (f: (t: number) => boolean) => sessions.filter((x) => f(x.start)).reduce((a, x) => ({ ms: a.ms + x.activeMs, earned: a.earned + x.earned }), { ms: 0, earned: 0 });
  const tToday = sum((t) => dayKey(t) === today);
  const tWeek = sum((t) => t >= sow);
  const tMonth = sum((t) => t >= som);
  const tAll = sum(() => true);
  const liveMs = live?.ms ?? 0;
  const liveEarned = live?.earned ?? 0;
  // paid work today (tToday counts every session)
  const pToday = sessions.filter((x) => !x.rate && dayKey(x.start) === today).reduce((a, x) => a + x.activeMs, 0);

  const days = lastNDays(14);
  const chart = days.map((d) => ({
    x: parseDay(d).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric' }),
    y: Math.round(sessions.filter((x) => dayKey(x.start) === d).reduce((a, x) => a + x.earned, 0) + (d === today ? liveEarned : 0)),
  }));

  const recent = [...sessions].sort((a, b) => b.start - a.start).slice(0, 40);

  const perSec = (live?.active.rate ?? rate) / 3600;

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('赚钱', 'Earn')}</h1>
          <p className="muted">{L('赚钱的工作：开始计时，看着收入一秒一秒涨上来。每专注 1 分钟 +1 XP；可以设个倒计时，时间一到就庆祝。项目、健身、写论文这类不赚钱的专注，在「项目」里开始。', 'Paid work: start the clock and watch earnings tick up by the second. +1 XP a minute; set a countdown and celebrate when it’s done. Project time (papers, the gym, study…) starts from Projects.')}</p>
        </div>
        <Button icon="plus" onClick={() => setManual(true)}>
          {L('补录时段', 'Log past session')}
        </Button>
      </div>

      <section className={`earn-hero ${live ? (live.paused ? 'is-paused' : 'is-live') : ''}`}>
        <div className="earn-ring">
          <Ring
            value={live ? (live.target ? Math.min(1, live.ms / live.target) : (live.ms % 900_000) / 900_000) : 0}
            size={232}
            stroke={12}
            tone={(live ? live.paid : mode === 'paid') ? 'wealth' : 'violet'}
          >
            <span className="earn-label">
              {live
                ? live.paused
                  ? L('已暂停', 'Paused')
                  : live.left != null
                    ? live.left > 0
                      ? L('倒计时', 'Remaining')
                      : L('已完成 🎉', 'Done 🎉')
                    : live.paid
                      ? L('本次收入', 'This session')
                      : L('本次专注', 'This session')
                : L('准备就绪', 'Ready')}
            </span>
            {live && live.left != null ? (
              <span className="odo-xl num earn-count">{clock(live.left > 0 ? live.left : live.ms)}</span>
            ) : (live ? live.paid : mode === 'paid') ? (
              <Odometer value={money(liveEarned, cur)} className="odo-xl" />
            ) : (
              <span className="odo-xl num earn-count">{clock(liveMs)}</span>
            )}
            <span className="earn-time num">
              {live && live.left != null ? `${duration(liveMs)} / ${live.active.targetMin}′` : live?.paid || (!live && mode === 'paid') ? duration(liveMs) : `+${Math.floor(liveMs / 60_000)} XP`}
            </span>
          </Ring>
          <span className="earn-rate num">{(live ? live.paid : mode === 'paid') ? `${money(perSec, cur, 4)} / ${L('秒', 'sec')}` : L('📂 项目时间 · 每分钟 +1 XP', '📂 Project time · +1 XP a minute')}</span>
        </div>

        <div className="earn-controls">
          {!live ? (
            <>
              {(
              <button className="pay-chip" onClick={() => setPayOpen(true)}>
                <Icon name="wallet" size={15} />
                <span>
                  {{ hour: L('时薪', 'Hourly'), day: L('日薪', 'Daily'), month: L('月薪', 'Monthly'), year: L('年薪', 'Yearly') }[pay.mode]} <b className="num">{money(pay.amount, cur, 0)}</b>
                </span>
                <span className="muted">→</span>
                <b className="num">{money(rate, cur)}/h</b>
                {project?.rate != null && <span className="muted small">({project.name})</span>}
                <Icon name="pencil" size={13} />
              </button>
              )}
              <div className="row2">
                <Field label={L('为谁工作', 'Working for')}>
                  <div className="input-group">
                    <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                      <option value="">{L('— 默认 —', '— Default —')}</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.rate != null ? ` · ${money(p.rate, cur, 0)}/h` : ''}
                        </option>
                      ))}
                    </select>
                    <Button icon="settings" title={L('管理列表', 'Manage list')} onClick={() => setProjOpen(true)} />
                  </div>
                </Field>
                <Field label={L('在做什么', 'Working on')}>
                  <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={L('例如：客户需求文档', 'e.g. Client spec')} />
                </Field>
              </div>
              <Field label={L('推进哪个任务 / 目标', 'Moves which quest / goal')} hint={L('关联后，专注时长会自动计入目标的「专注小时」，或让任务在达标后自动完成。', 'Linked time counts toward a goal’s focus hours, or auto-completes a quest once its target is reached.')}>
                <select className="input" value={link} onChange={(e) => setLink(e.target.value)}>
                  <option value="">{L('— 不关联 —', '— Nothing specific —')}</option>
                  {openQuests.length > 0 && (
                    <optgroup label={L('今日任务', "Today's quests")}>
                      {openQuests.map((q) => (
                        <option key={q.id} value={`q:${q.id}`}>
                          {q.title}
                          {q.focusMin ? ` · ${q.focusMin}′` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {openSteps.length > 0 && (
                    <optgroup label={L('项目步骤', 'Project steps')}>
                      {openSteps.map((q) => (
                        <option key={q.id} value={`q:${q.id}`}>
                          {q.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {goals.length > 0 && (
                    <optgroup label={L('目标', 'Goals')}>
                      {goals.map((g) => (
                        <option key={g.id} value={`g:${g.id}`}>
                          {g.title}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </Field>
              {!link.startsWith('q:') && (
                <Field label={L('经验计入', 'XP goes to')}>
                  <AttrPicker value={attr} onChange={setAttr} />
                </Field>
              )}
              <CountdownPicker />
              <Button variant="primary" size="lg" icon="play" onClick={start}>
                {target ? L(`开始 ${fmtMinutes(target, true)} 倒计时`, `Start a ${fmtMinutes(target, false)} countdown`) : L('开始计时', 'Start the clock')}
              </Button>
            </>
          ) : (
            <>
              <div className="earn-now">
                <span className="muted">{L('正在进行', 'Now')}</span>
                <strong>{live.active.note || L('专注时段', 'Focus session')}</strong>
                <GoalTag goalId={live.active.goalId} />
                {live.active.projectId && <ProjectTag id={live.active.projectId} />}
                <span className="muted num">
                  {live.paid ? `${money(live.active.rate, cur, 0)}/h` : L('📂 项目', '📂 Project')} · {L('开始于', 'since')} {new Date(live.active.start).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="row-gap">
                <Button size="lg" icon={live.paused ? 'play' : 'pause'} onClick={actions.pauseFocus}>
                  {live.paused ? L('继续', 'Resume') : L('暂停', 'Pause')}
                </Button>
                <Button
                  size="lg"
                  variant="primary"
                  icon="square"
                  onClick={() => {
                    const s = actions.stopFocus();
                    if (s && s.rate > 0) notify({ title: L('已结算', 'Cashed out'), body: `${duration(s.activeMs)} · ${money(s.earned, cur)} · +${Math.round(s.activeMs / 60000)} XP`, icon: 'coins', tone: 'gold' });
                    else if (s) notify({ title: L('已记录这段努力', 'Effort logged'), body: `${s.note || L('专注', 'Focus')} · ${duration(s.activeMs)} · +${Math.round(s.activeMs / 60000)} XP`, icon: 'sprout', tone: 'good' });
                    else notify({ title: L('不足 1 分钟，未记录', 'Under a minute — not logged'), icon: 'info' });
                  }}
                >
                  {live.paid ? L('结束并结算', 'Stop & cash out') : L('结束并记录', 'Stop & log it')}
                </Button>
                <Button size="lg" variant="ghost" icon="trash" title={L('丢弃本次', 'Discard')} onClick={() => actions.stopFocus(false)} />
              </div>
              <div className="row-gap wrap">
                <span className="muted small">{live.target ? L(`倒计时 ${fmtMinutes(live.active.targetMin!, true)} · 加`, `Countdown ${fmtMinutes(live.active.targetMin!, false)} · add`) : L('加个倒计时', 'Add a countdown')}</span>
                {[15, 30, 60].map((m) => (
                  <Button key={m} size="sm" variant="soft" icon="plus" onClick={() => actions.extendFocus(m)}>
                    {m === 60 ? L('1 小时', '1 h') : L(`${m} 分钟`, `${m} min`)}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" icon="pause" onClick={actions.parkFocus}>
                {L('先暂停，去做别的（随时恢复）', 'Pause and switch to something else')}
              </Button>
              {(() => {
                const q = quests.find((x) => x.id === live.active.questId);
                if (!q?.focusMin) return null;
                const spent = sessions.filter((x) => x.questId === q.id && dayKey(x.start) === today).reduce((a, x) => a + x.activeMs, 0) + live.ms;
                return (
                  <div className="goal">
                    <div className="goal-top">
                      <span>{L(`「${q.title}」自动完成进度`, `“${q.title}” auto-complete`)}</span>
                      <span className="num">
                        {Math.floor(spent / 60000)} / {q.focusMin}′
                      </span>
                    </div>
                    <Bar value={spent / (q.focusMin * 60000)} tone={q.attr} height={8} />
                  </div>
                );
              })()}
              <p className="muted small">{L('提示：浏览器标签页标题会实时显示收入，切到别的窗口也能看到。', 'Tip: the browser tab title shows your live earnings, even from another window.')}</p>
            </>
          )}
          <ParkedList />
          <FocusGoal kind="work" doneMs={tToday.ms - pToday + (live?.paid ? liveMs : 0)} />
        </div>
      </section>

      <div className="stats-row">
        <Stat label={L('今天', 'Today')} value={money(tToday.earned + liveEarned, cur, 0)} sub={`${((tToday.ms + liveMs) / 3_600_000).toFixed(1)} h`} tone="wealth" />
        <Stat label={L('本周', 'This week')} value={money(tWeek.earned + liveEarned, cur, 0)} sub={`${((tWeek.ms + liveMs) / 3_600_000).toFixed(1)} h`} />
        <Stat label={L('本月', 'This month')} value={money(tMonth.earned + liveEarned, cur, 0)} sub={`${((tMonth.ms + liveMs) / 3_600_000).toFixed(1)} h`} />
        <Stat label={L('累计', 'All time')} value={money(tAll.earned, cur, 0)} sub={`${(tAll.ms / 3_600_000).toFixed(0)} h`} />
      </div>


      {projects.length > 0 && (
        <Card title={L('本月按「为谁工作」', 'This month by client / project')} icon="briefcase">
          <ul className="proj-break">
            {[...projects.map((p) => ({ id: p.id, name: p.name, color: `var(--p-${p.color})` })), { id: '', name: L('默认 / 未指定', 'Default / unassigned'), color: 'var(--ink-3)' }]
              .map((p) => {
                const list = sessions.filter((x) => x.start >= som && (x.projectId ?? '') === p.id);
                return { ...p, earned: list.reduce((a, x) => a + x.earned, 0), ms: list.reduce((a, x) => a + x.activeMs, 0) };
              })
              .filter((p) => p.ms > 0)
              .sort((a, b) => b.earned - a.earned)
              .map((p, _, arr) => (
                <li key={p.id || 'none'}>
                  <i style={{ background: p.color }} />
                  <span className="pb-name">{p.name}</span>
                  <span className="pb-bar">
                    <span style={{ width: `${(p.earned / Math.max(1, arr[0].earned)) * 100}%`, background: p.color }} />
                  </span>
                  <span className="num muted small">{(p.ms / 3_600_000).toFixed(1)}h</span>
                  <strong className="num">{money(p.earned, cur, 0)}</strong>
                </li>
              ))}
          </ul>
        </Card>
      )}

      <div className="grid-2-1">
        <Card title={L('近 14 天收入', 'Last 14 days')} icon="chart">
          <Columns data={chart} tone="wealth" height={220} format={(v) => money(v, cur, 0)} onPick={(i) => openDay(days[i])} />
        </Card>
        <RecentSessions list={recent.filter((x) => x.rate > 0).slice(0, 12)} />
      </div>

      <ManualSession open={manual} onClose={() => setManual(false)} />
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={L('收入方式', 'How you’re paid')}>
        <PayCard pay={pay} currency={cur} compact />
      </Modal>
      <Modal open={projOpen} onClose={() => setProjOpen(false)} title={L('为谁工作', 'Working for')} width={640}>
        <ProjectsEditor />
      </Modal>
    </div>
  );
}

function RecentSessions({ list }: { list: WorkSession[] }) {
  const L = useL();
  const lang = useLang();
  const cur = useStore((s) => s.profile.currency);
  return (
    <Card
      title={L('最近时段', 'Recent sessions')}
      icon="clock"
      action={
        <button className="link-btn" onClick={() => (sessionStorage.setItem('lifeos:timeline-cat', 'focus'), open('timeline'))}>
          {L('全部记录 →', 'All sessions →')}
        </button>
      }
    >
      {list.length === 0 ? (
        <Empty icon="timer" title={L('还没有记录', 'Nothing logged yet')} />
      ) : (
        <ul className="session-list">
          {list.map((x) => (
            <li key={x.id}>
              <span className="sess-dot" style={{ background: `var(--c-${x.attr})` }} />
              <div className="sess-main">
                <strong>
                  {x.note || L('专注时段', 'Focus session')} <GoalTag goalId={x.goalId} /> {x.projectId && <ProjectTag id={x.projectId} />}
                </strong>
                <span className="muted num">
                  <button className="link-btn" onClick={() => openDay(dayKey(x.start))}>
                    {new Date(x.start).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })}
                  </button>{' '}
                  · {duration(x.activeMs)}
                </span>
              </div>
              <span className={`num sess-amt ${x.rate ? '' : 'is-free'}`}>{x.rate ? money(x.earned, cur) : `📂 +${Math.round(x.activeMs / 60_000)} XP`}</span>
              <Button size="sm" variant="ghost" icon="trash" title={L('删除', 'Delete')} onClick={() => actions.removeSession(x.id)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ManualSession({ open, onClose }: { open: boolean; onClose: () => void }) {
  const L = useL();
  const profile = useStore((s) => s.profile);
  const [date, setDate] = useState(dayKey());
  const [time, setTime] = useState('09:00');
  const [mins, setMins] = useState(60);
  const [rate, setRate] = useState(profile.hourlyRate);
  const [note, setNote] = useState('');
  const [attr, setAttr] = useState<Attr>('craft');
  const save = () => {
    const start = new Date(`${date}T${time}:00`).getTime();
    const activeMs = Math.max(1, mins) * 60_000;
    actions.addSession({ start, end: start + activeMs, activeMs, rate, note, attr });
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={L('补录时段', 'Log past session')}
      footer={
        <>
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            {L('取消', 'Cancel')}
          </Button>
          <Button variant="primary" icon="check" onClick={save}>
            {L('保存', 'Save')}
          </Button>
        </>
      }
    >
      <div className="form">
        <div className="row2">
          <Field label={L('日期', 'Date')}>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={L('开始时间', 'Start')}>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <div className="row2">
          <Field label={L('时长（分钟）', 'Minutes')}>
            <input className="input" type="number" min={1} value={mins} onChange={(e) => setMins(+e.target.value)} />
          </Field>
          <Field label={L('时薪', 'Rate')}>
            <input className="input" type="number" min={0} value={rate} onChange={(e) => setRate(+e.target.value)} />
          </Field>
        </div>
        <Field label={L('内容', 'Note')}>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label={L('经验计入', 'XP goes to')}>
          <AttrPicker value={attr} onChange={setAttr} />
        </Field>
      </div>
    </Modal>
  );
}


/** h:mm:ss or m:ss */
export function clock(ms: number) {
  const t = Math.round(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Today (and this week): where the focused time went — paid work and project time, as an interactive 3D donut. */

export function EffortCard({ live, initial = 'all' }: { live: ReturnType<typeof useLiveSession>; initial?: 'all' | 'paid' | 'free' }) {
  const L = useL();
  const dark = useTheme();
  const sessions = useStore((s) => s.sessions);
  const projects = useStore((s) => s.projects);
  const cur = useStore((s) => s.profile.currency);
  const reduce = useStore((s) => s.profile.reduceMotion);
  const [range, setRange] = useState<'today' | 'week'>('today');
  const [show, setShow] = useState<'all' | 'paid' | 'free'>(initial);
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const from = range === 'today' ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() : startOfWeek().getTime();
  const all = effortRows(sessions, projects, live, from, L('专注', 'Focus'));
  const total = all.reduce((a, r) => a + r.ms, 0);
  const paidMs = all.filter((r) => r.paid).reduce((a, r) => a + r.ms, 0);
  const list = all.filter((r) => show === 'all' || (show === 'paid') === r.paid);
  const shown = list.reduce((a, r) => a + r.ms, 0);
  // stable colour per activity (by first appearance in the full list)
  const colorOf = (id: string) => sliceColor(all, id);
  const paidRim = cssVar('--c-wealth', '#1ba677');
  const freeRim = cssVar('--p-violet', '#7a5ae6');
  const slices = list.map((r) => ({ id: r.id, value: Math.max(1, Math.round(r.ms / 60_000)), color: colorOf(r.id), rim: r.paid ? paidRim : freeRim }));
  const byId = new Map(all.map((r) => [r.id, r]));
  const h = (ms: number) => (ms / 3_600_000).toFixed(1);
  const focusId = sel ?? hov;
  const focusRow = focusId ? byId.get(focusId) : undefined;

  return (
    <Card
      title={L('努力都去哪了', 'Where the effort went')}
      icon="activity"
      action={
        <div className="row-gap wrap">
          <Segmented
            size="sm"
            value={show}
            onChange={(v) => (setShow(v), setSel(null))}
            options={[
              { value: 'all', label: L('全部', 'All') },
              { value: 'paid', label: L('赚钱', 'Paid'), icon: 'coins' },
              { value: 'free', label: L('项目', 'Projects'), icon: 'briefcase' },
            ]}
          />
          <Segmented
            size="sm"
            value={range}
            onChange={(v) => (setRange(v), setSel(null))}
            options={[
              { value: 'today', label: L('今天', 'Today') },
              { value: 'week', label: L('本周', 'This week') },
            ]}
          />
        </div>
      }
    >
      {total === 0 ? (
        <p className="muted small">{L('还没有记录。工作、健身、写论文……开始一段专注就会出现在这里。', 'Nothing yet. Work, gym, writing — start a session and it shows up here.')}</p>
      ) : (
        <>
          <div className="effort-split">
            <span className="es-paid" style={{ flex: paidMs || 0.0001, opacity: show === 'free' ? 0.25 : 1 }} />
            <span className="es-free" style={{ flex: total - paidMs || 0.0001, opacity: show === 'paid' ? 0.25 : 1 }} />
          </div>
          <div className="effort-legend muted small">
            <span>
              <i className="es-paid" /> {L('赚钱的工作', 'Paid')} <b className="num">{h(paidMs)}h</b>
            </span>
            <span>
              <i className="es-free" /> {L('项目', 'Projects')} <b className="num">{h(total - paidMs)}h</b>
            </span>
            <span>
              {L('合计', 'Total')} <b className="num">{h(total)}h</b> · <b className="num">+{Math.round(total / 60_000)}</b> XP
            </span>
          </div>
          {list.length === 0 ? (
            <p className="muted small">{show === 'paid' ? L('这段时间还没有赚钱的专注。', 'No paid focus in this range yet.') : L('这段时间还没有项目专注。', 'No project focus in this range yet.')}</p>
          ) : (
            <div className="effort-viz">
              <Pie3D
                slices={slices}
                dark={dark}
                height={360}
                still={reduce}
                selected={sel}
                onSelect={setSel}
                onHover={setHov}
                center={
                  <>
                    <b className="num">{focusRow ? h(focusRow.ms) : h(shown)}h</b>
                    <span>{focusRow ? `${Math.round((focusRow.ms / shown) * 100)}%` : show === 'all' ? L('全部专注', 'all focus') : show === 'paid' ? L('赚钱的', 'paid') : L('项目', 'projects')}</span>
                  </>
                }
                tooltip={(id) => {
                  const r = byId.get(id);
                  if (!r) return null;
                  return (
                    <>
                      <span className="tip-k">
                        {r.label} {r.paid ? '' : '📂'}
                      </span>
                      <span className="tip-v num">
                        {h(r.ms)}h · {Math.round((r.ms / shown) * 100)}% · {r.paid ? money(r.earned, cur, 0) : `+${Math.round(r.ms / 60_000)} XP`}
                      </span>
                    </>
                  );
                }}
              />
              <ul className="proj-break effort-list">
                {list.map((r) => (
                  <li
                    key={r.id}
                    className={`${focusId === r.id ? 'is-focus' : ''} ${focusId && focusId !== r.id ? 'is-dim' : ''}`}
                    onMouseEnter={() => setHov(r.id)}
                    onMouseLeave={() => setHov(null)}
                    onClick={() => setSel((v) => (v === r.id ? null : r.id))}
                  >
                    <i style={{ background: colorOf(r.id) }} />
                    <span className="pb-name">
                      {r.label} {!r.paid && <small className="muted">📂</small>}
                    </span>
                    <span className="num muted small">
                      {h(r.ms)}h · {Math.round((r.ms / shown) * 100)}%
                    </span>
                    <strong className="num">{r.paid ? money(r.earned, cur, 0) : `+${Math.round(r.ms / 60_000)} XP`}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

const PRESET_ICONS = ['dumbbell', 'footprints', 'bike', 'pencil', 'book-open', 'graduation', 'brain', 'code', 'palette', 'music', 'camera', 'languages', 'leaf', 'heart', 'users', 'utensils', 'house', 'sprout', 'mountain', 'star', 'rocket', 'coffee', 'gamepad', 'notebook'];

/** Add, rename, re-icon, re-attribute, reorder and delete the unpaid-focus quick picks. */
export function PresetEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const L = useL();
  const presets = useStore((s) => s.focusPresets);
  const attrs = useAttrs();
  const [iconFor, setIconFor] = useState<string | null>(null);
  const [name, setName] = useState('');
  const add = () => {
    const n = name.trim();
    if (!n) return;
    actions.saveFocusPreset({ name: n, icon: 'star', attr: attrs.list[0]?.id ?? 'craft' });
    setName('');
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={L('快捷开始', 'Quick start')}
      width={620}
      footer={
        <>
          <Button variant="ghost" icon="refresh" onClick={actions.resetFocusPresets}>
            {L('恢复默认', 'Reset to defaults')}
          </Button>
          <span className="spacer" />
          <Button variant="primary" onClick={onClose}>
            {L('完成', 'Done')}
          </Button>
        </>
      }
    >
      <p className="muted small">{L('点图标换图标；经验会计入右边选的属性。', 'Click an icon to change it; XP goes to the attribute on the right.')}</p>
      <ul className="preset-list">
        {presets.map((p, i) => (
          <li key={p.id}>
            <div className="preset-row">
              <button className="preset-ic" onClick={() => setIconFor(iconFor === p.id ? null : p.id)} aria-label={L('换图标', 'Change icon')} style={{ '--tone': `var(--c-${p.attr})` } as CSSProperties}>
                <Icon name={p.icon} size={18} />
              </button>
              <input className="input" value={p.name} onChange={(e) => actions.saveFocusPreset({ ...p, name: e.target.value })} aria-label={L('名称', 'Name')} />
              <select className="input preset-attr" value={p.attr} onChange={(e) => actions.saveFocusPreset({ ...p, attr: e.target.value })} aria-label={L('经验计入', 'XP goes to')}>
                {attrs.list.map((a) => (
                  <option key={a.id} value={a.id}>
                    {attrs.label(a.id)}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="ghost" icon="arrow-up" disabled={i === 0} onClick={() => actions.moveFocusPreset(p.id, -1)} aria-label={L('上移', 'Move up')} />
              <Button size="sm" variant="ghost" icon="arrow-down" disabled={i === presets.length - 1} onClick={() => actions.moveFocusPreset(p.id, 1)} aria-label={L('下移', 'Move down')} />
              <Button size="sm" variant="ghost" icon="trash" onClick={() => actions.removeFocusPreset(p.id)} aria-label={L('删除', 'Delete')} />
            </div>
            {iconFor === p.id && (
              <div className="icon-pick">
                {PRESET_ICONS.map((ic) => (
                  <button key={ic} type="button" className={p.icon === ic ? 'is-on' : ''} onClick={() => (actions.saveFocusPreset({ ...p, icon: ic }), setIconFor(null))} aria-label={ic}>
                    <Icon name={ic} size={18} />
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
        {presets.length === 0 && <li className="muted small">{L('还没有，加一个吧。', 'Nothing yet — add one.')}</li>}
      </ul>
      <div className="row-gap">
        <input className="input" value={name} placeholder={L('例如：练琴、游泳、写小说', 'e.g. Piano, swimming, novel')} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button icon="plus" onClick={add} disabled={!name.trim()}>
          {L('添加', 'Add')}
        </Button>
      </div>
    </Modal>
  );
}
