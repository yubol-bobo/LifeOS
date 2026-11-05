import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { dayKey, daysBetween, lifeProgress, parseDay } from '../lib/date';
import { uid } from '../lib/id';
import { num } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { ATTR_META } from '../store/hooks';
import { MILESTONE_XP } from '../store/rules';
import { actions, useStore } from '../store/store';
import type { Milestone, MilestoneSize } from '../store/types';
import { Icon } from '../ui/Icon';
import { Bar, Button, Card, CheckBubble, Chip, Empty, Field, Modal, Segmented, Stat } from '../ui/kit';
import { AttrPicker } from './Quests';
import { GoalParts, KR_ICON, useKrText } from './goals';
import { goalProgress } from '../store/links';
import { useMetrics } from '../store/hooks';
import type { KeyResult, KrKind, KrMetric } from '../store/types';

export function Roadmap() {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const [edit, setEdit] = useState<Partial<Milestone> | null>(null);
  const lp = lifeProgress(s.profile.birthDate, s.profile.lifeExpectancy);
  const today = dayKey();

  const sorted = useMemo(() => {
    const when = (m: Milestone) => (m.status === 'done' ? m.doneAt : m.targetDate) ?? '9999';
    const rank = (m: Milestone) => (m.status === 'active' ? 0 : 1);
    return [...s.milestones].sort((a, b) => (a.status === 'done' || b.status === 'done' ? 0 : rank(a) - rank(b)) || when(a).localeCompare(when(b)));
  }, [s.milestones]);
  const past = sorted.filter((m) => m.status === 'done');
  const future = sorted.filter((m) => m.status !== 'done');
  const active = s.milestones.filter((m) => m.status === 'active').length;

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('人生地图', 'Roadmap')}</h1>
          <p className="muted">{L('人生不是一张待办清单，而是一张地图。标记你到过的地方，和你想去的地方。', "Life isn't a to-do list, it's a map. Mark where you've been and where you're heading.")}</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setEdit({ attr: 'mind', size: 'big', status: 'planned', steps: [], title: '' })}>
          {L('新里程碑', 'New milestone')}
        </Button>
      </div>

      <div className="stats-row">
        <Stat label={L('已达成', 'Reached')} value={past.length} tone="accent" />
        <Stat label={L('进行中', 'In progress')} value={active} />
        <Stat label={L('已度过', 'Weeks lived')} value={num(lp.weeksLived)} sub={L(`共约 ${num(lp.weeksTotal)} 周`, `of ~${num(lp.weeksTotal)}`)} />
        <Stat label={L('人生进度', 'Life progress')} value={`${(lp.life * 100).toFixed(1)}%`} sub={<Bar value={lp.life} tone="spirit" height={6} />} />
      </div>

      <div className="grid-1-1 roadmap-grid">
        <Card title={L('目标', 'Goals')} icon="route" action={<span className="muted small">{L('从现在出发 →', 'From now on →')}</span>}>
          {future.length === 0 ? (
            <Empty icon="flag" title={L('还没有进行中的目标', 'No open goals')} body={L('毕业、搬家、第一次马拉松……给它加上关键结果，日常行动就会自动推动它。', 'Graduation, a move, a first marathon… add key results and daily actions will push it forward.')} />
          ) : (
            <ol className="timeline">
              <li className="tl-now">
                <span className="tl-now-dot" />
                <span>
                  {L('现在', 'Now')} · {parseDay(today).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </li>
              {future.map((m) => (
                <MilestoneItem key={m.id} m={m} onEdit={() => setEdit(m)} />
              ))}
            </ol>
          )}
        </Card>

        <div className="stack">
          <Card title={L('人生周格', 'Life in weeks')} icon="grid">
            <p className="muted small">{L(`每一格是一周，每一行是一年。共 ${s.profile.lifeExpectancy} 行。彩色圆点是里程碑。`, `Each cell is a week, each row a year — ${s.profile.lifeExpectancy} rows. Colored dots are milestones.`)}</p>
            <LifeWeeks />
          </Card>
          <Card title={L('已抵达', 'Reached')} icon="mountain">
            {past.length === 0 ? (
              <p className="muted small">{L('达成的里程碑会收藏在这里。', 'Reached milestones are collected here.')}</p>
            ) : (
              <ul className="reached">
                {[...past].reverse().map((m) => (
                  <li key={m.id} style={{ '--tone': `var(--c-${m.attr})` } as CSSProperties}>
                    <span className="reached-dot">
                      <Icon name="check" size={11} stroke={3} />
                    </span>
                    <span className="num muted small">{m.doneAt}</span>
                    <strong>{m.title}</strong>
                    <span className="num muted small">+{MILESTONE_XP[m.size]}</span>
                    <Button size="sm" variant="ghost" icon="pencil" title={L('编辑', 'Edit')} onClick={() => setEdit(m)} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <MilestoneEditor value={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function MilestoneItem({ m, onEdit }: { m: Milestone; onEdit: () => void }) {
  const L = useL();
  const lang = useLang();
  const today = dayKey();
  const s = useStore((x) => x);
  const mx = useMetrics();
  const gp = goalProgress(s, m, mx);
  const done = m.status === 'done';
  const stepsDone = m.steps.filter((x) => x.done).length;
  const days = m.targetDate ? daysBetween(today, m.targetDate) : null;
  const date = done ? m.doneAt : m.targetDate;
  return (
    <li className={`tl-item is-${m.status} ${gp.ready ? 'is-ready' : ''}`} style={{ '--tone': `var(--c-${m.attr})` } as CSSProperties}>
      <span className="tl-node">
        <Icon name={done ? 'check' : m.size === 'epic' ? 'mountain' : 'flag'} size={13} stroke={3} />
      </span>
      <div className="tl-card">
        <div className="tl-top">
          <span className="tl-date num">{date ?? L('未定日期', 'No date')}</span>
          {!done && days != null && <span className={`tl-count num ${days < 0 ? 'is-late' : ''}`}>{days >= 0 ? L(`还有 ${days} 天`, `in ${days}d`) : L(`逾期 ${-days} 天`, `${-days}d late`)}</span>}
          <span className="spacer" />
          <Button size="sm" variant="ghost" icon="pencil" title={L('编辑', 'Edit')} onClick={onEdit} />
        </div>
        <strong className="tl-title">{m.title}</strong>
        {m.note && <p className="tl-note">{m.note}</p>}
        <div className="tl-meta">
          <Chip tone={m.attr}>{lang === 'zh' ? ATTR_META[m.attr].zh : ATTR_META[m.attr].en}</Chip>
          <Chip icon={m.size === 'epic' ? 'mountain' : 'flag'}>
            {{ small: L('小目标', 'Small'), big: L('大目标', 'Big'), epic: L('史诗', 'Epic') }[m.size]} · {MILESTONE_XP[m.size]} XP
          </Chip>
        </div>
        {!done && gp.pct != null && (
          <div className="tl-progress">
            <Bar value={gp.pct} tone={m.attr} height={8} />
            <span className="num">{Math.round(gp.pct * 100)}%</span>
          </div>
        )}
        {!done && (m.krs?.length ?? 0) > 0 && <GoalParts m={m} />}
        {!done && gp.linkedQuests.length > 0 && (
          <div className="tl-linked">
            <Icon name="refresh" size={12} />
            <span className="muted small">{L('推动它的任务：', 'Fed by: ')}</span>
            {gp.linkedQuests.map((q) => (
              <span key={q.id} className="linked-q">
                {q.title}
              </span>
            ))}
          </div>
        )}
        {m.steps.length > 0 && (
          <div className="tl-steps">
            {(m.krs?.length ?? 0) === 0 && <Bar value={stepsDone / m.steps.length} tone={m.attr} height={6} />}
            <ul>
              {m.steps.map((st) => (
                <li key={st.id} className={st.done ? 'is-done' : ''}>
                  <CheckBubble checked={st.done} onChange={() => actions.toggleStep(m.id, st.id)} tone={m.attr} label={st.title} />
                  <span>{st.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!done && (
          <div className="tl-actions">
            {m.status === 'planned' && (
              <Button size="sm" variant="soft" icon="play" onClick={() => actions.setMilestoneStatus(m.id, 'active')}>
                {L('开始推进', 'Start')}
              </Button>
            )}
            {gp.ready ? (
              <Button size="sm" variant="gold" icon="gift" onClick={() => actions.setMilestoneStatus(m.id, 'done')}>
                {L(`领取 +${MILESTONE_XP[m.size]} XP`, `Claim +${MILESTONE_XP[m.size]} XP`)}
              </Button>
            ) : (
              <Button size="sm" variant={gp.pct == null ? 'primary' : 'soft'} icon="flag" onClick={() => actions.setMilestoneStatus(m.id, 'done')}>
                {L('标记达成', 'Mark reached')}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}


/* ------------------------------------------------------------------ */

function LifeWeeks() {
  const L = useL();
  const profile = useStore((s) => s.profile);
  const milestones = useStore((s) => s.milestones);
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [theme, setTheme] = useState(document.documentElement.dataset.theme);
  const years = profile.lifeExpectancy;
  const birth = parseDay(profile.birthDate);
  const lp = lifeProgress(profile.birthDate, years);

  const marks = useMemo(() => {
    const map = new Map<number, Milestone>();
    for (const m of milestones) {
      const d = m.status === 'done' ? m.doneAt : m.targetDate;
      if (!d) continue;
      const w = Math.floor((parseDay(d).getTime() - birth.getTime()) / (7 * 86_400_000));
      if (w >= 0) map.set(w, m);
    }
    return map;
  }, [milestones, profile.birthDate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(document.documentElement.dataset.theme));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  const [w, setW] = useState(0);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const cell = w ? Math.max(4, Math.floor((w - 28) / 52)) : 8;
  const gap = cell > 7 ? 2 : 1;
  const size = cell - gap;
  const W = 28 + 52 * cell;
  const H = years * cell + 4;

  useEffect(() => {
    const c = ref.current;
    if (!c || !w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr;
    c.height = H * dpr;
    c.style.width = `${W}px`;
    c.style.height = `${H}px`;
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const v = (n: string) => css.getPropertyValue(n).trim();
    const lived = v('--ink-2');
    const future = v('--surface-3');
    const accent = v('--accent');
    g.font = `600 ${Math.max(8, cell - 1)}px Manrope Variable, system-ui`;
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    for (let y = 0; y < years; y++) {
      if (y % 10 === 0) {
        g.fillStyle = v('--ink-3');
        g.fillText(String(y), 22, y * cell + size / 2 + 1);
      }
      for (let x = 0; x < 52; x++) {
        const idx = y * 52 + x;
        const px = 28 + x * cell;
        const py = y * cell;
        const mark = marks.get(idx);
        const r = Math.min(2, size / 3);
        g.beginPath();
        g.roundRect(px, py, size, size, r);
        if (idx === lp.weeksLived) g.fillStyle = accent;
        else if (idx < lp.weeksLived) g.fillStyle = lived;
        else g.fillStyle = future;
        g.globalAlpha = idx < lp.weeksLived ? 0.55 : 1;
        g.fill();
        g.globalAlpha = 1;
        if (mark) {
          g.beginPath();
          g.arc(px + size / 2, py + size / 2, Math.max(2.5, size * 0.75), 0, Math.PI * 2);
          g.fillStyle = v('--surface');
          g.fill();
          g.beginPath();
          g.arc(px + size / 2, py + size / 2, Math.max(2, size * 0.55), 0, Math.PI * 2);
          g.fillStyle = v(`--c-${mark.attr}`);
          g.fill();
        }
      }
    }
  }, [w, theme, marks, years, lp.weeksLived, W, H, cell, size]);

  return (
    <div className="weeks" ref={wrap} onPointerLeave={() => setTip(null)}>
      <canvas
        ref={ref}
        role="img"
        aria-label={L(`人生周格：已度过 ${lp.weeksLived} 周`, `Life in weeks: ${lp.weeksLived} weeks lived`)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = Math.floor((e.clientX - r.left - 28) / cell);
          const y = Math.floor((e.clientY - r.top) / cell);
          if (x < 0 || x >= 52 || y < 0 || y >= years) return setTip(null);
          const idx = y * 52 + x;
          const mark = marks.get(idx);
          const date = new Date(birth.getTime() + idx * 7 * 86_400_000);
          setTip({
            x: e.clientX - r.left,
            y: e.clientY - r.top,
            text: `${L(`${y} 岁 · 第 ${x + 1} 周`, `Age ${y} · week ${x + 1}`)} · ${dayKey(date)}${mark ? ` · ${mark.title}` : ''}`,
          });
        }}
      />
      {tip && (
        <div className="tip tip-center" style={{ left: tip.x, top: tip.y - 14 }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MilestoneEditor({ value, onClose }: { value: Partial<Milestone> | null; onClose: () => void }) {
  const L = useL();
  const lang = useLang();
  const [d, setD] = useState<Partial<Milestone>>({});
  const [key, setKey] = useState<string | undefined>('__');
  const k = value ? (value.id ?? 'new') : undefined;
  if (k !== key) {
    setKey(k);
    if (value) setD(structuredClone(value));
  }
  const [stepText, setStepText] = useState('');
  const m = { attr: 'mind', size: 'big', status: 'planned', steps: [], title: '', ...d } as Milestone;
  const save = () => {
    if (!m.title.trim()) return;
    actions.saveMilestone({ ...m, title: m.title.trim() });
    onClose();
  };
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={m.id ? L('编辑里程碑', 'Edit milestone') : L('新里程碑', 'New milestone')}
      width={560}
      footer={
        <>
          {m.id && (
            <Button variant="danger" icon="trash" onClick={() => (actions.removeMilestone(m.id), onClose())}>
              {L('删除', 'Delete')}
            </Button>
          )}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            {L('取消', 'Cancel')}
          </Button>
          <Button variant="primary" icon="check" onClick={save} disabled={!m.title.trim()}>
            {L('保存', 'Save')}
          </Button>
        </>
      }
    >
      <div className="form">
        <Field label={L('里程碑', 'Milestone')}>
          <input className="input" value={m.title} onChange={(e) => setD({ ...m, title: e.target.value })} placeholder={L('例如：博士毕业', 'e.g. Defend the PhD')} />
        </Field>
        <Field label={L('备注', 'Note')}>
          <textarea className="input" rows={2} value={m.note ?? ''} onChange={(e) => setD({ ...m, note: e.target.value })} />
        </Field>
        <div className="row2">
          <Field label={L('状态', 'Status')}>
            <select className="input" value={m.status} onChange={(e) => setD({ ...m, status: e.target.value as Milestone['status'] })}>
              <option value="planned">{L('计划中', 'Planned')}</option>
              <option value="active">{L('进行中', 'In progress')}</option>
              <option value="done">{L('已达成', 'Reached')}</option>
            </select>
          </Field>
          <Field label={m.status === 'done' ? L('达成日期', 'Reached on') : L('目标日期', 'Target date')}>
            <input
              className="input"
              type="date"
              value={(m.status === 'done' ? m.doneAt : m.targetDate) ?? ''}
              onChange={(e) => setD(m.status === 'done' ? { ...m, doneAt: e.target.value } : { ...m, targetDate: e.target.value })}
            />
          </Field>
        </div>
        <Field label={L('规模', 'Size')}>
          <Segmented
            value={m.size}
            onChange={(v) => setD({ ...m, size: v as MilestoneSize })}
            options={(['small', 'big', 'epic'] as MilestoneSize[]).map((x) => ({
              value: x,
              label: `${{ small: L('小目标', 'Small'), big: L('大目标', 'Big'), epic: L('史诗', 'Epic') }[x]} · ${MILESTONE_XP[x]}`,
            }))}
          />
        </Field>
        <Field label={L('属性', 'Attribute')}>
          <AttrPicker value={m.attr} onChange={(a) => setD({ ...m, attr: a })} lang={lang} />
        </Field>
        <KrBuilder krs={m.krs ?? []} onChange={(krs) => setD({ ...m, krs })} />
        <Field label={L('拆解步骤（每步 +15 XP）', 'Steps (+15 XP each)')}>
          <ul className="step-edit">
            {m.steps.map((st) => (
              <li key={st.id}>
                <span>{st.title}</span>
                <Button size="sm" variant="ghost" icon="x" title={L('移除', 'Remove')} onClick={() => setD({ ...m, steps: m.steps.filter((x) => x.id !== st.id) })} />
              </li>
            ))}
          </ul>
          <div className="input-group">
            <input
              className="input"
              value={stepText}
              placeholder={L('添加一个步骤，回车确认', 'Add a step, press Enter')}
              onChange={(e) => setStepText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && stepText.trim()) {
                  e.preventDefault();
                  setD({ ...m, steps: [...m.steps, { id: uid(), title: stepText.trim(), done: false }] });
                  setStepText('');
                }
              }}
            />
          </div>
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function KrBuilder({ krs, onChange }: { krs: KeyResult[]; onChange: (k: KeyResult[]) => void }) {
  const L = useL();
  const trackers = useStore((s) => s.trackers);
  const { label, metricName } = useKrText();
  const [kind, setKind] = useState<KrKind>('quests');
  const [target, setTarget] = useState(20);
  const [trackerId, setTrackerId] = useState('');
  const [metric, setMetric] = useState<KrMetric>('citations');
  const [title, setTitle] = useState('');
  const kinds: { v: KrKind; zh: string; en: string }[] = [
    { v: 'quests', zh: '关联任务次数', en: 'Linked quests' },
    { v: 'focus', zh: '专注小时', en: 'Focus hours' },
    { v: 'tracker', zh: '追踪数据', en: 'Tracker' },
    { v: 'metric', zh: '系统指标', en: 'System metric' },
    { v: 'manual', zh: '手动计数', en: 'Manual count' },
  ];
  const add = () => {
    if (!(target > 0)) return;
    if (kind === 'tracker' && !trackerId) return;
    if (kind === 'manual' && !title.trim()) return;
    onChange([...krs, { id: uid(), kind, target, ...(kind === 'tracker' ? { trackerId } : {}), ...(kind === 'metric' ? { metric } : {}), ...(kind === 'manual' ? { title: title.trim(), current: 0 } : {}) }]);
    setTitle('');
  };
  return (
    <div className="link-box">
      <div className="link-box-head">
        <Icon name="target" size={15} />
        <strong>{L('关键结果（自动追踪）', 'Key results (auto-tracked)')}</strong>
      </div>
      <p className="muted small">{L('定义「怎样算完成」。进度会从任务、专注、追踪和学术数据里自动计算，全部达成后可以领取奖励。', 'Define what “done” means. Progress is computed from quests, focus, trackers and research data — claim the reward when all are met.')}</p>
      {krs.length > 0 && (
        <ul className="step-edit">
          {krs.map((k) => (
            <li key={k.id}>
              <span className="kr-row">
                <Icon name={KR_ICON[k.kind]} size={13} /> {label(k)}
              </span>
              <Button size="sm" variant="ghost" icon="x" title={L('移除', 'Remove')} onClick={() => onChange(krs.filter((x) => x.id !== k.id))} />
            </li>
          ))}
        </ul>
      )}
      <div className="kr-form">
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as KrKind)} aria-label={L('类型', 'Kind')}>
          {kinds.map((k) => (
            <option key={k.v} value={k.v}>
              {L(k.zh, k.en)}
            </option>
          ))}
        </select>
        {kind === 'tracker' && (
          <select className="input" value={trackerId} onChange={(e) => setTrackerId(e.target.value)} aria-label={L('追踪项', 'Tracker')}>
            <option value="">{L('选择追踪项', 'Pick a tracker')}</option>
            {trackers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.mode === 'total' ? L('累计', 'total') : t.lowerIsBetter ? L('降到', 'down to') : L('达到', 'reach')})
              </option>
            ))}
          </select>
        )}
        {kind === 'metric' && (
          <select className="input" value={metric} onChange={(e) => setMetric(e.target.value as KrMetric)} aria-label={L('指标', 'Metric')}>
            {(['citations', 'hIndex', 'papers', 'earned', 'level', 'streak'] as KrMetric[]).map((x) => (
              <option key={x} value={x}>
                {metricName(x)}
              </option>
            ))}
          </select>
        )}
        {kind === 'manual' && <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L('例如：投递 20 家公司', 'e.g. Apply to 20 companies')} />}
        <input className="input input-num" type="number" min={0} step="any" value={target} onChange={(e) => setTarget(+e.target.value)} aria-label={L('目标值', 'Target')} />
        <Button icon="plus" onClick={add}>
          {L('添加', 'Add')}
        </Button>
      </div>
    </div>
  );
}
