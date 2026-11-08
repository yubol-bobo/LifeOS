import { useState, type CSSProperties } from 'react';
import { PALETTE } from '../store/attrs';
import { dayKey, daysBetween, parseDay } from '../lib/date';
import { money, num } from '../lib/format';
import { useL } from '../lib/i18n';
import { open } from '../os/router';
import { goalProgress, type KrProgress } from '../store/links';
import { useMetrics } from '../store/hooks';
import { actions, useStore } from '../store/store';
import type { KeyResult, KrKind, KrMetric, Milestone, State } from '../store/types';
import { Icon } from '../ui/Icon';
import { Bar, Button } from '../ui/kit';

export const KR_ICON: Record<KrKind | 'steps', string> = {
  steps: 'list-checks',
  quests: 'refresh',
  focus: 'timer',
  tracker: 'activity',
  metric: 'chart',
  manual: 'pencil',
};

export function useKrText() {
  const L = useL();
  const trackers = useStore((s) => s.trackers);
  const currency = useStore((s) => s.profile.currency);
  const base = useStore((s) => s.assets.base);
  const metricName = (m?: KrMetric) =>
    ({
      citations: L('总引用', 'Citations'),
      hIndex: 'h-index',
      papers: L('接收论文数', 'Accepted papers'),
      earned: L('时薪计累计收入', 'Wage-timer earnings'),
      level: L('等级', 'Level'),
      streak: L('最长连胜（天）', 'Best streak (days)'),
      netWorth: L('净资产', 'Net worth'),
    })[m ?? 'citations'];

  const label = (kr: KeyResult | null) => {
    if (!kr) return L('完成步骤清单', 'Finish the step checklist');
    const t = trackers.find((x) => x.id === kr.trackerId);
    switch (kr.kind) {
      case 'quests':
        return L(`关联任务完成 ${kr.target} 次`, `Complete linked quests ${kr.target}×`);
      case 'focus':
        return L(`为它专注 ${kr.target} 小时`, `Focus ${kr.target} h on it`);
      case 'tracker':
        if (!t) return L('追踪项已删除', 'Tracker removed');
        return t.mode === 'total'
          ? L(`${t.name}累计 ${num(kr.target)} ${t.unit}`, `${t.name} total ${num(kr.target)} ${t.unit}`)
          : t.lowerIsBetter
            ? L(`${t.name}降到 ${num(kr.target, 1)} ${t.unit}`, `${t.name} down to ${num(kr.target, 1)} ${t.unit}`)
            : L(`${t.name}达到 ${num(kr.target, 1)} ${t.unit}`, `${t.name} reaches ${num(kr.target, 1)} ${t.unit}`);
      case 'metric':
        return kr.metric === 'earned' || kr.metric === 'netWorth' ? `${metricName(kr.metric)} ≥ ${money(kr.target, kr.metric === 'netWorth' ? base : currency, 0)}` : `${metricName(kr.metric)} ≥ ${num(kr.target)}`;
      default:
        return kr.title || L('自定义指标', 'Custom metric');
    }
  };

  const value = (p: KrProgress) => {
    const kr = p.kr;
    if (kr?.kind === 'metric' && (kr.metric === 'earned' || kr.metric === 'netWorth')) {
      const c = kr.metric === 'netWorth' ? base : currency;
      return `${money(p.value, c, 0)} / ${money(p.target, c, 0)}`;
    }
    const d = kr?.kind === 'focus' || kr?.kind === 'tracker' ? 1 : 0;
    return `${num(p.value, d)} / ${num(p.target, d)}`;
  };

  return { label, value, metricName };
}

