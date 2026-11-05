import { useEffect, useRef, useState } from 'react';
import { dayKey, lastNDays, parseDay, startOfWeek } from '../lib/date';
import { duration, money } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { useLiveSession } from '../os/live';
import { burst, notify } from '../os/notify';
import { actions, useStore } from '../store/store';
import type { Attr } from '../store/types';
import { Columns } from '../ui/charts';
import { Bar, Button, Card, Empty, Field, Modal, Ring, Stat } from '../ui/kit';
import { Odometer } from '../ui/Odometer';
import { AttrPicker } from './Quests';
import { PayCard, ProjectsEditor } from './Settings';
import { Icon } from '../ui/Icon';
import type { CSSProperties } from 'react';
import { GoalTag } from './goals';
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
  const [link, setLink] = useState('');
  const goals = useStore((s) => s.milestones).filter((g) => g.status !== 'done');
  const quests = useStore((s) => s.quests);
  const completions = useStore((s) => s.completions);
  const openQuests = quests.filter((q) => (q.kind === 'daily' ? isScheduled(q, dayKey()) && !(completions[dayKey()] ?? []).includes(q.id) : !q.archived && !q.doneAt));
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
    if (live && quarter > lastQ.current) {
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
          <h1>{L('时薪计', 'Earn')}</h1>
          <p className="muted">{L('开始工作，看着每一秒变成真实的价值。每专注 1 分钟 +1 XP。', 'Start working and watch every second turn into real value. +1 XP per focused minute.')}</p>
        </div>
        <Button icon="plus" onClick={() => setManual(true)}>
          {L('补录时段', 'Log past session')}
        </Button>
      </div>

      <section className={`earn-hero ${live ? (live.paused ? 'is-paused' : 'is-live') : ''}`}>
        <div className="earn-ring">
          <Ring value={live ? (live.ms % 900_000) / 900_000 : 0} size={232} stroke={12} tone="wealth">
            <span className="earn-label">{live ? (live.paused ? L('已暂停', 'Paused') : L('本次收入', 'This session')) : L('准备就绪', 'Ready')}</span>
            <Odometer value={money(liveEarned, cur)} className="odo-xl" />
            <span className="earn-time num">{duration(liveMs)}</span>
          </Ring>
          <span className="earn-rate num">
            {money(perSec, cur, 4)} / {L('秒', 'sec')}
          </span>
        </div>

        <div className="earn-controls">
          {!live ? (
            <>
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
                  <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={L('例如：写论文', 'e.g. Paper draft')} />
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
              <Button variant="primary" size="lg" icon="play" onClick={start}>
                {L('开始计时', 'Start the clock')}
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
                  {money(live.active.rate, cur, 0)}/h · {L('开始于', 'since')} {new Date(live.active.start).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
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
                    if (s) notify({ title: L('已结算', 'Cashed out'), body: L(`${duration(s.activeMs)} · ${money(s.earned, cur)} · +${Math.round(s.activeMs / 60000)} XP`, `${duration(s.activeMs)} · ${money(s.earned, cur)} · +${Math.round(s.activeMs / 60000)} XP`), icon: 'coins', tone: 'gold' });
                    else notify({ title: L('不足 1 分钟，未记录', 'Under a minute — not logged'), icon: 'info' });
                  }}
                >
                  {L('结束并结算', 'Stop & cash out')}
                </Button>
                <Button size="lg" variant="ghost" icon="trash" title={L('丢弃本次', 'Discard')} onClick={() => actions.stopFocus(false)} />
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
              <span className="num">
                {(todayMs / 3_600_000).toFixed(1)} / {(goalMs / 3_600_000).toFixed(1)} h
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
                  <span className="num sess-amt">{money(x.earned, cur)}</span>
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

function ProjectTag({ id }: { id: string }) {
  const p = useStore((s) => s.projects.find((x) => x.id === id));
  if (!p) return null;
  return (
    <span className="goal-tag" style={{ '--tone': `var(--p-${p.color})` } as CSSProperties}>
      <Icon name="briefcase" size={11} stroke={2.6} />
      <span>{p.name}</span>
    </span>
  );
}
