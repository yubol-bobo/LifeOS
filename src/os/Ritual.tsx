import { useState } from 'react';
import { addDays, dayKey } from '../lib/date';
import { parseCapture } from '../lib/capture';
import { useL } from '../lib/i18n';
import { onToday, questDay, scheduledDailies } from '../store/links';
import { hasReview } from '../store/review';
import { QUEST_XP } from '../store/rules';
import { actions, useStore } from '../store/store';
import type { Quest, State } from '../store/types';
import { Icon } from '../ui/Icon';
import { Button, CheckBubble, Modal } from '../ui/kit';
import { notify } from './notify';
import { open } from './router';

export type RitualKind = 'morning' | 'evening';

/** Open the morning plan or the evening wrap-up from anywhere. */
export const openRitual = (kind: RitualKind) => window.dispatchEvent(new CustomEvent('lifeos:ritual', { detail: kind }));

/** Which one fits the time of day: the plan until mid-afternoon, the wrap-up after. */
export const ritualNow = (h = new Date().getHours()): RitualKind => (h >= 4 && h < 15 ? 'morning' : 'evening');

/** Today's open to-dos (incl. ones carried over), and today's dailies not done yet. */
export function todayOpen(s: State, day = dayKey()) {
  const todos = s.quests.filter((q) => onToday(q, day) && !q.doneAt);
  const done = new Set(s.completions[day] ?? []);
  const dailies = scheduledDailies(s, day).filter((q) => !done.has(q.id));
  return { todos, dailies, carried: todos.filter((q) => questDay(q) < day) };
}

const fmtMin = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

