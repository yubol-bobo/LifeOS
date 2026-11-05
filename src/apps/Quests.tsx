import { useState, type CSSProperties } from 'react';
import { addDays, dayKey, lastNDays, parseDay } from '../lib/date';
import { smart } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { open } from '../os/router';
import { ATTR_META, useMetrics } from '../store/hooks';
import { isScheduled } from '../store/links';
import { QUEST_XP } from '../store/rules';
import { actions, useStore } from '../store/store';
import { ATTRS, type Attr, type Difficulty, type Quest } from '../store/types';
import { Icon } from '../ui/Icon';
import { Bar, Button, Card, CheckBubble, Chip, Empty, Field, Modal, Segmented, Stat } from '../ui/kit';
import { GoalTag } from './goals';

export const WEEKDAYS: [string, string][] = [
  ['一', 'M'],
  ['二', 'T'],
  ['三', 'W'],
  ['四', 'T'],
  ['五', 'F'],
  ['六', 'S'],
  ['日', 'S'],
];

export function Quests() {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const m = useMetrics();
  const [day, setDay] = useState(dayKey());
  const [edit, setEdit] = useState<Partial<Quest> | null>(null);
  const isToday = day === dayKey();
  const done = new Set(s.completions[day] ?? []);
  const allDailies = s.quests.filter((q) => q.kind === 'daily' && !q.archived);
  const dailies = allDailies.filter((q) => isScheduled(q, day));
  const resting = allDailies.filter((q) => !isScheduled(q, day));
  const once = s.quests.filter((q) => q.kind === 'once' && !q.archived);
  const openOnce = once.filter((q) => !q.doneAt);
  const doneOnce = once.filter((q) => q.doneAt).sort((a, b) => b.doneAt! - a.doneAt!);
  const dailyDone = dailies.filter((q) => done.has(q.id)).length;
  const week = lastNDays(7);
  const xpToday = dailies.filter((q) => done.has(q.id)).reduce((a, q) => a + QUEST_XP[q.difficulty], 0);

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('任务', 'Quests')}</h1>
          <p className="muted">{L('每个任务都可以关联到一个目标、自动记录数据、或在专注够时长后自动完成。', 'Each quest can feed a goal, log tracker data, or complete itself after enough focus.')}</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setEdit({ kind: 'daily', attr: 'mind', difficulty: 'normal', title: '' })}>
          {L('新任务', 'New quest')}
        </Button>
      </div>

      <div className="stats-row">
        <Stat label={isToday ? L('今日进度', 'Today') : L('当日进度', 'That day')} value={`${dailyDone}/${dailies.length}`} sub={<Bar value={dailies.length ? dailyDone / dailies.length : 0} height={6} />} />
        <Stat label={L('当日经验', 'XP that day')} value={`+${xpToday}`} tone="accent" />
        <Stat label={L('连胜', 'Streak')} value={<>{m.streak.current}<small>{L('天', 'd')}</small></>} sub={L(`最佳 ${m.streak.best} 天`, `Best ${m.streak.best}d`)} />
        <Stat label={L('全勤日', 'Perfect days')} value={m.perfectDays} sub={L('当天安排的全部完成 +30 XP', 'All scheduled done → +30 XP')} />
      </div>

      <QuickAdd />

      <div className="grid-2-1">
        <Card
          title={L('每日习惯', 'Daily habits')}
          icon="refresh"
          action={
            <div className="day-nav">
              <Button size="sm" variant="ghost" icon="chevron-left" title={L('前一天', 'Previous day')} onClick={() => setDay(addDays(day, -1))} />
              <span className="num">{isToday ? L('今天', 'Today') : parseDay(day).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' })}</span>
              <Button size="sm" variant="ghost" icon="chevron-right" title={L('后一天', 'Next day')} disabled={isToday} onClick={() => setDay(addDays(day, 1))} />
            </div>
          }
        >
          {allDailies.length === 0 ? (
            <Empty icon="refresh" title={L('还没有每日习惯', 'No daily habits yet')} body={L('从小处开始：喝水、阅读、散步。', 'Start tiny: water, reading, a walk.')} />
          ) : (
            <>
              <ul className="quest-list">
                {dailies.map((q) =>
                  row({ q, done: done.has(q.id), onToggle: () => actions.toggleQuest(q.id, day), onEdit: () => setEdit(q), week: week.map((d) => (isScheduled(q, d) ? (s.completions[d] ?? []).includes(q.id) : null)) }),
                )}
              </ul>
              {resting.length > 0 && (
                <p className="resting muted small">
                  <Icon name="bed" size={13} /> {L('今天休息：', 'Rest day for: ')}
                  {resting.map((q) => q.title).join(L('、', ', '))}
                </p>
              )}
            </>
          )}
        </Card>

        <Card title={L('一次性任务', 'One-off quests')} icon="target">
          {openOnce.length === 0 && doneOnce.length === 0 ? (
            <Empty icon="target" title={L('清单是空的', 'All clear')} body={L('把脑子里的事写下来。', 'Get it out of your head.')} />
          ) : (
            <ul className="quest-list">
              {openOnce.map((q) => row({ q, done: false, onToggle: () => actions.toggleQuest(q.id), onEdit: () => setEdit(q) }))}
              {doneOnce.slice(0, 6).map((q) => row({ q, done: true, onToggle: () => actions.toggleQuest(q.id), onEdit: () => setEdit(q) }))}
            </ul>
          )}
        </Card>
      </div>

      <QuestEditor value={edit} onClose={() => setEdit(null)} />
    </div>
  );

  function row({ q, done, onToggle, onEdit, week }: { q: Quest; done: boolean; onToggle: () => void; onEdit: () => void; week?: (boolean | null)[] }) {
    const tracker = q.log ? s.trackers.find((t) => t.id === q.log!.trackerId) : undefined;
    const running = s.active?.questId === q.id;
    return (
      <li key={q.id} className={`quest ${done ? 'is-done' : ''}`}>
        <CheckBubble checked={done} onChange={onToggle} tone={q.attr} label={q.title} />
        <div className="quest-main">
          <span className="quest-title">{q.title}</span>
          <span className="quest-meta">
            <Chip tone={q.attr}>{lang === 'zh' ? ATTR_META[q.attr].zh : ATTR_META[q.attr].en}</Chip>
            <span className="num muted">+{QUEST_XP[q.difficulty]} XP</span>
            {q.days?.length ? <span className="muted small">{q.days.map((d) => WEEKDAYS[d][lang === 'zh' ? 0 : 1]).join(lang === 'zh' ? '' : ' ')}</span> : null}
            {tracker && (
              <span className="link-hint">
                <Icon name="activity" size={11} /> {tracker.name} +{smart(q.log!.amount)}
              </span>
            )}
            {q.focusMin ? (
              <span className="link-hint">
                <Icon name="timer" size={11} /> {q.focusMin}′
              </span>
            ) : null}
            <GoalTag goalId={q.goalId} />
          </span>
        </div>
        {week && (
          <span className="week-dots" aria-label={L('近 7 天', 'Last 7 days')}>
            {week.map((v, i) => (
              <i key={i} className={v ? 'on' : v === null ? 'off' : ''} style={v ? { background: `var(--c-${q.attr})` } : undefined} />
            ))}
          </span>
        )}
        {!done && q.focusMin ? (
          <Button
            size="sm"
            variant={running ? 'primary' : 'soft'}
            icon={running ? 'timer' : 'play'}
            title={L('专注做这个', 'Focus on this')}
            onClick={() => {
              if (!running && !s.active) actions.focusOnQuest(q.id);
              open('earn');
            }}
          />
        ) : null}
        <Button size="sm" variant="ghost" icon="pencil" title={L('编辑', 'Edit')} onClick={onEdit} />
      </li>
    );
  }
}

