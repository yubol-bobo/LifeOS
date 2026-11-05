import { useEffect, useRef, useState } from 'react';
import { dayKey, lastNDays, parseDay, startOfWeek } from '../lib/date';
import { duration, money } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { useLiveSession } from '../os/live';
import { burst, notify } from '../os/notify';
import { actions, useStore } from '../store/store';
import type { Attr } from '../store/types';
import { Columns } from '../ui/charts';
import { Bar, Button, Card, Empty, Field, Modal, Ring, Segmented, Stat } from '../ui/kit';
import type { WorkSession } from '../store/types';
import { Odometer } from '../ui/Odometer';
import { AttrPicker } from './Quests';
import { PayCard, ProjectsEditor } from './Settings';
import { Icon } from '../ui/Icon';
import { GoalTag, ProjectTag } from './goals';
import { isScheduled } from '../store/links';

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
  // Paid work or unpaid effort (gym, paper writing, study…) — both are timed and earn XP.
  const [mode, setModeRaw] = useState<'paid' | 'free'>(() => {
    try {
      return (localStorage.getItem('lifeos:focus-mode') as 'paid' | 'free') || 'paid';
    } catch {
      return 'paid';
    }
  });
  const setMode = (m: 'paid' | 'free') => {
    setModeRaw(m);
    try {
      localStorage.setItem('lifeos:focus-mode', m);
    } catch {
      /* ignore */
    }
  };
  const [target, setTarget] = useState(0); // countdown minutes, 0 = none
  const [customOpen, setCustomOpen] = useState(false);
  const sessionsAll = useStore((s) => s.sessions);
  const presets = freePresets(sessionsAll, L);
  const [link, setLink] = useState('');
  const goals = useStore((s) => s.milestones).filter((g) => g.status !== 'done');
  const quests = useStore((s) => s.quests);
  const completions = useStore((s) => s.completions);
  const openQuests = quests.filter((q) => (q.kind === 'daily' ? isScheduled(q, dayKey()) && !(completions[dayKey()] ?? []).includes(q.id) : !q.archived && !q.doneAt));
  const start = () => {
    const q = link.startsWith('q:') ? quests.find((x) => x.id === link.slice(2)) : undefined;
    const goalId = q ? q.goalId : link.startsWith('g:') ? link.slice(2) : undefined;
    actions.startFocus(mode === 'free' ? 0 : rate, q ? q.attr : attr, note || q?.title || '', { goalId, questId: q?.id, projectId: project?.id, ...(target ? { targetMin: target } : {}) });
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
  const goalMs = profile.focusGoalMin * 60_000;
  const todayMs = tToday.ms + liveMs;

  const days = lastNDays(14);
  const chart = days.map((d) => ({
    x: parseDay(d).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric' }),
    y: Math.round(sessions.filter((x) => dayKey(x.start) === d).reduce((a, x) => a + x.earned, 0) + (d === today ? liveEarned : 0)),
  }));

  const recent = [...sessions].sort((a, b) => b.start - a.start).slice(0, 12);
  const perSec = (live?.active.rate ?? rate) / 3600;

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('专注计时', 'Focus')}</h1>
          <p className="muted">{L('赚钱的工作、健身、写论文、学习……每一段专注都会被记下来：时长、经验和贡献。每专注 1 分钟 +1 XP；可以设个倒计时，时间一到就庆祝。', 'Paid work, the gym, paper writing, study — every stretch of focus is logged: time, XP and what it went to. +1 XP per minute; set a countdown and celebrate when it’s done.')}</p>
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
          <span className="earn-rate num">{(live ? live.paid : mode === 'paid') ? `${money(perSec, cur, 4)} / ${L('秒', 'sec')}` : L('🌱 不计薪 · 每分钟 +1 XP', '🌱 Unpaid · +1 XP a minute')}</span>
        </div>

        <div className="earn-controls">
          {!live ? (
            <>
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'paid', label: L('赚钱的工作', 'Paid work'), icon: 'coins' },
                  { value: 'free', label: L('不计薪的努力', 'Unpaid effort'), icon: 'sprout' },
                ]}
              />
              {mode === 'paid' && (
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
              {mode === 'free' && (
                <div className="free-presets" role="group" aria-label={L('常做的事', 'Common activities')}>
                  {presets.map((p) => (
                    <button key={p.note} className={`chip ${note === p.note ? 'is-active' : ''}`} onClick={() => (setNote(p.note), setAttr(p.attr))}>
                      <Icon name={p.icon} size={13} /> {p.note}
                    </button>
                  ))}
                </div>
              )}
              <div className="row2">
                <Field label={mode === 'paid' ? L('为谁工作', 'Working for') : L('属于哪个项目（可选）', 'Project (optional)')}>
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
                  <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'paid' ? L('例如：客户需求文档', 'e.g. Client spec') : L('例如：健身、写论文', 'e.g. Gym, paper writing')} />
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
              <Field label={L('倒计时（可选）', 'Countdown (optional)')} hint={L('时间一到会放烟花庆祝，并额外奖励 XP；不设就一直正计时。', 'When it runs out you get fireworks and bonus XP; leave it off to count up.')}>
                <div className="countdown-pick">
                  {[0, 25, 45, 60, 90, 120].map((m) => (
                    <button key={m} className={`chip ${target === m && !customOpen ? 'is-active' : ''}`} onClick={() => (setTarget(m), setCustomOpen(false))}>
                      {m ? (m >= 60 && m % 60 === 0 ? L(`${m / 60} 小时`, `${m / 60} h`) : L(`${m} 分钟`, `${m} min`)) : L('不设', 'None')}
                    </button>
                  ))}
                  <button className={`chip ${customOpen ? 'is-active' : ''}`} onClick={() => setCustomOpen(true)}>
                    {L('自定义', 'Custom')}
                  </button>
                  {customOpen && (
                    <span className="countdown-custom">
                      <input className="input" type="number" min={1} max={720} value={target || ''} placeholder="50" onChange={(e) => setTarget(Math.max(0, Math.min(720, Math.round(+e.target.value || 0))))} aria-label={L('分钟', 'Minutes')} />
                      {L('分钟', 'min')}
                    </span>
                  )}
                </div>
              </Field>
              <Button variant="primary" size="lg" icon="play" onClick={start}>
                {target ? L(`开始 ${target} 分钟倒计时`, `Start a ${target}-minute countdown`) : L('开始计时', 'Start the clock')}
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
                  {live.paid ? `${money(live.active.rate, cur, 0)}/h` : L('🌱 不计薪', '🌱 Unpaid')} · {L('开始于', 'since')} {new Date(live.active.start).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
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
                <span className="muted small">{live.target ? L('倒计时', 'Countdown') : L('加个倒计时', 'Add a countdown')}</span>
                {[15, 25, 45].map((m) => (
                  <Button key={m} size="sm" variant="soft" icon="plus" onClick={() => actions.extendFocus(m)}>
                    {L(`${m} 分钟`, `${m} min`)}
                  </Button>
                ))}
              </div>
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
          <div className="goal">
            <div className="goal-top">
              <span>{L('今日专注目标', "Today's focus goal")}</span>
              <span className="goal-edit">
                <span className="num">
                  {(todayMs / 3_600_000).toFixed(1)} / {(goalMs / 3_600_000).toFixed(1)} h
                </span>
                <Button size="sm" variant="ghost" icon="minus" title={L('目标减少 30 分钟', 'Goal −30 min')} disabled={profile.focusGoalMin <= 30} onClick={() => actions.profile({ focusGoalMin: Math.max(30, profile.focusGoalMin - 30) })} />
                <Button size="sm" variant="ghost" icon="plus" title={L('目标增加 30 分钟', 'Goal +30 min')} disabled={profile.focusGoalMin >= 16 * 60} onClick={() => actions.profile({ focusGoalMin: Math.min(16 * 60, profile.focusGoalMin + 30) })} />
              </span>
            </div>
            <Bar value={todayMs / goalMs} tone="wealth" height={12} />
          </div>
        </div>
      </section>

      <div className="stats-row">
        <Stat label={L('今天', 'Today')} value={money(tToday.earned + liveEarned, cur, 0)} sub={`${((tToday.ms + liveMs) / 3_600_000).toFixed(1)} h`} tone="wealth" />
        <Stat label={L('本周', 'This week')} value={money(tWeek.earned + liveEarned, cur, 0)} sub={`${((tWeek.ms + liveMs) / 3_600_000).toFixed(1)} h`} />
        <Stat label={L('本月', 'This month')} value={money(tMonth.earned + liveEarned, cur, 0)} sub={`${((tMonth.ms + liveMs) / 3_600_000).toFixed(1)} h`} />
        <Stat label={L('累计', 'All time')} value={money(tAll.earned, cur, 0)} sub={`${(tAll.ms / 3_600_000).toFixed(0)} h`} />
      </div>

      <EffortCard live={live} />

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
          <Columns data={chart} tone="wealth" height={220} format={(v) => money(v, cur, 0)} />
        </Card>
        <Card title={L('最近时段', 'Recent sessions')} icon="clock">
          {recent.length === 0 ? (
            <Empty icon="timer" title={L('还没有记录', 'Nothing logged yet')} />
          ) : (
            <ul className="session-list">
              {recent.map((x) => (
                <li key={x.id}>
                  <span className="sess-dot" style={{ background: `var(--c-${x.attr})` }} />
                  <div className="sess-main">
                    <strong>
                      {x.note || L('专注时段', 'Focus session')} <GoalTag goalId={x.goalId} /> {x.projectId && <ProjectTag id={x.projectId} />}
                    </strong>
                    <span className="muted num">
                      {new Date(x.start).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })} · {duration(x.activeMs)}
                    </span>
                  </div>
                  <span className={`num sess-amt ${x.rate ? '' : 'is-free'}`}>{x.rate ? money(x.earned, cur) : `🌱 +${Math.round(x.activeMs / 60_000)} XP`}</span>
                  <Button size="sm" variant="ghost" icon="trash" title={L('删除', 'Delete')} onClick={() => actions.removeSession(x.id)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
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

/** Quick picks for unpaid effort: what you did recently first, then sensible defaults. */
function freePresets(sessions: WorkSession[], L: (zh: string, en: string) => string) {
  const defaults: { note: string; attr: Attr; icon: string }[] = [
    { note: L('健身', 'Gym'), attr: 'body', icon: 'dumbbell' },
    { note: L('写论文', 'Paper writing'), attr: 'craft', icon: 'pencil' },
    { note: L('阅读', 'Reading'), attr: 'mind', icon: 'book-open' },
    { note: L('学习', 'Study'), attr: 'mind', icon: 'graduation' },
    { note: L('跑步', 'Running'), attr: 'body', icon: 'footprints' },
    { note: L('冥想', 'Meditation'), attr: 'spirit', icon: 'leaf' },
    { note: L('副项目', 'Side project'), attr: 'craft', icon: 'code' },
  ];
  const recent: { note: string; attr: Attr; icon: string }[] = [];
  for (const x of [...sessions].reverse()) {
    if (x.rate || !x.note || recent.some((r) => r.note === x.note) || defaults.some((d) => d.note === x.note)) continue;
    recent.push({ note: x.note, attr: x.attr, icon: 'clock' });
    if (recent.length >= 3) break;
  }
  return [...recent, ...defaults].slice(0, 9);
}

/** Today (and this week): where the focused time went — paid work and unpaid effort side by side. */
function EffortCard({ live }: { live: ReturnType<typeof useLiveSession> }) {
  const L = useL();
  const sessions = useStore((s) => s.sessions);
  const projects = useStore((s) => s.projects);
  const cur = useStore((s) => s.profile.currency);
  const [range, setRange] = useState<'today' | 'week'>('today');
  const from = range === 'today' ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() : startOfWeek().getTime();
  const rows = new Map<string, { label: string; ms: number; paid: boolean; earned: number; attr: Attr }>();
  const add = (label: string, ms: number, paid: boolean, earned: number, attr: Attr) => {
    const k = `${paid ? 'p' : 'f'}:${label}`;
    const r = rows.get(k) ?? { label, ms: 0, paid, earned: 0, attr };
    r.ms += ms;
    r.earned += earned;
    rows.set(k, r);
  };
  const nameOf = (x: { note?: string; projectId?: string }) => x.note || projects.find((p) => p.id === x.projectId)?.name || L('专注', 'Focus');
  for (const x of sessions) if (x.start >= from) add(nameOf(x), x.activeMs, x.rate > 0, x.earned, x.attr);
  if (live) add(nameOf(live.active), live.ms, live.paid, live.earned, live.active.attr);
  const list = [...rows.values()].sort((a, b) => b.ms - a.ms);
  const total = list.reduce((a, r) => a + r.ms, 0);
  const paidMs = list.filter((r) => r.paid).reduce((a, r) => a + r.ms, 0);
  return (
    <Card
      title={L('努力都去哪了', 'Where the effort went')}
      icon="activity"
      action={
        <Segmented
          size="sm"
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: L('今天', 'Today') },
            { value: 'week', label: L('本周', 'This week') },
          ]}
        />
      }
    >
      {total === 0 ? (
        <p className="muted small">{L('还没有记录。工作、健身、写论文……开始一段专注就会出现在这里。', 'Nothing yet. Work, gym, writing — start a session and it shows up here.')}</p>
      ) : (
        <>
          <div className="effort-split">
            <span className="es-paid" style={{ flex: paidMs || 0.0001 }} />
            <span className="es-free" style={{ flex: total - paidMs || 0.0001 }} />
          </div>
          <div className="effort-legend muted small">
            <span>
              <i className="es-paid" /> {L('赚钱的工作', 'Paid')} <b className="num">{(paidMs / 3_600_000).toFixed(1)}h</b>
            </span>
            <span>
              <i className="es-free" /> {L('不计薪的努力', 'Unpaid')} <b className="num">{((total - paidMs) / 3_600_000).toFixed(1)}h</b>
            </span>
            <span>
              {L('合计', 'Total')} <b className="num">{(total / 3_600_000).toFixed(1)}h</b> · <b className="num">+{Math.round(total / 60_000)}</b> XP
            </span>
          </div>
          <ul className="proj-break">
            {list.map((r) => (
              <li key={(r.paid ? 'p' : 'f') + r.label}>
                <i style={{ background: `var(--c-${r.attr})` }} />
                <span className="pb-name">
                  {r.label} {!r.paid && <small className="muted">🌱</small>}
                </span>
                <span className="pb-bar">
                  <span style={{ width: `${(r.ms / list[0].ms) * 100}%`, background: `var(--c-${r.attr})` }} />
                </span>
                <span className="num muted small">{(r.ms / 3_600_000).toFixed(1)}h</span>
                <strong className="num">{r.paid ? money(r.earned, cur, 0) : `+${Math.round(r.ms / 60_000)} XP`}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
