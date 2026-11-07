import { PALETTE_NAMES } from '../store/defaults';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { daysBetween, dayKey } from '../lib/date';
import { money, num } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { periodLabel } from '../lib/period';
import { open } from '../os/router';
import { ATTR_ICONS, PALETTE } from '../store/attrs';
import { upcoming } from '../store/countdowns';
import { useMetrics } from '../store/hooks';
import { goalProgress } from '../store/links';
import { planProgress, projectStats } from '../store/plans';
import { actions, useStore } from '../store/store';
import type { Category, Project } from '../store/types';
import { Icon } from '../ui/Icon';
import { Bar, Button, Card, CheckBubble, Chip, Empty, Field, Modal, Segmented } from '../ui/kit';
import { scopeName } from './Plan';
import { DueChip } from './goals';
import { focusProject, LiveFocusBar, ProjectBoard, QuickStart } from './ProjectBoard';
import { EffortCard, PresetEditor } from './Earn';
import { useLiveSession } from '../os/live';
import { ParkedList } from '../os/ParkedList';
import { CountdownPicker } from '../ui/CountdownPicker';
import { FocusGoal } from '../ui/FocusGoal';

export function useCategories() {
  const lang = useLang();
  const list = useStore((s) => s.categories);
  return { list, name: (id?: string) => { const c = list.find((x) => x.id === id); return c ? (lang === 'zh' ? c.zh || c.en : c.en || c.zh) : '—'; }, find: (id?: string) => list.find((x) => x.id === id) };
}

