import type { CSSProperties } from 'react';
import { useL } from '../lib/i18n';
import { open } from '../os/router';
import { useStore } from '../store/store';
import { lineage } from '../store/tree';
import type { Quest } from '../store/types';
import { Icon } from '../ui/Icon';

const cut = (t: string, n = 28) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/**
 * Where a to-do sits in the tree, as one trail: 🏁 goal › 💼 project › 📄 paper › ☑ step · 📅 plan.
 * Links the to-do doesn't set itself but inherits (e.g. a step's project) show faded.
 */
export function Lineage({ q, compact }: { q: Quest; compact?: boolean }) {
  const L = useL();
  const ln = useStore((s) => lineage(s, q));
  const parts: { key: string; icon: string; text: string; tone: string; to: Parameters<typeof open>[0]; inherited?: boolean; title: string }[] = [];
  if (ln.goal) parts.push({ key: 'g', icon: 'flag', text: ln.goal.title, tone: `var(--c-${ln.goal.attr})`, to: 'roadmap', inherited: !ln.ownGoal, title: L('目标', 'Goal') });
  if (ln.project) parts.push({ key: 'p', icon: 'briefcase', text: ln.project.name, tone: `var(--p-${ln.project.color})`, to: 'projects', inherited: !ln.ownProject, title: L('项目', 'Project') });
  if (ln.paper) parts.push({ key: 'a', icon: 'graduation', text: ln.paper.title, tone: 'var(--p-indigo, var(--accent))', to: 'research', title: L('论文', 'Paper') });
  if (ln.step) parts.push({ key: 's', icon: 'list-checks', text: ln.step.title, tone: 'var(--ink-3)', to: 'projects', title: L('推进的步骤', 'Step it advances') });
  if (!parts.length && !ln.plan) return null;
  if (compact && parts.length > 1) parts.splice(1); // small tiles: just the top of the trail
  return (
    <span className={`lineage ${compact ? 'is-compact' : ''}`}>
      {parts.map((x, i) => (
        <span key={x.key} className="lineage-part">
          {i > 0 && <Icon name="chevron-right" size={10} className="lineage-sep" />}
          <button type="button" className={`goal-tag ${x.inherited ? 'is-inherited' : ''}`} style={{ '--tone': x.tone } as CSSProperties} title={`${x.title}${x.inherited ? L('（继承自上一级）', ' (inherited)') : ''}: ${x.text}`} onClick={() => open(x.to)}>
            <Icon name={x.icon} size={11} stroke={2.6} />
            <span>{cut(x.text, compact ? 18 : 28)}</span>
          </button>
        </span>
      ))}
      {ln.plan && (
        <button type="button" className="goal-tag plan-tag" style={{ '--tone': 'var(--p-teal)' } as CSSProperties} title={`${L('计划', 'Plan')}: ${ln.plan.title}`} onClick={() => open('plan')}>
          <Icon name="calendar" size={11} stroke={2.6} />
          <span>{cut(ln.plan.title, compact ? 18 : 28)}</span>
        </button>
      )}
    </span>
  );
}