export function Ritual({ kind, onClose }: { kind: RitualKind; onClose: () => void }) {
  const L = useL();
  const s = useStore((x) => x);
  const today = dayKey();
  const tomorrow = addDays(today, 1);
  const { todos, dailies, carried } = todayOpen(s, today);
  const top = s.dayPlans[today]?.top ?? [];
  const byId = (id: string) => s.quests.find((q) => q.id === id);
  const [add, setAdd] = useState('');

  const star = (q: Quest) => {
    if (!actions.toggleTop(q.id, today)) notify({ title: L('最多选 3 件', 'Three at most'), body: L('先取消一件，再选这件。', 'Unstar one first.'), icon: 'star', tone: 'info' });
  };
  const notDoing = (q: Quest) => actions.updateQuest(q.id, { archived: true });
  const Row = ({ q, actionsFor }: { q: Quest; actionsFor: 'star' | 'carry' | 'left' }) => {
    const starred = top.includes(q.id);
    return (
      <li className={`rt-row ${starred ? 'is-top' : ''}`}>
        <span className="rt-title">{q.title}</span>
        <span className="muted small num">+{QUEST_XP[q.difficulty]}</span>
        <span className="spacer" />
        {actionsFor === 'star' && (
          <button type="button" className={`rt-star ${starred ? 'is-on' : ''}`} aria-pressed={starred} aria-label={L(`把「${q.title}」设为要事`, `Make “${q.title}” a top thing`)} onClick={() => star(q)}>
            <Icon name="star" size={16} />
          </button>
        )}
        {actionsFor !== 'star' && q.kind === 'once' && (
          <>
            <Button size="sm" variant="ghost" icon="calendar" onClick={() => actions.moveQuests([q.id], tomorrow)}>
              {L('明天做', 'Tomorrow')}
            </Button>
            <Button size="sm" variant="ghost" icon="x" title={L('不做了（归档，记录还在）', 'Drop it (archived, history kept)')} onClick={() => notDoing(q)}>
              {L('不做了', 'Drop')}
            </Button>
          </>
        )}
      </li>
    );
  };

  if (kind === 'morning') {
    const candidates = [...todos, ...dailies];
    return (
      <Modal
        open
        onClose={onClose}
        width={620}
        title={
          <span className="rt-head">
            <Icon name="sun" size={18} /> {L('晨间计划', 'Morning plan')}
          </span>
        }
        footer={
          <>
            <span className="muted small">{top.length ? L(`已选 ${top.length}/3 件要事`, `${top.length}/3 picked`) : L('挑出今天最重要的事', 'Pick what matters most today')}</span>
            <span className="spacer" />
            <Button
              variant="primary"
              icon="play"
              onClick={() => {
                actions.markRitual('planned', today);
                onClose();
              }}
            >
              {L('开始今天', 'Start the day')}
            </Button>
          </>
        }
      >
        <div className="ritual">
          {carried.length > 0 && (
            <section>
              <h4>
                <Icon name="clock" size={14} /> {L(`之前没做完的 ${carried.length} 件`, `${carried.length} left from before`)}
              </h4>
              <p className="muted small">{L('还要做就留着；不急就挪到明天；不做了就放下。', 'Keep it, push it to tomorrow, or let it go.')}</p>
              <ul className="rt-list">
                {carried.map((q) => (
                  <Row key={q.id} q={q} actionsFor="carry" />
                ))}
              </ul>
            </section>
          )}
          <section>
            <h4>
              <Icon name="star" size={14} /> {L('今天最重要的 3 件事', 'The 3 things that matter most today')}
            </h4>
            <p className="muted small">{L('点星标挑出来。它们会排在任务列表最前面，晚上收尾时会回看。', 'Star them. They go to the top of your list, and you’ll look back at them tonight.')}</p>
            {candidates.length ? (
              <ul className="rt-list">
                {candidates.map((q) => (
                  <Row key={q.id} q={q} actionsFor="star" />
                ))}
              </ul>
            ) : (
              <p className="muted small">{L('今天的清单还是空的，在下面加一件吧。', 'Nothing on today’s list yet — add one below.')}</p>
            )}
            <form
              className="quick-add is-compact rt-add"
              onSubmit={(e) => {
                e.preventDefault();
                const c = parseCapture(add, s.projects, today);
                if (!c.title) return;
                const id = actions.addQuest({ title: c.title, kind: 'once', attr: s.attributes[0]?.id ?? 'craft', difficulty: c.difficulty ?? 'normal', ...(c.day ? { day: c.day } : {}), ...(c.projectId ? { projectId: c.projectId, step: false } : {}) });
                if (!c.day && top.length < 3 && id) actions.toggleTop(id, today);
                setAdd('');
              }}
            >
              <Icon name="plus" size={16} />
              <input value={add} onChange={(e) => setAdd(e.target.value)} placeholder={L('加一件今天要做的事，回车（自动设为要事）', 'Add something for today, press Enter (starred)')} aria-label={L('新的今日任务', 'New to-do')} />
            </form>
          </section>
        </div>
      </Modal>
    );
  }

  // evening
  const doneOnce = s.quests.filter((q) => q.kind === 'once' && q.doneAt && dayKey(q.doneAt) === today);
  const doneDaily = (s.completions[today] ?? []).length;
  const xp = s.events.filter((e) => dayKey(e.ts) === today).reduce((a, e) => a + e.xp, 0);
  const focus = s.sessions.filter((x) => dayKey(x.start) === today).reduce((a, x) => a + x.activeMs, 0);
  const reviewed = hasReview(s, today);
  const leftIds = todos.map((q) => q.id);
  return (
    <Modal
      open
      onClose={onClose}
      width={620}
      title={
        <span className="rt-head">
          <Icon name="moon" size={18} /> {L('晚间收尾', 'Evening wrap-up')}
        </span>
      }
      footer={
        <>
          {!reviewed && (
            <Button variant="ghost" icon="notebook" onClick={() => (actions.markRitual('closed', today), onClose(), open('review'))}>
              {L('去写复盘', 'Write the review')}
            </Button>
          )}
          <span className="spacer" />
          <Button
            variant="primary"
            icon="moon"
            onClick={() => {
              actions.markRitual('closed', today);
              onClose();
            }}
          >
            {L('收工', 'Done for today')}
          </Button>
        </>
      }
    >
      <div className="ritual">
        <ul className="rt-stats">
          <li>
            <b className="num">{doneOnce.length + doneDaily}</b>
            <span>{L('完成', 'done')}</span>
          </li>
          <li>
            <b className="num">+{xp}</b>
            <span>XP</span>
          </li>
          <li>
            <b className="num">{fmtMin(focus)}</b>
            <span>{L('专注', 'focus')}</span>
          </li>
          <li>
            <b>{reviewed ? '✓' : '—'}</b>
            <span>{L('复盘', 'review')}</span>
          </li>
        </ul>
        {top.length > 0 && (
          <section>
            <h4>
              <Icon name="star" size={14} /> {L('今天的要事', 'Today’s top things')}
            </h4>
            <ul className="rt-list">
              {top.map((id) => {
                const q = byId(id);
                if (!q) return null;
                const done = q.kind === 'daily' ? (s.completions[today] ?? []).includes(q.id) : !!q.doneAt;
                return (
                  <li key={id} className={`rt-row ${done ? 'is-done' : ''}`}>
                    <CheckBubble checked={done} onChange={() => actions.toggleQuest(q.id)} tone={q.attr} label={q.title} />
                    <span className="rt-title">{q.title}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section>
          <h4>
            <Icon name="list-checks" size={14} /> {todos.length ? L(`还剩 ${todos.length} 件没做完`, `${todos.length} still open`) : L('今天的待办都做完了 🎉', 'Everything on today’s list is done 🎉')}
          </h4>
          {todos.length > 0 && (
            <>
              <ul className="rt-list">
                {todos.map((q) => (
                  <Row key={q.id} q={q} actionsFor="left" />
                ))}
              </ul>
              <Button
                size="sm"
                variant="soft"
                icon="calendar"
                onClick={() => {
                  actions.moveQuests(leftIds, tomorrow);
                  notify({ title: L(`${leftIds.length} 件挪到了明天`, `${leftIds.length} moved to tomorrow`), body: L('明天早上会在今日任务里看到。', 'They’ll be on Today tomorrow morning.'), icon: 'calendar', tone: 'good' });
                }}
              >
                {L('全部挪到明天', 'Move all to tomorrow')}
              </Button>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
