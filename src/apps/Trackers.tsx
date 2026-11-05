import { useState } from 'react';
import { dayKey, parseDay } from '../lib/date';
import { num, smart } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { ATTR_META } from '../store/hooks';
import { actions, useStore } from '../store/store';
import type { Tracker } from '../store/types';
import { AreaChart } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { Bar, Button, Card, Chip, Empty, Field, Modal, Segmented } from '../ui/kit';
import { AttrPicker } from './Quests';
import { GoalTag } from './goals';

export function Trackers() {
  const L = useL();
  const trackers = useStore((s) => s.trackers);
  const [edit, setEdit] = useState<Partial<Tracker> | null>(null);
  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('追踪', 'Trackers')}</h1>
          <p className="muted">{L('体重、跑量、阅读页数、睡眠……任何能被量化的东西。每天记录 +5 XP。', 'Weight, mileage, pages read, sleep… anything you can count. +5 XP per day logged.')}</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setEdit({ name: '', unit: '', attr: 'body', mode: 'latest' })}>
          {L('新追踪', 'New tracker')}
        </Button>
      </div>
      {trackers.length === 0 ? (
        <Card>
          <Empty icon="activity" title={L('还没有追踪项', 'No trackers yet')} body={L('从一个你在意的数字开始。', 'Start with one number you care about.')} />
        </Card>
      ) : (
        <div className="tracker-grid">
          {trackers.map((t) => (
            <TrackerCard key={t.id} t={t} onEdit={() => setEdit(t)} />
          ))}
        </div>
      )}
      <TrackerEditor value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function TrackerCard({ t, onEdit }: { t: Tracker; onEdit: () => void }) {
  const L = useL();
  const lang = useLang();
  const [val, setVal] = useState('');
  const entries = t.entries.slice(-30);
  const total = t.entries.reduce((a, e) => a + e.value, 0);
  const latest = t.entries[t.entries.length - 1]?.value;
  const prev = t.entries[t.entries.length - 2]?.value;
  const headline = t.mode === 'total' ? total : latest;
  const delta = t.mode === 'latest' && latest != null && prev != null ? latest - prev : null;
  const progress =
    t.goal == null || headline == null
      ? null
      : t.mode === 'total'
        ? total / t.goal
        : t.lowerIsBetter
          ? (() => {
              // progress measured from the first reading toward the goal
              const start = t.entries[0].value;
              return start <= t.goal! ? (headline <= t.goal! ? 1 : 0) : (start - headline) / (start - t.goal!);
            })()
          : headline / t.goal;
  const loggedToday = t.entries.some((e) => e.date === dayKey());
  const feeders = useStore((s) => s.quests).filter((q) => q.log?.trackerId === t.id && !q.archived);
  const goals = useStore((s) => s.milestones).filter((m) => m.status !== 'done' && m.krs?.some((k) => k.trackerId === t.id));
  const good = delta == null ? null : t.lowerIsBetter ? delta <= 0 : delta >= 0;

  let series = entries.map((e) => ({ x: parseDay(e.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric' }), y: e.value }));
  if (t.mode === 'total') {
    let acc = t.entries.slice(0, -30).reduce((a, e) => a + e.value, 0);
    series = series.map((p) => ({ ...p, y: +(acc += p.y).toFixed(2) }));
  }

  return (
    <Card
      tone={t.attr}
      className="tracker"
      title={t.name}
      icon={ATTR_META[t.attr].icon}
      action={<Button size="sm" variant="ghost" icon="pencil" title={L('编辑', 'Edit')} onClick={onEdit} />}
    >
      <div className="tracker-top">
        <div>
          <span className="big-num num">{headline == null ? '—' : smart(+headline.toFixed(1))}</span>
          <span className="unit">{t.unit}</span>
        </div>
        {delta != null && (
          <Chip icon={delta < 0 ? 'trending-down' : 'trending-up'} tone={good ? 'wealth' : undefined}>
            {delta > 0 ? '+' : ''}
            {num(delta, 1)} {good ? L('不错', 'nice') : ''}
          </Chip>
        )}
      </div>
      {progress != null && (
        <div className="tracker-goal">
          <Bar value={progress} tone={t.attr} height={8} />
          <span className="muted small num">
            {L('目标', 'Goal')} {smart(t.goal!)} {t.unit} · {Math.round(Math.max(0, Math.min(1, progress)) * 100)}%
          </span>
        </div>
      )}
      {(feeders.length > 0 || goals.length > 0) && (
        <div className="tracker-links">
          {feeders.map((q) => (
            <span key={q.id} className="link-hint">
              <Icon name="refresh" size={11} /> {q.title} +{smart(q.log!.amount)}
            </span>
          ))}
          {goals.map((g) => (
            <GoalTag key={g.id} goalId={g.id} />
          ))}
        </div>
      )}
      {series.length > 1 ? <AreaChart data={series} tone={t.attr} height={140} baseline={t.mode === 'total' ? 'zero' : 'auto'} /> : <div className="tracker-empty muted small">{L('记录两次以上显示趋势', 'Log twice to see a trend')}</div>}
      <form
        className="input-group"
        onSubmit={(e) => {
          e.preventDefault();
          const v = parseFloat(val);
          if (!Number.isFinite(v)) return;
          actions.logTracker(t.id, v);
          setVal('');
        }}
      >
        <input className="input" type="number" step="any" value={val} onChange={(e) => setVal(e.target.value)} placeholder={t.mode === 'total' ? L(`今天新增（${t.unit}）`, `Add today (${t.unit})`) : L(`今天的读数（${t.unit}）`, `Today's reading (${t.unit})`)} />
        <Button type="submit" variant="primary" icon={loggedToday ? 'check' : 'plus'}>
          {L('记录', 'Log')}
        </Button>
      </form>
    </Card>
  );
}

function TrackerEditor({ value, onClose }: { value: Partial<Tracker> | null; onClose: () => void }) {
  const L = useL();
  const lang = useLang();
  const [d, setD] = useState<Partial<Tracker>>({});
  const [key, setKey] = useState<string | undefined>('__');
  const k = value ? (value.id ?? 'new') : undefined;
  if (k !== key) {
    setKey(k);
    if (value) setD(value);
  }
  const t = { name: '', unit: '', attr: 'body', mode: 'latest', ...d } as Tracker;
  const save = () => {
    if (!t.name.trim()) return;
    const { entries: _e, ...rest } = t;
    void _e;
    actions.saveTracker({ ...rest, name: t.name.trim() });
    onClose();
  };
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={t.id ? L('编辑追踪', 'Edit tracker') : L('新追踪', 'New tracker')}
      footer={
        <>
          {t.id && (
            <Button variant="danger" icon="trash" onClick={() => (actions.removeTracker(t.id), onClose())}>
              {L('删除', 'Delete')}
            </Button>
          )}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            {L('取消', 'Cancel')}
          </Button>
          <Button variant="primary" icon="check" onClick={save} disabled={!t.name.trim()}>
            {L('保存', 'Save')}
          </Button>
        </>
      }
    >
      <div className="form">
        <div className="row2">
          <Field label={L('名称', 'Name')}>
            <input className="input" value={t.name} onChange={(e) => setD({ ...t, name: e.target.value })} placeholder={L('例如：跑步', 'e.g. Running')} />
          </Field>
          <Field label={L('单位', 'Unit')}>
            <input className="input" value={t.unit} onChange={(e) => setD({ ...t, unit: e.target.value })} placeholder="km" />
          </Field>
        </div>
        <Field label={L('记录方式', 'Mode')} hint={t.mode === 'total' ? L('累加每次记录，例如跑量、阅读页数。', 'Adds up entries — mileage, pages read.') : L('只看最新读数，例如体重、睡眠。', 'Uses the latest reading — weight, sleep.')}>
          <Segmented
            value={t.mode}
            onChange={(v) => setD({ ...t, mode: v })}
            options={[
              { value: 'latest', label: L('最新读数', 'Latest') },
              { value: 'total', label: L('累计', 'Total') },
            ]}
          />
        </Field>
        <div className="row2">
          <Field label={L('目标（可选）', 'Goal (optional)')}>
            <input className="input" type="number" step="any" value={t.goal ?? ''} onChange={(e) => setD({ ...t, goal: e.target.value === '' ? undefined : +e.target.value })} />
          </Field>
          <Field label={L('方向', 'Direction')}>
            <Segmented
              value={t.lowerIsBetter ? 'down' : 'up'}
              onChange={(v) => setD({ ...t, lowerIsBetter: v === 'down' })}
              options={[
                { value: 'up', label: <><Icon name="trending-up" size={14} /> {L('越高越好', 'Higher')}</> },
                { value: 'down', label: L('越低越好', 'Lower') },
              ]}
            />
          </Field>
        </div>
        <Field label={L('属性', 'Attribute')}>
          <AttrPicker value={t.attr} onChange={(a) => setD({ ...t, attr: a })} lang={lang} />
        </Field>
      </div>
    </Modal>
  );
}
