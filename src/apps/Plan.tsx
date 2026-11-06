import { askPlanNote } from './PlanNote';
import { useMemo, useState, type CSSProperties } from 'react';
import { dayKey, parseDay } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { elapsed, parentPeriod, periodLabel, periodOf, shift } from '../lib/period';
import { open } from '../os/router';
import { upcoming, type CountdownView } from '../store/countdowns';
import { PALETTE } from '../store/attrs';
import { useMetrics } from '../store/hooks';
import { PLAN_XP, planPace } from '../store/plans';
import { actions, useStore } from '../store/store';
import type { Plan as PlanT, PlanScope } from '../store/types';
import { Icon } from '../ui/Icon';
import { Bar, Button, Card, CheckBubble, Chip, Empty, Field, Modal, Ring, Segmented } from '../ui/kit';
import { GoalTag, ProjectSelect, ProjectTag } from './goals';

type Tab = PlanScope | 'countdown';
const BELOW: Record<PlanScope, PlanScope | null> = { year: 'month', month: 'week', week: null };
const ABOVE: Record<PlanScope, PlanScope | null> = { year: null, month: 'year', week: 'month' };

export function scopeName(sc: PlanScope, L: (zh: string, en: string) => string) {
  return { year: L('年度', 'Year'), month: L('月度', 'Month'), week: L('本周', 'Week') }[sc];
}