/** Breakdown of a goal's measurable parts. Compact mode for widgets. */
export function GoalParts({ m, compact = false }: { m: Milestone; compact?: boolean }) {
  const L = useL();
  const s = useStore((x) => x);
  const mx = useMetrics();
  const { label, value } = useKrText();
  const gp = goalProgress(s, m, mx);
  if (!gp.parts.length) return null;
  return (
    <ul className={`kr-list ${compact ? 'is-compact' : ''}`} style={{ '--tone': `var(--c-${m.attr})` } as CSSProperties}>
      {gp.parts.map((p) => (
        <li key={p.kr?.id ?? 'steps'} className={p.pct >= 1 ? 'is-met' : ''}>
          <span className="kr-ic">
            <Icon name={p.pct >= 1 ? 'check' : KR_ICON[p.kr?.kind ?? 'steps']} size={12} stroke={2.6} />
          </span>
          <span className="kr-label">{label(p.kr)}</span>
          {p.kr?.kind === 'manual' && !compact ? (
            <span className="kr-manual">
              <Button size="sm" variant="ghost" icon="minus" title={L('减少', 'Decrease')} onClick={() => actions.setKrValue(m.id, p.kr!.id, (p.kr!.current ?? 0) - 1)} />
              <span className="num">{value(p)}</span>
              <Button size="sm" variant="ghost" icon="plus" title={L('增加', 'Increase')} onClick={() => actions.setKrValue(m.id, p.kr!.id, (p.kr!.current ?? 0) + 1)} />
            </span>
          ) : (
            <span className="kr-val num">{value(p)}</span>
          )}
          {!compact && (
            <span className="kr-bar">
              <Bar value={p.pct} tone={m.attr} height={5} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Small "→ goal" tag shown on quests, sessions and widgets to make the chain visible. */
export function GoalTag({ goalId }: { goalId?: string }) {
  const g = useStore((s) => s.milestones.find((m) => m.id === goalId));
  if (!g) return null;
  return (
    <button className="goal-tag" style={{ '--tone': `var(--c-${g.attr})` } as CSSProperties} onClick={() => open('roadmap')} title={g.title}>
      <Icon name="flag" size={11} stroke={2.6} />
      <span>{g.title}</span>
    </button>
  );
}

export function openGoals(s: State) {
  return s.milestones.filter((m) => m.status !== 'done');
}

/** "→ project" tag. */
export function ProjectTag({ id }: { id?: string }) {
  const p = useStore((s) => s.projects.find((x) => x.id === id));
  if (!p) return null;
  return (
    <button className="goal-tag" style={{ '--tone': `var(--p-${p.color})` } as CSSProperties} onClick={() => open('projects')} title={p.name}>
      <Icon name="briefcase" size={11} stroke={2.6} />
      <span>{p.name}</span>
    </button>
  );
}

/** A quest's optional due date: "due today", "3 days left", "2 days late". */
export function DueChip({ due }: { due?: string }) {
  const L = useL();
  const lang = useStore((s) => s.profile.lang);
  if (!due) return null;
  const n = daysBetween(dayKey(), due);
  const cls = n < 0 ? 'is-late' : n === 0 ? 'is-today' : n <= 3 ? 'is-soon' : '';
  const text = n < 0 ? L(`逾期 ${-n} 天`, `${-n}d late`) : n === 0 ? L('今天到期', 'due today') : n <= 14 ? L(`还剩 ${n} 天`, `${n}d left`) : parseDay(due).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric' });
  return (
    <span className={`due-chip num ${cls}`} title={L(`截止 ${due}`, `Due ${due}`)}>
      <Icon name="calendar" size={11} /> {text}
    </span>
  );
}

/** "← plan" tag. */
export function PlanTag({ id }: { id?: string }) {
  const p = useStore((s) => s.plans.find((x) => x.id === id));
  if (!p) return null;
  return (
    <button className="goal-tag plan-tag" style={{ '--tone': 'var(--p-teal)' } as CSSProperties} onClick={() => open('plan')} title={p.title}>
      <Icon name="calendar" size={11} stroke={2.6} />
      <span>{p.title}</span>
    </button>
  );
}

/** Project picker used by every editor. */
export function ProjectSelect({ value, onChange }: { value?: string; onChange: (id: string | undefined) => void }) {
  const L = useL();
  const projects = useStore((s) => s.projects);
  // "+ New project…" turns the picker into a name field, so a project can be created right where it's needed
  const [adding, setAdding] = useState<string | null>(null);
  const create = () => {
    const name = adding?.trim();
    if (!name) return setAdding(null);
    const id = actions.upsertProject({ name, color: PALETTE[projects.length % PALETTE.length] });
    setAdding(null);
    onChange(id);
  };
  if (adding != null)
    return (
      <div className="input-group">
        <input
          className="input"
          autoFocus
          value={adding}
          placeholder={L('新项目的名字', 'New project name')}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.preventDefault(), create());
            if (e.key === 'Escape') (e.stopPropagation(), setAdding(null));
          }}
        />
        <Button variant="primary" icon="check" title={L('创建', 'Create')} onClick={create} />
        <Button icon="x" title={L('取消', 'Cancel')} onClick={() => setAdding(null)} />
      </div>
    );
  return (
    <select className="input" value={value ?? ''} onChange={(e) => (e.target.value === '__new' ? setAdding('') : onChange(e.target.value || undefined))}>
      <option value="">{L('— 不属于任何项目 —', '— No project —')}</option>
      {projects
        .filter((p) => p.status !== 'done' || p.id === value)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      <option value="__new">{L('＋ 新建项目…', '＋ New project…')}</option>
    </select>
  );
}
