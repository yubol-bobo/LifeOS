import { useState } from 'react';
import { useL } from '../lib/i18n';
import { actions, useStore } from '../store/store';
import { Icon } from './Icon';
import { Bar, Button } from './kit';

/**
 * Today's goal for paid work ('work') or project time ('focus'). Optional: click to set the hours,
 * or turn it off. Shown on the desktop tile, in Earn and in Projects.
 */
export function FocusGoal({ kind, doneMs, compact = false }: { kind: 'work' | 'focus'; doneMs: number; compact?: boolean }) {
  const L = useL();
  const goal = useStore((s) => (kind === 'work' ? (s.profile.workGoalMin ?? 0) : s.profile.focusGoalMin)) || 0;
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(goal || (kind === 'work' ? 360 : 180));
  const label = kind === 'work' ? L('今日赚钱目标', "Today's paid-work goal") : L('今日项目专注目标', "Today's project-focus goal");
  const save = (min: number) => {
    actions.profile(kind === 'work' ? { workGoalMin: min } : { focusGoalMin: min });
    setEdit(false);
  };
  const h = (ms: number) => (ms / 3_600_000).toFixed(1);
  if (edit)
    return (
      <div className={`fgoal is-edit ${compact ? 'is-compact' : ''}`}>
        <span className="muted small">{label}</span>
        <span className="fgoal-step">
          <Button size="sm" variant="ghost" icon="minus" title={L('减少 30 分钟', '−30 min')} disabled={draft <= 30} onClick={() => setDraft(Math.max(30, draft - 30))} />
          <b className="num">{(draft / 60).toFixed(1)} h</b>
          <Button size="sm" variant="ghost" icon="plus" title={L('增加 30 分钟', '+30 min')} disabled={draft >= 16 * 60} onClick={() => setDraft(Math.min(16 * 60, draft + 30))} />
        </span>
        <span className="fgoal-act">
          <Button size="sm" variant="primary" icon="check" onClick={() => save(draft)}>
            {L('设定', 'Set')}
          </Button>
          {goal > 0 && (
            <Button size="sm" variant="ghost" onClick={() => save(0)}>
              {L('不设目标', 'No goal')}
            </Button>
          )}
          <Button size="sm" variant="ghost" icon="x" title={L('取消', 'Cancel')} onClick={() => setEdit(false)} />
        </span>
      </div>
    );
  if (!goal)
    return (
      <button type="button" className={`fgoal is-off ${compact ? 'is-compact' : ''}`} onClick={() => (setDraft(kind === 'work' ? 360 : 180), setEdit(true))}>
        <Icon name="target" size={13} /> {kind === 'work' ? L('设个今日赚钱目标（可选）', 'Set a paid-work goal for today (optional)') : L('设个今日项目专注目标（可选）', 'Set a project-focus goal for today (optional)')}
      </button>
    );
  return (
    <button type="button" className={`fgoal ${compact ? 'is-compact' : ''}`} title={L('点一下修改或关闭目标', 'Click to change or turn off')} onClick={() => (setDraft(goal), setEdit(true))}>
      <span className="fgoal-top">
        <span className="muted small">{label}</span>
        <span className="num small">
          {h(doneMs)} / {(goal / 60).toFixed(1)} h <Icon name="pencil" size={11} />
        </span>
      </span>
      <Bar value={doneMs / (goal * 60_000)} tone={kind === 'work' ? 'wealth' : 'violet'} height={compact ? 7 : 10} label={label} />
    </button>
  );
}
