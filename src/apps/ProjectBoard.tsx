import { useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { dayKey, daysBetween } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { open } from '../os/router';
import { notify } from '../os/notify';
import { PALETTE } from '../store/attrs';
import { projectStats } from '../store/plans';
import { actions, getState, useStore } from '../store/store';
import type { Paper, PaperStatus, Project, ProjectStatus } from '../store/types';
import { Icon } from '../ui/Icon';
import { Button, Chip } from '../ui/kit';
import { useBoardDrag } from '../ui/useBoardDrag';
import { useLiveSession } from '../os/live';
import { clock } from './Earn';
import { useStatusLabel } from './Research';

/** The three columns of the project board. Research papers are placed by their stage. */
type Col = 'planning' | 'active' | 'done';
const COLS: { id: Col; zh: string; en: string; icon: string }[] = [
  { id: 'planning', zh: '筹划中', en: 'Planning', icon: 'sparkles' },
  { id: 'active', zh: '进行中', en: 'In progress', icon: 'timer' },
  { id: 'done', zh: '已完成', en: 'Done', icon: 'circle-check' },
];
const projectCol = (p: Project): Col => (p.status === 'planning' ? 'planning' : p.status === 'done' ? 'done' : 'active');
const paperCol = (p: Paper): Col => (p.status === 'idea' ? 'planning' : p.status === 'accepted' || p.status === 'published' ? 'done' : 'active');
/** Where a paper lands when dropped on a column: the first stage of that column. */
const PAPER_FOR: Record<Col, PaperStatus> = { planning: 'idea', active: 'drafting', done: 'accepted' };
const DONE_SHOWN = 5;

/** Start a focus session on a project right away: paid if the project has its own rate, project time otherwise. */
export function focusProject(p: Project, opts: { open?: boolean } = {}) {
  const st = getState();
  const tr = (zh: string, en: string) => (st.profile.lang === 'zh' ? zh : en);
  if (st.active) {
    notify({ title: tr('先结束当前的计时', 'Finish the current session first'), icon: 'info' });
    open(st.active.rate > 0 ? 'earn' : 'projects');
    return;
  }
  actions.startFocus(p.rate ?? 0, st.attributes[0]?.id ?? 'mind', p.name, { projectId: p.id });
  notify({ title: tr(`开始专注：${p.name}`, `Focusing on ${p.name}`), icon: 'timer', tone: 'good' });
  if (opts.open !== false) open(p.rate != null ? 'earn' : 'projects');
}

/** Open a project's detail page in the Projects app. */
export function openProject(id: string) {
  try {
    sessionStorage.setItem('lifeos:project-open', id);
  } catch {
    /* ignore */
  }
  open('projects');
  window.dispatchEvent(new CustomEvent('lifeos:project-open', { detail: id }));
}

/**
 * Project management for the Focus app: every project (and every research paper) as a card in
 * Planning / In progress / Done. Drag a card to change its status; ▶ starts a focus session on it.
 */
export function ProjectBoard({ onFocus }: { onFocus: (projectId: string) => void }) {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const paperLabel = useStatusLabel();
  const [allDone, setAllDone] = useState(false);
  const [adding, setAdding] = useState('');
  const today = dayKey();

  type Item = { key: string; kind: 'project'; p: Project; col: Col; ts: number } | { key: string; kind: 'paper'; p: Paper; col: Col; ts: number };
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const p of s.projects) out.push({ key: `pr:${p.id}`, kind: 'project', p, col: projectCol(p), ts: p.history?.at(-1)?.at ?? p.createdAt ?? 0 });
    for (const p of s.papers) if (!p.removed) out.push({ key: `pa:${p.id}`, kind: 'paper', p, col: paperCol(p), ts: p.history?.at(-1)?.at ?? p.updatedAt });
    return out;
  }, [s.projects, s.papers]);
  const stats = useMemo(() => new Map(s.projects.map((p) => [p.id, projectStats(s, p)])), [s]);

  const colName = (c: Col) => L(...([COLS.find((x) => x.id === c)!.zh, COLS.find((x) => x.id === c)!.en] as [string, string]));
  const { drag, board, start, ghostEl, justDragged } = useBoardDrag<Col>((key, _from, to) => {
    const id = key.slice(3);
    const d = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
    if (key.startsWith('pr:')) {
      actions.setProjectStatus(id, to as ProjectStatus);
      notify({ title: L(`已移到「${colName(to)}」`, `Moved to ${colName(to)}`), body: L(`变更时间已记录：${d}`, `Recorded on ${d}`), icon: COLS.find((c) => c.id === to)!.icon, tone: to === 'done' ? 'gold' : 'info' });
    } else {
      actions.setPaperStatus(id, PAPER_FOR[to]);
      notify({ title: L(`论文已移到「${paperLabel(PAPER_FOR[to])}」`, `Paper moved to ${paperLabel(PAPER_FOR[to])}`), body: L(`更细的阶段可以在「学术」里调整 · ${d}`, `Fine-tune the stage in Research · ${d}`), icon: 'graduation', tone: to === 'done' ? 'gold' : 'info' });
    }
  });

  const add = () => {
    const name = adding.trim();
    if (!name) return;
    actions.upsertProject({ name, status: 'planning', color: PALETTE[s.projects.length % PALETTE.length] });
    setAdding('');
  };

  const dragged = drag ? items.find((x) => x.key === drag.id) : undefined;
  return (
    <div className={`board pboard ${drag ? 'is-dragging' : ''}`} ref={board}>
      {COLS.map((c) => {
        const list = items.filter((x) => x.col === c.id).sort((a, b) => (c.id === 'done' ? b.ts - a.ts : Number(a.kind === 'paper') - Number(b.kind === 'paper') || b.ts - a.ts));
        const shown = c.id === 'done' && !allDone ? list.slice(0, DONE_SHOWN) : list;
        const over = drag?.over === c.id && drag.from !== c.id;
        return (
          <div className={`board-col ${over ? 'is-over' : ''}`} key={c.id} data-col={c.id}>
            <div className="board-head">
              <Icon name={c.icon} size={14} />
              <span>{L(c.zh, c.en)}</span>
              <span className="num muted">{list.length}</span>
            </div>
            {shown.map((it) =>
              it.kind === 'project' ? (
                <ProjectCard key={it.key} p={it.p} st={stats.get(it.p.id)!} today={today} dragging={drag?.id === it.key} onPointerDown={(e) => start(e, it.key, it.col)} onOpen={() => !justDragged() && openProject(it.p.id)} onFocus={() => onFocus(it.p.id)} />
              ) : (
                <article key={it.key} className={`paper-card pb-paper ${drag?.id === it.key ? 'is-dragging' : ''}`} onPointerDown={(e) => start(e, it.key, it.col)}>
                  <button className="paper-title" onClick={() => !justDragged() && open('research')}>
                    {it.p.title}
                  </button>
                  <div className="paper-meta">
                    <Chip tone="spirit" icon="graduation">
                      {paperLabel(it.p.status)}
                    </Chip>
                    {it.p.venue && <span>{it.p.venue}</span>}
                  </div>
                </article>
              ),
            )}
            {c.id === 'done' && list.length > DONE_SHOWN && (
              <button className="link-btn pb-more" onClick={() => setAllDone((v) => !v)}>
                {allDone ? L('收起', 'Show less') : L(`显示全部 ${list.length} 个`, `Show all ${list.length}`)}
              </button>
            )}
            {over && <div className="board-drop">{L('放到这里', 'Drop here')}</div>}
            {c.id === 'planning' && (
              <form className="pb-add" onSubmit={(e) => (e.preventDefault(), add())}>
                <input className="input" value={adding} onChange={(e) => setAdding(e.target.value)} placeholder={L('+ 新项目，回车添加', '+ New project, press Enter')} aria-label={L('新项目', 'New project')} />
              </form>
            )}
          </div>
        );
      })}
      {dragged &&
        ghostEl(
          <>
            <b>{dragged.kind === 'project' ? dragged.p.name : dragged.p.title}</b>
            <span className="muted small">{drag?.over && drag.over !== dragged.col ? `${colName(dragged.col)} → ${colName(drag.over)}` : colName(dragged.col)}</span>
          </>,
        )}
    </div>
  );
}

