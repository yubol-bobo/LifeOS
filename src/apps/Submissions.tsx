import { useState } from 'react';
import { dayKey } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { notify } from '../os/notify';
import { actions, SUB_LABEL, useStore } from '../store/store';
import type { Paper, SubStatus, Submission } from '../store/types';
import { Icon } from '../ui/Icon';
import { Button, CheckBubble, Chip } from '../ui/kit';
import { DueChip } from './goals';

const ORDER: SubStatus[] = ['planned', 'submitted', 'review', 'rebuttal', 'accepted', 'rejected', 'withdrawn'];
const DONE: SubStatus[] = ['accepted', 'rejected', 'withdrawn'];
const TONE: Record<SubStatus, 'ink' | 'accent' | 'gold' | 'spirit' | 'wealth'> = {
  planned: 'ink',
  submitted: 'accent',
  review: 'spirit',
  rebuttal: 'gold',
  accepted: 'wealth',
  rejected: 'ink',
  withdrawn: 'ink',
};

/** The submission to show on a card: the latest one still in play, else the latest one. */
export const currentSub = (p: Pick<Paper, 'submissions'>) => {
  const l = p.submissions ?? [];
  return [...l].reverse().find((s) => !DONE.includes(s.status)) ?? l.at(-1);
};

export function SubChip({ paper }: { paper: Pick<Paper, 'submissions'> }) {
  const lang = useLang();
  const s = currentSub(paper);
  if (!s) return null;
  return (
    <Chip tone={TONE[s.status]} icon="send">
      {s.venue} · {SUB_LABEL[s.status][lang === 'zh' ? 0 : 1]}
    </Chip>
  );
}

/** Paper page: submissions (venue, status, dates, note) and the paper's to-dos for today. */
export function SubmissionSection({ paper }: { paper: Paper }) {
  const L = useL();
  const lang = useLang();
  const subs = useStore((s) => s.papers.find((p) => p.id === paper.id)?.submissions ?? []);
  const todos = useStore((s) => s.quests.filter((q) => q.paperId === paper.id && !q.archived && q.kind === 'once'));
  const [venue, setVenue] = useState('');
  const [status, setStatus] = useState<SubStatus>('submitted');
  const [deadline, setDeadline] = useState('');
  const [todo, setTodo] = useState('');
  const sl = (s: SubStatus) => SUB_LABEL[s][lang === 'zh' ? 0 : 1];
  const add = () => {
    if (!venue.trim()) return;
    actions.saveSubmission(paper.id, { venue: venue.trim(), status, deadline: deadline || undefined });
    setVenue('');
    setDeadline('');
  };
  const update = (s: Submission, patch: Partial<Submission>) => actions.saveSubmission(paper.id, { ...s, ...patch });
  const addTodo = () => {
    if (!todo.trim()) return;
    actions.addQuest({ title: todo.trim(), kind: 'once', attr: 'craft', difficulty: 'normal', paperId: paper.id, projectId: paper.projectId, step: paper.projectId ? false : undefined });
    notify({ title: L('已放进今日任务', 'Added to today'), body: todo.trim(), icon: 'list-checks', tone: 'good' });
    setTodo('');
  };

  return (
    <div className="subs">
      {subs.length > 0 && (
        <ul className="subs-list">
          {[...subs].reverse().map((s) => (
            <li key={s.id} className={DONE.includes(s.status) ? 'is-closed' : ''}>
              <div className="subs-top">
                <b>{s.venue}</b>
                <select className="input input-sm" value={s.status} aria-label={L('状态', 'Status')} onChange={(e) => update(s, { status: e.target.value as SubStatus })}>
                  {ORDER.map((o) => (
                    <option key={o} value={o}>
                      {sl(o)}
                    </option>
                  ))}
                </select>
                {!DONE.includes(s.status) && <DueChip due={s.status === 'planned' ? s.deadline : s.decision} />}
                <span className="spacer" />
                <Button size="sm" variant="ghost" icon="trash" title={L('删除这次投稿', 'Delete this submission')} onClick={() => actions.removeSubmission(paper.id, s.id)} />
              </div>
              <div className="subs-dates">
                <label>
                  <span>{L('截稿', 'Deadline')}</span>
                  <input className="input input-sm" type="date" value={s.deadline ?? ''} onChange={(e) => update(s, { deadline: e.target.value || undefined })} />
                </label>
                <label>
                  <span>{L('出结果', 'Decision')}</span>
                  <input className="input input-sm" type="date" value={s.decision ?? ''} onChange={(e) => update(s, { decision: e.target.value || undefined })} />
                </label>
                <input className="input input-sm subs-note" value={s.note ?? ''} placeholder={L('备注：分数、审稿意见、下一步…', 'Note: scores, reviews, next step…')} onChange={(e) => update(s, { note: e.target.value || undefined })} />
              </div>
              <p className="subs-hist muted small">
                {s.history.map((h, i) => (
                  <span key={i}>
                    {i > 0 && ' → '}
                    {sl(h.status)} <span className="num">{dayKey(h.at).slice(5)}</span>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form className="subs-add" onSubmit={(e) => (e.preventDefault(), add())}>
        <input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder={L('投到哪里？例如 ICLR 2027', 'Where to? e.g. ICLR 2027')} aria-label={L('会议 / 期刊', 'Venue')} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as SubStatus)} aria-label={L('状态', 'Status')}>
          {ORDER.slice(0, 4).map((o) => (
            <option key={o} value={o}>
              {sl(o)}
            </option>
          ))}
        </select>
        <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} title={L('截稿日期（可选）', 'Deadline (optional)')} aria-label={L('截稿日期', 'Deadline')} />
        <Button type="submit" icon="plus" disabled={!venue.trim()}>
          {L('添加投稿', 'Add submission')}
        </Button>
      </form>

      <div className="subs-todos">
        <h5>
          <Icon name="list-checks" size={13} /> {L('这篇论文的待办', 'To-dos for this paper')}
        </h5>
        {todos.length > 0 && (
          <ul>
            {todos.map((q) => (
              <li key={q.id} className={q.doneAt ? 'is-done' : ''}>
                <CheckBubble checked={!!q.doneAt} onChange={() => actions.toggleQuest(q.id)} tone="craft" label={q.title} />
                <span>{q.title}</span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(e) => (e.preventDefault(), addTodo())}>
          <input className="input input-sm" value={todo} onChange={(e) => setTodo(e.target.value)} placeholder={L('+ 加一个今日任务，回车（例如：回复 R2 的意见）', '+ Add a to-do for today, press Enter (e.g. answer R2)')} aria-label={L('新的今日任务', 'New to-do')} />
        </form>
      </div>
    </div>
  );
}

/** Quest editor: optionally tie a to-do to a paper. */
export function PaperSelect({ value, onChange }: { value?: string; onChange: (id: string | undefined) => void }) {
  const L = useL();
  const papers = useStore((s) => s.papers.filter((p) => !p.removed));
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{L('— 不关联论文 —', '— No paper —')}</option>
      {papers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title.length > 70 ? `${p.title.slice(0, 68)}…` : p.title}
        </option>
      ))}
    </select>
  );
}
