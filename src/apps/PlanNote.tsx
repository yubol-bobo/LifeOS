import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { useL } from '../lib/i18n';
import { planCount } from '../store/plans';
import { actions, getState, useStore } from '../store/store';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/kit';

interface Ask {
  planId: string;
  logId?: string; // an automatic +1 that is waiting for its note
  day?: string;
  manual?: boolean; // opened from the plan's "+1" button
}

/** Open the "log progress on a plan" card from anywhere. */
export const askPlanNote = (planId: string, opts: Omit<Ask, 'planId'> = {}) => window.dispatchEvent(new CustomEvent('lifeos:plan-progress', { detail: { planId, ...opts } }));

/**
 * A small card that appears whenever a plan moves forward (a linked quest got done, or you tapped +1),
 * offering to write down the details: which book, which film, how much the bench press went up.
 */
export function PlanNoteSheet() {
  const L = useL();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState(1);
  const touched = useRef(false);
  const timer = useRef(0);
  const plan = useStore((s) => (ask ? s.plans.find((p) => p.id === ask.planId) : undefined));

  useEffect(() => {
    const f = (e: Event) => {
      const a = (e as CustomEvent<Ask>).detail;
      const p = getState().plans.find((x) => x.id === a.planId);
      if (!p) return;
      const existing = a.logId ? p.log?.find((l) => l.id === a.logId) : undefined;
      setAsk(a);
      setNote(existing?.note ?? '');
      setAmount(existing ? existing.amount : p.target ? 1 : 0);
      touched.current = false;
      window.clearTimeout(timer.current);
      // automatic prompts fade away if ignored; manual ones stay
      if (!a.manual) timer.current = window.setTimeout(() => !touched.current && setAsk(null), 30_000);
    };
    window.addEventListener('lifeos:plan-progress', f);
    return () => (window.removeEventListener('lifeos:plan-progress', f), window.clearTimeout(timer.current));
  }, []);

  if (!ask || !plan) return null;
  const counted = !!plan.target;
  const existing = ask.logId ? plan.log?.find((l) => l.id === ask.logId) : undefined;
  const before = planCount(plan) - (existing?.amount ?? 0);
  const after = before + (counted ? amount : 0);
  const unit = plan.unit ?? '';
  const save = () => {
    if (existing) actions.editPlanLog(plan.id, existing.id, { note, amount: counted ? amount : existing.amount });
    else if (note.trim() || (counted && amount > 0)) actions.logPlan(plan.id, { amount: counted ? amount : 0, note, day: ask.day });
    if (counted && before < plan.target! && after >= plan.target!) void confetti({ particleCount: 90, spread: 80, origin: { x: 0.2, y: 0.8 }, disableForReducedMotion: true });
    setAsk(null);
  };

  return (
    <div className="pn-card" role="dialog" aria-label={L('记录计划进展', 'Log plan progress')} onPointerDown={() => (touched.current = true)}>
      <header>
        <span className="pn-ic">
          <Icon name="calendar" size={16} />
        </span>
        <div>
          <strong>
            {ask.manual ? L('记一笔进展', 'Log progress') : L('计划有进展啦！', 'Your plan moved forward!')}
          </strong>
          <span className="muted small">
            「{plan.title}」{counted && ` · ${after}/${plan.target} ${unit}`}
          </span>
        </div>
        <button className="icon-btn" onClick={() => setAsk(null)} aria-label={L('关闭', 'Close')}>
          <Icon name="x" size={15} />
        </button>
      </header>
      {counted && (
        <div className="pn-amount">
          <span className="muted small">{L('这次', 'This time')}</span>
          <button className="icon-btn" onClick={() => setAmount((a) => Math.max(0, a - 1))} aria-label="−">
            <Icon name="minus" size={14} />
          </button>
          <input
            className="input num"
            type="number"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            aria-label={L('数量', 'Amount')}
          />
          <button className="icon-btn" onClick={() => setAmount((a) => a + 1)} aria-label="+">
            <Icon name="plus" size={14} />
          </button>
          <span className="muted small">{unit}</span>
        </div>
      )}
      <textarea
        className="input"
        rows={2}
        autoFocus={ask.manual}
        value={note}
        placeholder={L('写点细节吧：读了哪本书、看了什么电影、卧推涨了多少……（可选）', 'Add the details: which book, which film, how much your bench went up… (optional)')}
        onChange={(e) => ((touched.current = true), setNote(e.target.value))}
        onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && save()}
      />
      <footer>
        <span className="muted small">{note.trim() ? '+3 XP' : L('写一句会更有回忆', 'A line now = a memory later')}</span>
        <span className="spacer" />
        <Button size="sm" variant="ghost" onClick={() => setAsk(null)}>
          {L('跳过', 'Skip')}
        </Button>
        <Button size="sm" variant="primary" icon="check" onClick={save} disabled={!existing && !note.trim() && !(counted && amount > 0)}>
          {L('记下', 'Save')}
        </Button>
      </footer>
    </div>
  );
}