export function Projects() {
  const L = useL();
  const s = useStore((x) => x);
  const cats = useCategories();
  const [filter, setFilter] = useState<string>('all');
  const [status, setStatus] = useState<'active' | 'all'>('active');
  // other apps (e.g. the Focus project board) can ask to open a project's page
  const [openId, setOpenId] = useState<string | null>(() => {
    try {
      const v = sessionStorage.getItem('lifeos:project-open');
      sessionStorage.removeItem('lifeos:project-open');
      return v;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    const f = (e: Event) => {
      setOpenId((e as CustomEvent<string>).detail);
      try {
        sessionStorage.removeItem('lifeos:project-open');
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('lifeos:project-open', f);
    return () => window.removeEventListener('lifeos:project-open', f);
  }, []);
  const [catsOpen, setCatsOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const live = useLiveSession(1000);
  const projectMsToday = s.sessions.filter((x) => !x.rate && dayKey(x.start) === dayKey()).reduce((a, x) => a + x.activeMs, 0) + (live && !live.paid ? live.ms : 0);
  // Board (planning / in progress / done, papers included) or the card grid
  const [view, setViewRaw] = useState<'board' | 'cards'>(() => {
    try {
      return localStorage.getItem('lifeos:projects-view') === 'cards' ? 'cards' : 'board';
    } catch {
      return 'board';
    }
  });
  const setView = (v: 'board' | 'cards') => {
    setViewRaw(v);
    try {
      localStorage.setItem('lifeos:projects-view', v);
    } catch {
      /* ignore */
    }
  };
  const list = s.projects.filter((p) => (filter === 'all' || p.category === filter) && (status === 'all' || p.status !== 'done'));

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('项目', 'Projects')}</h1>
          <p className="muted">{L('论文、工作、生活里的事，都可以是一个项目。在这里直接开始专注；任务、计划、目标、论文、专注时间和收入都会汇总到这里。', 'Papers, work, life — anything can be a project. Start focusing right here; tasks, plans, goals, papers, focus time and income all roll up here.')}</p>
        </div>
        <Button
          variant="primary"
          icon="plus"
          onClick={() => {
            const id = actions.upsertProject({ name: L('新项目', 'New project'), category: filter !== 'all' ? filter : cats.list[0]?.id, color: PALETTE[s.projects.length % PALETTE.length] });
            setOpenId(id);
          }}
        >
          {L('新项目', 'New project')}
        </Button>
      </div>

      <LiveFocusBar />
      <ParkedList />
      <div className="proj-start">
        <CountdownPicker compact />
        <FocusGoal kind="focus" doneMs={projectMsToday} compact />
      </div>
      <QuickStart onEdit={() => setPresetsOpen(true)} />

      <div className="proj-view">
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'board', label: L('看板', 'Board'), icon: 'route' },
            { value: 'cards', label: L('卡片', 'Cards'), icon: 'grid' },
          ]}
        />
        {view === 'board' && <span className="muted small">{L('拖动卡片改变状态 · 点「专注」直接开始计时', 'Drag cards to change status · Focus starts the clock')}</span>}
      </div>

      {view === 'board' ? (
        <Card>
          <ProjectBoard onFocus={(id) => { const p = s.projects.find((x) => x.id === id); if (p) focusProject(p, { open: p.rate != null }); }} />
        </Card>
      ) : (
      <>
      <div className="proj-filters">
        <button className={`chip chip-btn ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
          {L('全部', 'All')} <span className="num muted">{s.projects.filter((p) => status === 'all' || p.status !== 'done').length}</span>
        </button>
        {cats.list.map((c) => (
          <button key={c.id} className={`chip chip-btn ${filter === c.id ? 'is-active' : ''}`} style={{ '--tone': `var(--p-${c.color})` } as CSSProperties} onClick={() => setFilter(c.id)}>
            <Icon name={c.icon} size={13} /> {cats.name(c.id)} <span className="num muted">{s.projects.filter((p) => p.category === c.id && (status === 'all' || p.status !== 'done')).length}</span>
          </button>
        ))}
        <Button size="sm" variant="ghost" icon="pencil" onClick={() => setCatsOpen(true)}>
          {L('编辑分类', 'Edit categories')}
        </Button>
        <span className="spacer" />
        <Segmented
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: L('进行中', 'Active') },
            { value: 'all', label: L('含已完成', 'Include done') },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <Card>
          <Empty icon="briefcase" title={L('这里还没有项目', 'No projects here yet')} body={L('比如「博士论文」「搬家」「咨询客户 A」「马拉松训练」。', 'e.g. “Dissertation”, “Moving house”, “Client A”, “Marathon training”.')} />
        </Card>
      ) : (
        <div className="proj-grid">
          {list.map((p) => (
            <ProjectCard key={p.id} p={p} onOpen={() => setOpenId(p.id)} />
          ))}
        </div>
      )}
      </>
      )}

      <EffortCard live={live} />
      <PresetEditor open={presetsOpen} onClose={() => setPresetsOpen(false)} />
      {openId && <ProjectDetail id={openId} onClose={() => setOpenId(null)} />}
      <CategoryEditor open={catsOpen} onClose={() => setCatsOpen(false)} />
    </div>
  );
}

function ProjectCard({ p, onOpen }: { p: Project; onOpen: () => void }) {
  const L = useL();
  const s = useStore((x) => x);
  const cats = useCategories();
  const st = useMemo(() => projectStats(s, p), [s, p]);
  const c = cats.find(p.category);
  const days = p.deadline ? daysBetween(dayKey(), p.deadline) : null;
  const liveHere = s.active?.projectId === p.id;
  return (
    <div
      role="button"
      tabIndex={0}
      className={`proj-card is-${p.status ?? 'active'}`}
      style={{ '--tone': `var(--p-${p.color})` } as CSSProperties}
      onClick={onOpen}
      onKeyDown={(e) => e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
    >
      <span className="pc-band" />
      <div className="pc-top">
        <strong>{p.name}</strong>
        {c && (
          <Chip tone={c.color as 'blue'} icon={c.icon}>
            {cats.name(c.id)}
          </Chip>
        )}
      </div>
      {p.note && <p className="pc-note muted small">{p.note}</p>}
      {st.pct != null && (
        <div className="pi-progress">
          <Bar value={st.pct} tone={p.color as 'blue'} height={7} />
          <span className="num small">{Math.round(st.pct * 100)}%</span>
        </div>
      )}
      <div className="pc-stats">
        <span>
          <Icon name="list-checks" size={12} /> <b className="num">{st.open.length}</b> {L('待办', 'open')}
        </span>
        <span>
          <Icon name="timer" size={12} /> <b className="num">{st.hoursWeek.toFixed(1)}h</b> {L('本周', 'this wk')}
        </span>
        {st.plans.length > 0 && (
          <span>
            <Icon name="calendar" size={12} /> <b className="num">{st.plans.length}</b> {L('计划', 'plans')}
          </span>
        )}
        {days != null && (
          <span className={days < 7 ? 'soon' : ''}>
            <Icon name="hourglass" size={12} /> <b className="num">{days}</b> {L('天', 'd')}
          </span>
        )}
        {p.status === 'planning' && <Chip tone="blue">{L('筹划中', 'Planning')}</Chip>}
        {p.status === 'paused' && <Chip>{L('暂停', 'Paused')}</Chip>}
        {p.status === 'done' && <Chip tone="jade">{L('已完成', 'Done')}</Chip>}
        {p.status !== 'done' && (
          <span className="pc-focus" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant={liveHere ? 'primary' : 'soft'} icon={liveHere ? 'timer' : 'play'} title={L(`开始专注「${p.name}」`, `Focus on ${p.name}`)} onClick={() => (liveHere ? open((s.active?.rate ?? 0) > 0 ? 'earn' : 'projects') : focusProject(p))}>
              {liveHere ? L('专注中', 'Focusing') : L('专注', 'Focus')}
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ProjectDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const mx = useMetrics();
  const cats = useCategories();
  const p = s.projects.find((x) => x.id === id);
  const [task, setTask] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  if (!p) return null;
  const st = projectStats(s, p);
  const cds = upcoming(s).filter((c) => c.projectId === p.id);
  const set = (patch: Partial<Project>) => actions.upsertProject({ ...p, ...patch });
  const linkable = <T extends { id: string; projectId?: string }>(xs: T[]) => xs.filter((x) => !x.projectId);
  const scopes = (['year', 'month', 'week'] as const).map((sc) => [sc, st.plans.filter((x) => x.scope === sc)] as const).filter(([, xs]) => xs.length);

  return (
    <Modal open onClose={onClose} title={L('项目', 'Project')} width={920}>
      <div className="pd" style={{ '--tone': `var(--p-${p.color})` } as CSSProperties}>
        <div className="pd-main">
          <input className="pd-name" value={p.name} onChange={(e) => set({ name: e.target.value })} aria-label={L('项目名', 'Project name')} />
          <textarea className="input" rows={2} value={p.note ?? ''} placeholder={L('一句话描述这个项目…', 'Describe the project in a line…')} onChange={(e) => set({ note: e.target.value })} />

          <section className="pd-sec">
            <h4>
              <Icon name="list-checks" size={15} /> {L('步骤', 'Steps')} <span className="muted num">{st.doneTasks.length}/{st.tasks.filter((q) => q.kind === 'once').length}</span>
            </h4>
            <ul className="pd-list">
              {st.tasks
                .filter((q) => q.kind === 'once')
                // open steps first, by due date (undated last); done ones at the bottom
                .sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt) || (a.due ?? '9').localeCompare(b.due ?? '9'))
                .map((q) => (
                  <li key={q.id} className={`pd-step ${q.doneAt ? 'is-done' : ''}`}>
                    <CheckBubble checked={!!q.doneAt} onChange={() => actions.toggleQuest(q.id)} tone={p.color as 'blue'} label={q.title} />
                    <span className="pd-step-title">{q.title}</span>
                    {!q.doneAt && <DueChip due={q.due} />}
                    {!q.doneAt && (
                      <input
                        className="input pd-due"
                        type="date"
                        value={q.due ?? ''}
                        title={L('截止日期（可选）', 'Due date (optional)')}
                        aria-label={L(`「${q.title}」的截止日期`, `Due date for “${q.title}”`)}
                        onChange={(e) => actions.updateQuest(q.id, { due: e.target.value || undefined })}
                      />
                    )}
                  </li>
                ))}
              {st.tasks
                .filter((q) => q.kind === 'daily')
                .map((q) => (
                  <li key={q.id}>
                    <Icon name="refresh" size={14} />
                    <span className="muted">{q.title}</span>
                  </li>
                ))}
            </ul>
            <form
              className="quick-add is-compact"
              onSubmit={(e) => {
                e.preventDefault();
                if (!task.trim()) return;
                actions.addQuest({ title: task.trim(), kind: 'once', attr: s.attributes[0]?.id ?? 'mind', difficulty: 'normal', projectId: p.id, step: true, ...(taskDue ? { due: taskDue } : {}) });
                setTaskDue('');
                setTask('');
              }}
            >
              <Icon name="plus" size={16} />
              <input value={task} onChange={(e) => setTask(e.target.value)} placeholder={L('加一个步骤，回车保存（留在项目里，不会进今日任务）', 'Add a step, press Enter (stays in the project, not on Today)')} />
              <input className="input pd-due" type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} title={L('截止日期（可选）', 'Due date (optional)')} aria-label={L('新步骤的截止日期（可选）', 'Due date for the new step (optional)')} />
            </form>
          </section>

          <section className="pd-sec">
            <h4>
              <Icon name="calendar" size={15} /> {L('计划', 'Plans')}
            </h4>
            {scopes.length === 0 ? (
              <p className="muted small">{L('在「计划」里新建计划时选择这个项目，它就会出现在这里。', 'Pick this project when adding plan items and they’ll show here.')}</p>
            ) : (
              scopes.map(([sc, xs]) => (
                <div key={sc} className="pd-plans">
                  <span className="muted small">{scopeName(sc, L)}</span>
                  {xs.map((x) => {
                    const pr = planProgress(s, x, mx);
                    return (
                      <div key={x.id} className="pd-plan">
                        <span className={x.done ? 'is-done' : ''}>{x.title}</span>
                        <span className="muted small">{periodLabel(x.period, lang)}</span>
                        <Bar value={x.done ? 1 : pr.pct} tone="teal" height={5} />
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            <Button size="sm" variant="ghost" icon="chevron-right" onClick={() => (onClose(), open('plan'))}>
              {L('去做计划', 'Open Plans')}
            </Button>
          </section>

          <section className="pd-sec">
            <h4>
              <Icon name="flag" size={15} /> {L('目标', 'Goals')}
            </h4>
            {st.goals.map((g) => {
              const gp = goalProgress(s, g, mx);
              return (
                <div key={g.id} className="pd-plan">
                  <span className={g.status === 'done' ? 'is-done' : ''}>{g.title}</span>
                  <Button size="sm" variant="ghost" icon="x" title={L('移出项目', 'Unlink')} onClick={() => actions.linkProject('milestones', g.id, undefined)} />
                  <Bar value={g.status === 'done' ? 1 : (gp.pct ?? 0)} tone={g.attr} height={5} />
                </div>
              );
            })}
            <LinkPicker items={linkable(s.milestones.filter((m) => m.status !== 'done')).map((m) => ({ id: m.id, label: m.title }))} onPick={(gid) => actions.linkProject('milestones', gid, p.id)} label={L('关联一个目标…', 'Link a goal…')} />
          </section>

          {(cats.find(p.category)?.id === 'research' || st.papers.length > 0) && (
            <section className="pd-sec">
              <h4>
                <Icon name="book-open" size={15} /> {L('论文', 'Papers')}
              </h4>
              {st.papers.map((pp) => (
                <div key={pp.id} className="pd-plan">
                  <span>{pp.title}</span>
                  <Button size="sm" variant="ghost" icon="x" title={L('移出项目', 'Unlink')} onClick={() => actions.linkProject('papers', pp.id, undefined)} />
                  <span className="muted small num">
                    {pp.status} · <Icon name="quote" size={11} /> {pp.citations}
                  </span>
                </div>
              ))}
              <LinkPicker items={linkable(s.papers).map((x) => ({ id: x.id, label: x.title }))} onPick={(pid) => actions.linkProject('papers', pid, p.id)} label={L('关联一篇论文…', 'Link a paper…')} />
            </section>
          )}
        </div>

        <aside className="pd-side">
          <Field label={L('分类', 'Category')}>
            <select className="input" value={p.category ?? ''} onChange={(e) => set({ category: e.target.value })}>
              {cats.list.map((c) => (
                <option key={c.id} value={c.id}>
                  {cats.name(c.id)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={L('状态', 'Status')}>
            <Segmented
              size="sm"
              value={p.status ?? 'active'}
              onChange={(v) => actions.setProjectStatus(p.id, v)}
              options={[
                { value: 'planning', label: L('筹划中', 'Planning') },
                { value: 'active', label: L('进行中', 'Active') },
                { value: 'paused', label: L('暂停', 'Paused') },
                { value: 'done', label: L('完成', 'Done') },
              ]}
            />
          </Field>
          <Field label={L('截止日期', 'Deadline')} hint={L('会出现在倒计时里', 'Shows up in Countdowns')}>
            <input className="input" type="date" value={p.deadline ?? ''} onChange={(e) => set({ deadline: e.target.value || undefined })} />
          </Field>
          <Field label={L('时薪（可选）', 'Hourly rate (optional)')} hint={L('时薪计选择这个项目时使用', 'Used by the wage timer for this project')}>
            <input className="input" type="number" min={0} value={p.rate ?? ''} placeholder={String(s.profile.hourlyRate)} onChange={(e) => set({ rate: e.target.value === '' ? undefined : +e.target.value })} />
          </Field>
          <Field label={L('颜色', 'Color')}>
            <div className="swatches">
              {PALETTE.map((c) => (
                <button key={c} type="button" aria-label={L(...PALETTE_NAMES[c as keyof typeof PALETTE_NAMES])} className={p.color === c ? 'is-on' : ''} style={{ '--sw': `var(--p-${c})` } as CSSProperties} onClick={() => set({ color: c })} />
              ))}
            </div>
          </Field>
          <div className="pd-stats">
            <div>
              <span className="muted small">{L('本周专注', 'Focus this week')}</span>
              <strong className="num">{st.hoursWeek.toFixed(1)} h</strong>
            </div>
            <div>
              <span className="muted small">{L('累计专注', 'Total focus')}</span>
              <strong className="num">{num(st.hoursAll, 1)} h</strong>
            </div>
            <div>
              <span className="muted small">{L('累计收入', 'Earned')}</span>
              <strong className="num">{money(st.earned, s.profile.currency, 0)}</strong>
            </div>
          </div>
          {cds.length > 0 && (
            <div className="pd-cds">
              {cds.map((c) => (
                <span key={c.id}>
                  <Icon name="hourglass" size={12} /> {c.title} · <b className="num">{c.daysLeft}</b> {L('天', 'd')}
                </span>
              ))}
            </div>
          )}
          <Button variant="primary" icon="play" onClick={() => (focusProject(p, { open: p.rate != null }), onClose())}>
            {L('为这个项目开始专注', 'Focus on this project')}
          </Button>
          <Button variant="ghost" icon="trash" onClick={() => setConfirmDel(true)}>
            {L('删除项目', 'Delete project')}
          </Button>
          {confirmDel && (
            <div className="banner">
              <span>{L('删除项目不会删除任务和计划，只是解除关联。', 'Tasks and plans are kept, just unlinked.')}</span>
              <Button size="sm" variant="danger" onClick={() => (actions.deleteProject(p.id), onClose())}>
                {L('确认删除', 'Delete')}
              </Button>
            </div>
          )}
        </aside>
      </div>
    </Modal>
  );
}

function LinkPicker({ items, onPick, label }: { items: { id: string; label: string }[]; onPick: (id: string) => void; label: string }) {
  if (!items.length) return null;
  return (
    <select className="input link-picker" value="" onChange={(e) => e.target.value && onPick(e.target.value)}>
      <option value="">{label}</option>
      {items.map((i) => (
        <option key={i.id} value={i.id}>
          {i.label}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */

function CategoryEditor({ open: isOpen, onClose }: { open: boolean; onClose: () => void }) {
  const L = useL();
  const lang = useLang();
  const list = useStore((s) => s.categories);
  const [iconFor, setIconFor] = useState<string | null>(null);
  return (
    <Modal open={isOpen} onClose={onClose} title={L('项目分类', 'Project categories')} width={640}>
      <ul className="attr-edit">
        {list.map((c: Category) => (
          <li key={c.id} style={{ '--tone': `var(--p-${c.color})` } as CSSProperties}>
            <button className="ae-icon" onClick={() => setIconFor(iconFor === c.id ? null : c.id)} aria-label={L('更换图标', 'Change icon')}>
              <Icon name={c.icon} size={18} />
            </button>
            <input className="input" value={lang === 'zh' ? c.zh : c.en} onChange={(e) => actions.saveCategory({ ...c, [lang]: e.target.value })} aria-label={L('名称', 'Name')} />
            <span />
            <div className="swatches">
              {PALETTE.map((col) => (
                <button key={col} type="button" aria-label={col} className={c.color === col ? 'is-on' : ''} style={{ '--sw': `var(--p-${col})` } as CSSProperties} onClick={() => actions.saveCategory({ ...c, color: col })} />
              ))}
            </div>
            <span className="ae-actions">
              <Button size="sm" variant="ghost" icon="trash" title={L('删除', 'Delete')} disabled={list.length <= 1} onClick={() => actions.removeCategory(c.id)} />
            </span>
            {iconFor === c.id && (
              <div className="icon-pick ae-icons">
                {['graduation', 'briefcase', 'leaf', 'sparkles', 'house', 'heart', 'dumbbell', 'plane', 'code', 'palette', 'users', 'coins', ...ATTR_ICONS.slice(0, 8)].map((ic) => (
                  <button
                    type="button"
                    key={ic}
                    className={c.icon === ic ? 'is-on' : ''}
                    onClick={() => {
                      actions.saveCategory({ ...c, icon: ic });
                      setIconFor(null);
                    }}
                    aria-label={ic}
                  >
                    <Icon name={ic} size={18} />
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <Button icon="plus" onClick={() => actions.saveCategory({ zh: '新分类', en: 'New category', icon: 'sparkles', color: PALETTE[list.length % PALETTE.length] })}>
        {L('添加分类', 'Add category')}
      </Button>
      <p className="muted small" style={{ marginTop: 10 }}>
        {L('删除分类时，里面的项目会移到第一个分类。', 'Projects in a deleted category move to the first one.')}
      </p>
    </Modal>
  );
}
