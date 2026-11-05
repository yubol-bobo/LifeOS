import { useState, type CSSProperties } from 'react';
import { addDays, dayKey, lastNDays, parseDay } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { ATTR_META, useMetrics } from '../store/hooks';
import { QUEST_XP } from '../store/rules';
import { actions, useStore } from '../store/store';
import { ATTRS, type Attr, type Difficulty, type Quest } from '../store/types';
import { Icon } from '../ui/Icon';
import { Bar, Button, Card, CheckBubble, Chip, Empty, Field, Modal, Segmented, Stat } from '../ui/kit';

export function Quests() {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const m = useMetrics();
  const [day, setDay] = useState(dayKey());
  const [edit, setEdit] = useState<Partial<Quest> | null>(null);
  const isToday = day === dayKey();
  const done = new Set(s.completions[day] ?? []);
  const dailies = s.quests.filter((q) => q.kind === 'daily' && !q.archived);
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
          <p className="muted">{L('每日习惯给你稳定的经验值，一次性任务清空你的脑袋。', 'Daily habits pay steady XP. One-off quests clear your head.')}</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setEdit({ kind: 'daily', attr: 'mind', difficulty: 'normal', title: '' })}>
          {L('新任务', 'New quest')}
        </Button>
      </div>

      <div className="stats-row">
        <Stat label={L('今日进度', 'Today')} value={`${dailyDone}/${dailies.length}`} sub={<Bar value={dailies.length ? dailyDone / dailies.length : 0} height={6} />} />
        <Stat label={L('今日经验', 'XP today')} value={`+${xpToday}`} tone="accent" />
        <Stat label={L('连胜', 'Streak')} value={<>{m.streak.current}<small>{L('天', 'd')}</small></>} sub={L(`最佳 ${m.streak.best} 天`, `Best ${m.streak.best}d`)} />
        <Stat label={L('全勤日', 'Perfect days')} value={m.perfectDays} sub={L('全部完成 +30 XP', 'All done → +30 XP')} />
      </div>

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
          {dailies.length === 0 ? (
            <Empty icon="refresh" title={L('还没有每日习惯', 'No daily habits yet')} body={L('从小处开始：喝水、阅读、散步。', 'Start tiny: water, reading, a walk.')} />
          ) : (
            <ul className="quest-list">
              {dailies.map((q) =>
                row({ q, done: done.has(q.id), onToggle: () => actions.toggleQuest(q.id, day), onEdit: () => setEdit(q), week: week.map((d) => (s.completions[d] ?? []).includes(q.id)) }),
              )}
            </ul>
          )}
        </Card>

        <Card title={L('一次性任务', 'One-off quests')} icon="target">
          {openOnce.length === 0 && doneOnce.length === 0 ? (
            <Empty icon="target" title={L('清单是空的', 'All clear')} body={L('把脑子里的事写下来。', 'Get it out of your head.')} />
          ) : (
            <ul className="quest-list">
              {openOnce.map((q) =>
                row({ q, done: false, onToggle: () => actions.toggleQuest(q.id), onEdit: () => setEdit(q) }),
              )}
              {doneOnce.slice(0, 6).map((q) =>
                row({ q, done: true, onToggle: () => actions.toggleQuest(q.id), onEdit: () => setEdit(q) }),
              )}
            </ul>
          )}
        </Card>
      </div>

      <QuestEditor value={edit} onClose={() => setEdit(null)} />
    </div>
  );

  function row({ q, done, onToggle, onEdit, week }: { q: Quest; done: boolean; onToggle: () => void; onEdit: () => void; week?: boolean[] }) {
    return (
      <li key={q.id} className={`quest ${done ? 'is-done' : ''}`}>
        <CheckBubble checked={done} onChange={onToggle} tone={q.attr} label={q.title} />
        <div className="quest-main">
          <span className="quest-title">{q.title}</span>
          <span className="quest-meta">
            <Chip tone={q.attr}>{lang === 'zh' ? ATTR_META[q.attr].zh : ATTR_META[q.attr].en}</Chip>
            <span className="num muted">+{QUEST_XP[q.difficulty]} XP</span>
          </span>
        </div>
        {week && (
          <span className="week-dots" aria-label={L('近 7 天', 'Last 7 days')}>
            {week.map((v, i) => (
              <i key={i} className={v ? 'on' : ''} style={v ? { background: `var(--c-${q.attr})` } : undefined} />
            ))}
          </span>
        )}
        <Button size="sm" variant="ghost" icon="pencil" title={L('编辑', 'Edit')} onClick={onEdit} />
      </li>
    );
  }
}

function QuestEditor({ value, onClose }: { value: Partial<Quest> | null; onClose: () => void }) {
  const L = useL();
  const lang = useLang();
  const [draft, setDraft] = useState<Partial<Quest>>({});
  const [lastId, setLastId] = useState<string | undefined>('__');
  const key = value ? (value.id ?? 'new') : undefined;
  if (key !== lastId) {
    setLastId(key);
    if (value) setDraft(value);
  }
  const d = { kind: 'daily', attr: 'mind', difficulty: 'normal', title: '', ...draft } as Quest;
  const save = () => {
    if (!d.title.trim()) return;
    if (d.id) actions.updateQuest(d.id, { title: d.title, kind: d.kind, attr: d.attr, difficulty: d.difficulty });
    else actions.addQuest({ title: d.title.trim(), kind: d.kind, attr: d.attr, difficulty: d.difficulty });
    onClose();
  };
  return (
    <Modal
      open={!!value}
      onClose={onClose}
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
          <input className="input" value={d.title} onChange={(e) => setDraft({ ...d, title: e.target.value })} placeholder={L('例如：读 20 页书', 'e.g. Read 20 pages')} />
        </Field>
        <Field label={L('类型', 'Type')}>
          <Segmented
            value={d.kind}
            onChange={(v) => setDraft({ ...d, kind: v })}
            options={[
              { value: 'daily', label: L('每日习惯', 'Daily habit'), icon: 'refresh' },
              { value: 'once', label: L('一次性', 'One-off'), icon: 'target' },
            ]}
          />
        </Field>
        <Field label={L('难度', 'Difficulty')}>
          <Segmented
            value={d.difficulty}
            onChange={(v) => setDraft({ ...d, difficulty: v as Difficulty })}
            options={(['easy', 'normal', 'hard'] as Difficulty[]).map((x) => ({
              value: x,
              label: `${{ easy: L('轻松', 'Easy'), normal: L('标准', 'Normal'), hard: L('硬核', 'Hard') }[x]} · ${QUEST_XP[x]}`,
            }))}
          />
        </Field>
        <Field label={L('提升属性', 'Attribute')}>
          <AttrPicker value={d.attr} onChange={(a) => setDraft({ ...d, attr: a })} lang={lang} />
        </Field>
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