function ProjectCard({ p, st, today, dragging, onPointerDown, onOpen, onFocus }: { p: Project; st: ReturnType<typeof projectStats>; today: string; dragging: boolean; onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void; onOpen: () => void; onFocus: () => void }) {
  const L = useL();
  const days = p.deadline && p.status !== 'done' ? daysBetween(today, p.deadline) : null;
  return (
    <article className={`paper-card pb-proj ${dragging ? 'is-dragging' : ''}`} style={{ '--tone': `var(--p-${p.color})` } as CSSProperties} onPointerDown={onPointerDown}>
      <button className="paper-title" onClick={onOpen}>
        {p.name}
      </button>
      {st.pct != null && (
        <span className="pb-bar" aria-label={`${Math.round(st.pct * 100)}%`}>
          <i style={{ width: `${Math.round(st.pct * 100)}%` }} />
        </span>
      )}
      <div className="paper-meta">
        {p.status === 'paused' && <Chip>{L('暂停', 'Paused')}</Chip>}
        <span className="num">
          <Icon name="timer" size={11} /> {st.hoursWeek.toFixed(1)}h {L('本周', 'this wk')}
        </span>
        {st.open.length > 0 && (
          <span className="num">
            <Icon name="list-checks" size={11} /> {st.open.length}
          </span>
        )}
        {st.papers.length > 0 && (
          <span className="num">
            <Icon name="graduation" size={11} /> {st.papers.length}
          </span>
        )}
        {days != null && (
          <span className={`num ${days < 7 ? 'soon' : ''}`}>
            <Icon name="hourglass" size={11} /> {days}
            {L('天', 'd')}
          </span>
        )}
      </div>
      {p.status !== 'done' && (
        <div className="paper-foot" data-nodrag>
          <span className="spacer" />
          <Button size="sm" variant="soft" icon="play" onClick={onFocus}>
            {L('专注', 'Focus')}
          </Button>
        </div>
      )}
    </article>
  );
}