export function Plan() {
  const L = useL();
  const [tab, setTab] = useState<Tab>(() => (sessionStorage.getItem('lifeos:plan-tab') as Tab) || 'week');
  const go = (t: Tab) => {
    setTab(t);
    try {
      sessionStorage.setItem('lifeos:plan-tab', t);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('计划', 'Plans')}</h1>
          <p className="muted">{L('年计划拆成月计划，月计划拆成周计划，周计划一键变成今天的任务。完成从下往上自动汇总。', 'Break the year into months, months into weeks, and pull week items into today. Completion rolls up automatically.')}</p>
        </div>
      </div>
      <nav className="settings-tabs" role="tablist">
        {(
          [
            ['year', 'mountain', L('年', 'Year')],
            ['month', 'calendar', L('月', 'Month')],
            ['week', 'list-checks', L('周', 'Week')],
            ['countdown', 'hourglass', L('倒计时', 'Countdowns')],
          ] as [Tab, string, string][]
        ).map(([id, icon, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => go(id)}>
            <Icon name={icon} size={15} />
            {label}
          </button>
        ))}
        <span className="spacer" />
        <button onClick={() => open('quests')}>
          <Icon name="target" size={15} />
          {L('今天 →', 'Today →')}
        </button>
      </nav>
      {tab === 'countdown' ? <Countdowns /> : <PeriodView key={tab} scope={tab} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PeriodView({ scope }: { scope: PlanScope }) {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const mx = useMetrics();
  const [period, setPeriod] = useState(periodOf(scope));
  const [edit, setEdit] = useState<Partial<PlanT> | null>(null);
  const isNow = period === periodOf(scope);
  const items = s.plans.filter((p) => p.scope === scope && p.period === period);
  const upScope = ABOVE[scope];
  const upPeriod = parentPeriod(period);
  const parents = upScope && upPeriod ? s.plans.filter((p) => p.scope === upScope && p.period === upPeriod) : [];
  const paces = useMemo(() => new Map(items.map((p) => [p.id, planPace(s, p, mx)])), [s, mx, items]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = items.filter((p) => p.done).length;
  const el = elapsed(period);
  const openGoals = s.milestones.filter((m) => m.status !== 'done' && !s.plans.some((p) => p.scope === 'year' && p.period === period && p.goalId === m.id));

  return (
    <>
      <section className="period-head">
        <div className="day-nav">
          <Button size="sm" variant="ghost" icon="chevron-left" title={L('上一个', 'Previous')} onClick={() => setPeriod(shift(period, -1))} />
          <strong>{periodLabel(period, lang)}</strong>
          <Button size="sm" variant="ghost" icon="chevron-right" title={L('下一个', 'Next')} onClick={() => setPeriod(shift(period, 1))} />
          {!isNow && (
            <Button size="sm" variant="soft" onClick={() => setPeriod(periodOf(scope))}>
              {L('回到现在', 'Now')}
            </Button>
          )}
        </div>
        <div className="period-meter">
          <span className="muted small">{L(`时间已过 ${Math.round(el * 100)}%`, `${Math.round(el * 100)}% of the time gone`)}</span>
          <Bar value={el} tone="slate" height={6} />
          <span className="muted small">{L(`完成 ${done}/${items.length}`, `${done}/${items.length} done`)}</span>
        </div>
      </section>

      <div className="grid-2-1">
        <Card title={L(`${scopeName(scope, L)}计划`, `${scopeName(scope, L)} plan`)} icon="list-checks">
          {items.length === 0 ? (
            <Empty
              icon="calendar"
              title={L('这一段时间还没有计划', 'Nothing planned for this period')}
              body={parents.length ? L('可以从右侧的上级计划里拆出来，或者直接在下面写一条。', 'Break something down from the plan on the right, or write one below.') : L('在下面写下这段时间最想完成的几件事。', 'Write down the few things that matter most for this period.')}
            />
          ) : (
            <ul className="plan-list">
              {items.map((p) => (
                <PlanRow key={p.id} p={p} pace={paces.get(p.id)!} onEdit={() => setEdit(p)} />
              ))}
            </ul>
          )}
          <PlanQuickAdd scope={scope} period={period} parents={parents} />
        </Card>

        <div className="stack">
          {upScope && (
            <Card title={L(`来自${scopeName(upScope, L)}计划`, `From the ${scopeName(upScope, L).toLowerCase()} plan`)} icon="route">
              {parents.length === 0 ? (
                <p className="muted small">{L(`${periodLabel(upPeriod!, lang)} 还没有计划。`, `No plan for ${periodLabel(upPeriod!, lang)} yet.`)}</p>
              ) : (
                <ul className="parent-list">
                  {parents.map((pp) => {
                    const pr = planPace(s, pp, mx);
                    const here = s.plans.filter((c) => c.parentId === pp.id && c.period === period).length;
                    return (
                      <li key={pp.id}>
                        <div className="pl-top">
                          <span className={pp.done ? 'is-done' : ''}>{pp.title}</span>
                          <Button
                            size="sm"
                            variant="soft"
                            icon="plus"
                            title={L('拆到这里', 'Break down here')}
                            onClick={() => setEdit({ scope, period, parentId: pp.id, projectId: pp.projectId, title: '' })}
                          />
                        </div>
                        <Bar value={pr.pct} tone={pr.behind ? 'body' : 'teal'} height={5} />
                        <span className="muted small">
                          {Math.round(pr.pct * 100)}% · {L(`本期已拆 ${here} 项`, `${here} here`)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}
          {scope === 'year' && openGoals.length > 0 && (
            <Card title={L('把目标放进年度计划', 'Put goals into this year')} icon="flag">
              <ul className="parent-list">
                {openGoals.slice(0, 6).map((g) => (
                  <li key={g.id}>
                    <div className="pl-top">
                      <span>{g.title}</span>
                      <Button size="sm" variant="soft" icon="plus" title={L('加入年度计划', 'Add to year')} onClick={() => actions.savePlan({ scope: 'year', period, title: g.title, goalId: g.id, projectId: g.projectId })} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="muted small">{L('关联后，目标的关键结果进度会直接计入这条年度计划。', 'Linked goals feed their key-result progress into the year item.')}</p>
            </Card>
          )}
          <Card title={L('它们怎么联动', 'How it links')} icon="sparkles">
            <ul className="sync-facts">
              <li>
                <Icon name="route" size={15} />
                <span>{L('年 → 月 → 周 → 今天：每一级都能从上一级拆出来。', 'Year → month → week → today: each level breaks down from the one above.')}</span>
              </li>
              <li>
                <Icon name="trending-up" size={15} />
                <span>{L('下级完成会自动推高上级进度；全部完成时自动打勾并给 XP。', 'Finishing children pushes the parent up; at 100% it ticks itself and pays XP.')}</span>
              </li>
              <li>
                <Icon name="briefcase" size={15} />
                <span>{L('挂上项目后，项目页里能看到它在每一级的计划。', 'Attach a project and the project page shows its plans at every level.')}</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
      <PlanEditor value={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function PlanRow({ p, pace, onEdit }: { p: PlanT; pace: ReturnType<typeof planPace>; onEdit: () => void }) {
  const L = useL();
  const s = useStore((x) => x);
  const below = BELOW[p.scope];
  const quests = s.quests.filter((q) => q.planId === p.id);
  const parent = p.parentId ? s.plans.find((x) => x.id === p.parentId) : undefined;
  return (
    <li className={`plan-item ${p.done ? 'is-done' : ''}`}>
      <div className="pi-top">
        <CheckBubble checked={!!p.done} onChange={() => actions.togglePlan(p.id)} tone="teal" label={p.title} />
        <button className="pi-title" onClick={onEdit}>
          {p.title}
        </button>
        <span className="pi-xp num muted small">+{PLAN_XP[p.scope]}</span>
        <Button size="sm" variant="soft" icon={p.target ? 'plus' : 'pencil'} onClick={() => askPlanNote(p.id, { manual: true })}>
          {p.target ? L('+1 记一笔', '+1 & note') : L('记进展', 'Log')}
        </Button>
        {p.scope === 'week' && !p.done && (
          <Button size="sm" variant="soft" icon="target" onClick={() => actions.pullToToday(p.id)}>
            {L('加到今天', 'To today')}
          </Button>
        )}
      </div>
      <div className="pi-meta">
        {parent && (
          <span className="link-hint">
            <Icon name="route" size={11} /> {parent.title}
          </span>
        )}
        <ProjectTag id={p.projectId} />
        <GoalTag goalId={p.goalId} />
        {pace.behind && <Chip tone="body">{L('落后于时间进度', 'Behind schedule')}</Chip>}
        {p.auto && p.done && <Chip tone="teal">{L('自动完成', 'Auto-completed')}</Chip>}
      </div>
      {pace.parts > 0 && (
        <div className="pi-progress">
          <Bar value={pace.pct} tone="teal" height={6} />
          <span className="num small">{pace.target ? `${pace.count}/${pace.target} ${p.unit ?? ''}` : `${Math.round(pace.pct * 100)}%`}</span>
          <span className="muted small">
            {pace.children.length > 0 && L(`${pace.children.length} 个${below ? scopeName(below, L) : ''}子项`, `${pace.children.length} ${below ?? ''} items`)}
            {pace.children.length > 0 && pace.quests > 0 && ' · '}
            {pace.quests > 0 && L(`任务 ${pace.questsDone}/${pace.quests}`, `tasks ${pace.questsDone}/${pace.quests}`)}
          </span>
        </div>
      )}
      <PlanLogList p={p} />
      {quests.length > 0 && (
        <ul className="pi-quests">
          {quests.map((q) => {
            const qd = q.kind === 'once' ? !!q.doneAt : (s.completions[dayKey()] ?? []).includes(q.id);
            return (
              <li key={q.id} className={qd ? 'is-done' : ''}>
                <CheckBubble checked={qd} onChange={() => actions.toggleQuest(q.id)} tone={q.attr} label={q.title} />
                <span>{q.title}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/** The plan's progress notes, newest first; editable, with "show all". */
export function PlanLogList({ p, limit = 3 }: { p: PlanT; limit?: number }) {
  const L = useL();
  const lang = useLang();
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const log = [...(p.log ?? [])].reverse();
  if (!log.length) return null;
  const shown = all ? log : log.slice(0, limit);
  const date = (d: string) => parseDay(d).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric' });
  return (
    <ul className="pi-log">
      {shown.map((l) => (
        <li key={l.id}>
          <span className="pl-date num">{date(l.day)}</span>
          {l.amount > 0 && <span className="pl-amt num">+{l.amount}{p.unit ? ` ${p.unit}` : ''}</span>}
          {editing === l.id ? (
            <form
              className="pl-edit"
              onSubmit={(e) => {
                e.preventDefault();
                actions.editPlanLog(p.id, l.id, { note: draft });
                setEditing(null);
              }}
            >
              <input className="input" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => (actions.editPlanLog(p.id, l.id, { note: draft }), setEditing(null))} />
            </form>
          ) : (
            <button className={`pl-note ${l.note ? '' : 'is-empty'}`} onClick={() => (setEditing(l.id), setDraft(l.note ?? ''))}>
              {l.note ?? L('补一句笔记…', 'Add a note…')}
            </button>
          )}
          <button className="icon-btn pl-del" onClick={() => actions.removePlanLog(p.id, l.id)} aria-label={L('删除这条', 'Delete entry')}>
            <Icon name="trash" size={12} />
          </button>
        </li>
      ))}
      {log.length > limit && (
        <li className="pl-more">
          <button className="link-btn" onClick={() => setAll((v) => !v)}>
            {all ? L('收起', 'Show less') : L(`查看全部 ${log.length} 条`, `Show all ${log.length}`)}
          </button>
        </li>
      )}
    </ul>
  );
}

function PlanQuickAdd({ scope, period, parents }: { scope: PlanScope; period: string; parents: PlanT[] }) {
  const L = useL();
  const [t, setT] = useState('');
  const [parentId, setParentId] = useState('');
  const [projectId, setProjectId] = useState<string | undefined>();
  return (
    <form
      className="plan-add"
      onSubmit={(e) => {
        e.preventDefault();
        if (!t.trim()) return;
        const parent = parents.find((p) => p.id === parentId);
        actions.savePlan({ scope, period, title: t.trim(), parentId: parent?.id, projectId: projectId ?? parent?.projectId });
        setT('');
      }}
    >
      <div className="quick-add is-compact">
        <Icon name="plus" size={16} />
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder={L('写一条计划，回车保存', 'Add a plan item, press Enter')} aria-label={L('新计划', 'New plan item')} />
      </div>
      <div className="row2">
        {parents.length > 0 && (
          <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)} aria-label={L('属于哪个上级计划', 'Parent plan')}>
            <option value="">{L('— 不挂上级计划 —', '— No parent —')}</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                ↑ {p.title}
              </option>
            ))}
          </select>
        )}
        <ProjectSelect value={projectId} onChange={setProjectId} />
      </div>
    </form>
  );
}

function PlanEditor({ value, onClose }: { value: Partial<PlanT> | null; onClose: () => void }) {
  const L = useL();
  const lang = useLang();
  const plans = useStore((s) => s.plans);
  const goals = useStore((s) => s.milestones).filter((m) => m.status !== 'done');
  const [d, setD] = useState<Partial<PlanT>>({});
  const [key, setKey] = useState<string | undefined>('__');
  const k = value ? (value.id ?? `new-${value.parentId ?? ''}`) : undefined;
  if (k !== key) {
    setKey(k);
    if (value) setD(value);
  }
  if (!value) return null;
  const p = { title: '', ...value, ...d } as PlanT; // value first: d is filled one render later
  const up = ABOVE[p.scope];
  const upPeriod = parentPeriod(p.period);
  const parents = up && upPeriod ? plans.filter((x) => x.scope === up && x.period === upPeriod) : [];
  const save = () => {
    if (!p.title.trim()) return;
    actions.savePlan({ ...p, title: p.title.trim() });
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={p.id ? L('编辑计划', 'Edit plan item') : L('新计划', 'New plan item')}
      footer={
        <>
          {p.id && (
            <Button variant="danger" icon="trash" onClick={() => (actions.removePlan(p.id), onClose())}>
              {L('删除（含子项）', 'Delete (with children)')}
            </Button>
          )}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            {L('取消', 'Cancel')}
          </Button>
          <Button variant="primary" icon="check" disabled={!p.title.trim()} onClick={save}>
            {L('保存', 'Save')}
          </Button>
        </>
      }
    >
      <div className="form">
        <p className="muted small">
          {scopeName(p.scope, L)} · {periodLabel(p.period, lang)}
        </p>
        <Field label={L('内容', 'Item')}>
          <input className="input" value={p.title} onChange={(e) => setD({ ...p, title: e.target.value })} />
        </Field>
        <Field label={L('备注', 'Note')}>
          <textarea className="input" rows={2} value={p.note ?? ''} onChange={(e) => setD({ ...p, note: e.target.value })} />
        </Field>
        <Field label={L('数量目标（可选）', 'Count target (optional)')} hint={L('例如「读 8 本书」填 8 本。之后每读完一本点「+1 记一笔」，写下书名和感受；关联的任务完成时也会自动 +1。', 'E.g. "read 8 books" → 8 books. Tap "+1 & note" after each one and jot down the title; linked quests add +1 automatically.')}>
          <div className="row-gap">
            <input className="input" type="number" min={0} style={{ maxWidth: 120 }} value={p.target ?? ''} placeholder="8" onChange={(e) => setD({ ...p, target: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })} />
            <input className="input" style={{ maxWidth: 140 }} value={p.unit ?? ''} placeholder={L('本 / 次 / 公里', 'books / times / km')} onChange={(e) => setD({ ...p, unit: e.target.value || undefined })} />
          </div>
        </Field>
        {parents.length > 0 && (
          <Field label={L('属于哪个上级计划', 'Parent plan')}>
            <select className="input" value={p.parentId ?? ''} onChange={(e) => setD({ ...p, parentId: e.target.value || undefined })}>
              <option value="">{L('— 无 —', '— None —')}</option>
              {parents.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="row2">
          <Field label={L('项目', 'Project')}>
            <ProjectSelect value={p.projectId} onChange={(v) => setD({ ...p, projectId: v })} />
          </Field>
          <Field label={L('关联目标', 'Goal')} hint={L('目标进度会计入这条计划', 'Goal progress counts toward this item')}>
            <select className="input" value={p.goalId ?? ''} onChange={(e) => setD({ ...p, goalId: e.target.value || undefined })}>
              <option value="">{L('— 无 —', '— None —')}</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function Countdowns() {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const list = upcoming(s);
  const [edit, setEdit] = useState<Partial<CountdownView & { rawDate: string }> | null>(null);
  return (
    <>
      <div className="row-gap">
        <Button variant="primary" icon="plus" onClick={() => setEdit({ title: '', date: '', icon: 'star', color: 'orange' })}>
          {L('新倒计时', 'New countdown')}
        </Button>
        <span className="muted small">{L('目标的截止日期和项目的截止日期会自动出现在这里。', 'Goal target dates and project deadlines show up here automatically.')}</span>
      </div>
      {list.length === 0 ? (
        <Card>
          <Empty icon="hourglass" title={L('没有即将到来的日子', 'Nothing coming up')} body={L('截稿日、旅行、生日、毕业……', 'Deadlines, trips, birthdays, graduation…')} />
        </Card>
      ) : (
        <div className="cd-grid">
          {list.map((c) => (
            <article key={c.id} className={`cd-card ${c.daysLeft <= 7 ? 'is-soon' : ''}`} style={{ '--tone': `var(--p-${c.color})` } as CSSProperties}>
              <Ring value={c.progress} size={92} stroke={9} tone={c.color as 'blue'}>
                <span className="ring-num num">{c.daysLeft}</span>
                <span className="ring-cap">{L('天', c.daysLeft === 1 ? 'DAY' : 'DAYS')}</span>
              </Ring>
              <div className="cd-body">
                <strong>{c.title}</strong>
                <span className="muted small num">
                  {parseDay(c.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' })}
                </span>
                <div className="pi-meta">
                  {c.source !== 'user' && <Chip icon={c.source === 'goal' ? 'flag' : 'briefcase'}>{c.source === 'goal' ? L('目标', 'Goal') : L('项目截止', 'Project deadline')}</Chip>}
                  {c.repeat && <Chip icon="refresh">{L('每年', 'Yearly')}</Chip>}
                  {c.source === 'user' && <ProjectTag id={c.projectId} />}
                </div>
              </div>
              {c.editable && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon="pencil"
                  title={L('编辑', 'Edit')}
                  onClick={() => {
                    const raw = s.countdowns.find((x) => x.id === c.id)!;
                    setEdit({ ...c, date: raw.date, repeat: raw.repeat === 'yearly' });
                  }}
                />
              )}
            </article>
          ))}
        </div>
      )}
      <CountdownEditor value={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function CountdownEditor({ value, onClose }: { value: Partial<CountdownView> | null; onClose: () => void }) {
  const L = useL();
  const [d, setD] = useState<Partial<CountdownView>>({});
  const [key, setKey] = useState<string | undefined>('__');
  const k = value ? (value.id ?? 'new') : undefined;
  if (k !== key) {
    setKey(k);
    if (value) setD(value);
  }
  if (!value) return null;
  const c = { title: '', date: '', icon: 'star', color: 'orange', ...d } as CountdownView;
  const ok = c.title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(c.date);
  return (
    <Modal
      open
      onClose={onClose}
      title={c.id ? L('编辑倒计时', 'Edit countdown') : L('新倒计时', 'New countdown')}
      footer={
        <>
          {c.id && (
            <Button variant="danger" icon="trash" onClick={() => (actions.removeCountdown(c.id), onClose())}>
              {L('删除', 'Delete')}
            </Button>
          )}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            {L('取消', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!ok}
            onClick={() => {
              actions.saveCountdown({ id: c.id, title: c.title.trim(), date: c.date, icon: c.icon, color: c.color, projectId: c.projectId, repeat: c.repeat ? 'yearly' : undefined });
              onClose();
            }}
          >
            {L('保存', 'Save')}
          </Button>
        </>
      }
    >
      <div className="form">
        <Field label={L('事件', 'Event')}>
          <input className="input" value={c.title} onChange={(e) => setD({ ...c, title: e.target.value })} placeholder={L('例如：NeurIPS 截稿', 'e.g. NeurIPS deadline')} />
        </Field>
        <div className="row2">
          <Field label={L('日期', 'Date')}>
            <input className="input" type="date" value={c.date} onChange={(e) => setD({ ...c, date: e.target.value })} />
          </Field>
          <Field label={L('项目', 'Project')}>
            <ProjectSelect value={c.projectId} onChange={(v) => setD({ ...c, projectId: v })} />
          </Field>
        </div>
        <Segmented
          value={c.repeat ? 'yearly' : 'once'}
          onChange={(v) => setD({ ...c, repeat: v === 'yearly' })}
          options={[
            { value: 'once', label: L('一次性', 'One time') },
            { value: 'yearly', label: L('每年重复（生日、纪念日）', 'Every year (birthdays)') },
          ]}
        />
        <Field label={L('颜色', 'Color')}>
          <div className="swatches">
            {PALETTE.map((col) => (
              <button key={col} type="button" aria-label={col} className={c.color === col ? 'is-on' : ''} style={{ '--sw': `var(--p-${col})` } as CSSProperties} onClick={() => setD({ ...c, color: col })} />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