/** One-line capture. Prefix with "!" for a daily habit. */
export function QuickAdd({ compact = false }: { compact?: boolean }) {
  const L = useL();
  const [t, setT] = useState('');
  return (
    <form
      className={`quick-add ${compact ? 'is-compact' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        const raw = t.trim();
        if (!raw) return;
        const daily = raw.startsWith('!') || raw.startsWith('！');
        actions.addQuest({ title: raw.replace(/^[!！]\s*/, ''), kind: daily ? 'daily' : 'once', attr: 'mind', difficulty: 'normal' });
        setT('');
      }}
    >
      <Icon name="plus" size={16} />
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder={compact ? L('快速添加，回车保存', 'Quick add, press Enter') : L('快速添加任务，回车保存（以 ! 开头 = 每日习惯）', 'Quick add, press Enter (start with ! for a daily habit)')} aria-label={L('快速添加任务', 'Quick add quest')} />
      {t && <kbd>↵</kbd>}
    </form>
  );
}

function QuestEditor({ value, onClose }: { value: Partial<Quest> | null; onClose: () => void }) {
  const L = useL();
  const lang = useLang();
  const goals = useStore((s) => s.milestones).filter((m) => m.status !== 'done');
  const trackers = useStore((s) => s.trackers);
  const [draft, setDraft] = useState<Partial<Quest>>({});
  const [lastId, setLastId] = useState<string | undefined>('__');
  const key = value ? (value.id ?? 'new') : undefined;
  if (key !== lastId) {
    setLastId(key);
    if (value) setDraft(value);
  }
  const d = { kind: 'daily', attr: 'mind', difficulty: 'normal', title: '', ...draft } as Quest;
  const set = (p: Partial<Quest>) => setDraft({ ...d, ...p });
  const save = () => {
    if (!d.title.trim()) return;
    const patch = {
      title: d.title.trim(),
      kind: d.kind,
      attr: d.attr,
      difficulty: d.difficulty,
      goalId: d.goalId || undefined,
      days: d.kind === 'daily' && d.days?.length && d.days.length < 7 ? [...d.days].sort() : undefined,
      focusMin: d.focusMin || undefined,
      log: d.log?.trackerId ? d.log : undefined,
    };
    if (d.id) actions.updateQuest(d.id, patch);
    else actions.addQuest(patch);
    onClose();
  };
  const linkedGoal = goals.find((g) => g.id === d.goalId);
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      width={580}
      title={d.id ? L('编辑任务', 'Edit quest') : L('新任务', 'New quest')}
      footer={
        <>
          {d.id && (
            <Button variant="danger" icon="trash" onClick={() => (actions.removeQuest(d.id), onClose())}>
              {L('删除', 'Delete')}
            </Button>
          )}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            {L('取消', 'Cancel')}
          </Button>
          <Button variant="primary" icon="check" onClick={save} disabled={!d.title.trim()}>
            {L('保存', 'Save')}
          </Button>
        </>
      }
    >
      <form onSubmit={(e) => (e.preventDefault(), save())} className="form">
        <Field label={L('任务名称', 'Quest')}>
          <input className="input" value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder={L('例如：读 20 页书', 'e.g. Read 20 pages')} />
        </Field>
        <div className="row2">
          <Field label={L('类型', 'Type')}>
            <Segmented
              value={d.kind}
              onChange={(v) => set({ kind: v })}
              options={[
                { value: 'daily', label: L('每日习惯', 'Habit'), icon: 'refresh' },
                { value: 'once', label: L('一次性', 'One-off'), icon: 'target' },
              ]}
            />
          </Field>
          <Field label={L('难度', 'Difficulty')}>
            <Segmented
              value={d.difficulty}
              onChange={(v) => set({ difficulty: v as Difficulty })}
              options={(['easy', 'normal', 'hard'] as Difficulty[]).map((x) => ({
                value: x,
                label: `${{ easy: L('轻松', 'Easy'), normal: L('标准', 'Normal'), hard: L('硬核', 'Hard') }[x]} ${QUEST_XP[x]}`,
              }))}
            />
          </Field>
        </div>
        {d.kind === 'daily' && (
          <Field label={L('安排在哪几天', 'Scheduled on')} hint={L('全选 = 每天。没安排的日子不影响全勤和连胜。', "All = every day. Unscheduled days don't break perfect days.")}>
            <div className="weekday-pick">
              {WEEKDAYS.map((w, i) => {
                const on = !d.days?.length || d.days.includes(i);
                return (
                  <button
                    type="button"
                    key={i}
                    className={on ? 'is-on' : ''}
                    aria-pressed={on}
                    onClick={() => {
                      const cur = d.days?.length ? d.days : [0, 1, 2, 3, 4, 5, 6];
                      const next = on ? cur.filter((x) => x !== i) : [...cur, i];
                      set({ days: next.length ? next : [i] });
                    }}
                  >
                    {w[lang === 'zh' ? 0 : 1]}
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        <Field label={L('提升属性', 'Attribute')}>
          <AttrPicker value={d.attr} onChange={(a) => set({ attr: a })} lang={lang} />
        </Field>

        <div className="link-box">
          <div className="link-box-head">
            <Icon name="route" size={15} />
            <strong>{L('联动', 'Links')}</strong>
            <span className="muted small">{L('可选：完成这个任务时，自动推动别的东西。', 'Optional: what this quest moves automatically.')}</span>
          </div>
          <Field
            label={L('贡献给目标', 'Counts toward goal')}
            hint={
              linkedGoal && !(linkedGoal.krs ?? []).some((k) => k.kind === 'quests')
                ? L('提示：给这个目标加一个「关联任务完成 N 次」的关键结果，完成次数就会计入进度。', 'Tip: give that goal a “complete linked quests N×” key result so completions count toward it.')
                : undefined
            }
          >
            <select className="input" value={d.goalId ?? ''} onChange={(e) => set({ goalId: e.target.value || undefined })}>
              <option value="">{L('— 不关联 —', '— None —')}</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="row2">
            <Field label={L('完成时记录到追踪', 'On completion, log to')}>
              <select className="input" value={d.log?.trackerId ?? ''} onChange={(e) => set({ log: e.target.value ? { trackerId: e.target.value, amount: d.log?.amount ?? 1 } : undefined })}>
                <option value="">{L('— 不记录 —', '— Nothing —')}</option>
                {trackers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.unit})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={L('记录数值', 'Amount')}>
              <input className="input" type="number" step="any" disabled={!d.log} value={d.log?.amount ?? ''} onChange={(e) => d.log && set({ log: { ...d.log, amount: +e.target.value } })} />
            </Field>
          </div>
          <Field label={L('专注满多少分钟自动完成', 'Auto-complete after focusing (min)')} hint={L('点任务旁的 ▶ 开始专注，当天累计够时长就自动打勾。', 'Hit ▶ on the quest to focus; it ticks itself once today’s focus reaches this.')}>
            <input className="input" type="number" min={0} step={5} value={d.focusMin ?? ''} placeholder={L('不设置', 'Off')} onChange={(e) => set({ focusMin: e.target.value ? +e.target.value : undefined })} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function AttrPicker({ value, onChange, lang }: { value: Attr; onChange: (a: Attr) => void; lang: 'zh' | 'en' }) {
  return (
    <div className="attr-pick">
      {ATTRS.map((a) => (
        <button type="button" key={a} className={`attr-opt ${value === a ? 'is-on' : ''}`} style={{ '--tone': `var(--c-${a})` } as CSSProperties} onClick={() => onChange(a)}>
          <Icon name={ATTR_META[a].icon} size={16} />
          {lang === 'zh' ? ATTR_META[a].zh : ATTR_META[a].en}
        </button>
      ))}
    </div>
  );
}