/**
 * The running session, shown at the top of Projects: name, clock, pause / stop / discard and a
 * countdown. A paid session just links to Earn, where its money is.
 */
export function LiveFocusBar() {
  const L = useL();
  const lang = useLang();
  const live = useLiveSession(500);
  const projects = useStore((s) => s.projects);
  if (!live) return null;
  const name = live.active.note || projects.find((p) => p.id === live.active.projectId)?.name || L('专注', 'Focus');
  const since = new Date(live.active.start).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  if (live.paid)
    return (
      <section className="proj-live is-paid">
        <i className="pulse" />
        <span>
          {L('正在赚钱计时：', 'Paid session running: ')}
          <b>{name}</b>
        </span>
        <span className="spacer" />
        <Button size="sm" icon="coins" onClick={() => open('earn')}>
          {L('打开「赚钱」', 'Open Earn')}
        </Button>
      </section>
    );
  return (
    <section className={`proj-live ${live.paused ? 'is-paused' : ''}`}>
      <i className="pulse" />
      <div className="pl-main">
        <b>{name}</b>
        <span className="muted small num">
          {live.paused ? L('已暂停', 'Paused') : L(`开始于 ${since}`, `since ${since}`)} · +{Math.floor(live.ms / 60_000)} XP
        </span>
      </div>
      <span className="pl-clock num">{live.left != null ? (live.left > 0 ? `⏳ ${clock(live.left)}` : '🎉') : clock(live.ms)}</span>
      <div className="row-gap wrap">
        {[15, 25, 45].map((m) => (
          <Button key={m} size="sm" variant="ghost" icon="plus" title={L(`倒计时加 ${m} 分钟`, `Add ${m} min to the countdown`)} onClick={() => actions.extendFocus(m)}>
            {m}′
          </Button>
        ))}
        <Button size="sm" icon={live.paused ? 'play' : 'pause'} onClick={actions.pauseFocus}>
          {live.paused ? L('继续', 'Resume') : L('暂停', 'Pause')}
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon="square"
          onClick={() => {
            const s = actions.stopFocus();
            if (s) notify({ title: L('已记录这段专注', 'Focus logged'), body: `${s.note || L('专注', 'Focus')} · ${Math.round(s.activeMs / 60_000)} min · +${Math.round(s.activeMs / 60_000)} XP`, icon: 'timer', tone: 'good' });
            else notify({ title: L('不足 1 分钟，未记录', 'Under a minute — not logged'), icon: 'info' });
          }}
        >
          {L('结束并记录', 'Stop & log')}
        </Button>
        <Button size="sm" variant="ghost" icon="trash" title={L('丢弃本次', 'Discard')} onClick={() => actions.stopFocus(false)} />
      </div>
    </section>
  );
}

/** One-tap starts for regular activities (the gym, reading…), editable. */
export function QuickStart({ onEdit }: { onEdit: () => void }) {
  const L = useL();
  const presets = useStore((s) => s.focusPresets);
  const attrIds = useStore((s) => s.attributes).map((a) => a.id);
  const busy = useStore((s) => !!s.active);
  return (
    <div className="free-presets proj-quick" role="group" aria-label={L('快捷开始', 'Quick start')}>
      <span className="muted small fp-label">{L('快捷开始专注（不属于任何项目的常做的事）', 'Quick start (regular activities outside any project)')}</span>
      {presets.map((p) => (
        <button
          key={p.id}
          className="chip"
          disabled={busy}
          onClick={() => {
            actions.startFocus(0, attrIds.includes(p.attr) ? p.attr : attrIds[0], p.name);
            notify({ title: L(`开始专注：${p.name}`, `Focusing on ${p.name}`), icon: p.icon, tone: 'good' });
          }}
        >
          <Icon name={p.icon} size={13} /> {p.name}
        </button>
      ))}
      <button className="chip chip-edit" onClick={onEdit}>
        <Icon name="pencil" size={13} /> {L('编辑', 'Edit')}
      </button>
    </div>
  );
}
