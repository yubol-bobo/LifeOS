import { useL } from '../lib/i18n';
import { DEEP_FOCUS, deepRate } from '../store/rules';

/** While a timer runs: how deep this stretch is, or how far to the next deep-focus bonus. */
export function DeepHint({ run }: { run: number }) {
  const L = useL();
  const min = Math.floor(run / 60_000);
  const rate = deepRate(min);
  const next = [...DEEP_FOCUS].reverse().find(([m]) => m > min);
  if (!rate && (!next || next[0] - min > 20)) return null; // nothing to say yet
  const toNext = next ? next[0] - min : 0;
  return (
    <span className={`deep-hint ${rate ? 'is-on' : ''}`} title={L('不中断地专注：满 1 小时 +10%，满 2 小时 +20%，满 3 小时 +30%（暂停或切换任务会重新计）', 'Uninterrupted focus: +10% from 1 h, +20% from 2 h, +30% from 3 h (a pause or switch starts a new stretch)')}>
      {rate ? L(`🔥 深度专注 +${Math.round(rate * 100)}%`, `🔥 Deep focus +${Math.round(rate * 100)}%`) : null}
      {next && toNext <= 20 ? L(`${rate ? ' · ' : ''}再 ${toNext} 分钟 +${Math.round(next[1] * 100)}%`, `${rate ? ' · ' : ''}${toNext} min to +${Math.round(next[1] * 100)}%`) : null}
    </span>
  );
}
