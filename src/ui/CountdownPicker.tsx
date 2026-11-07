import { useState, useSyncExternalStore } from 'react';
import { useL, useLang } from '../lib/i18n';
import { fmtMinutes, getNextCountdown, setNextCountdown, subscribeNextCountdown } from '../lib/nextCountdown';

export const useNextCountdown = () => useSyncExternalStore(subscribeNextCountdown, getNextCountdown);

/**
 * Pick the countdown the next session starts with. +15 / +30 / +1h stack (3 × +1h = 3 hours);
 * 0 = count up. When it reaches zero the session is settled automatically.
 */
export function CountdownPicker({ compact = false }: { compact?: boolean }) {
  const L = useL();
  const zh = useLang() === 'zh';
  const min = useNextCountdown();
  const [custom, setCustom] = useState(false);
  return (
    <div className={`cd-pick ${compact ? 'is-compact' : ''}`}>
      <span className="cd-val">
        <span className="muted small">{L('倒计时', 'Countdown')}</span>
        <b className="num">{min ? fmtMinutes(min, zh) : L('不设（正计时）', 'Off (count up)')}</b>
      </span>
      <span className="cd-btns" role="group" aria-label={L('增加倒计时', 'Add to the countdown')}>
        {[15, 30, 60].map((m) => (
          <button key={m} type="button" className="chip" onClick={() => setNextCountdown(min + m)}>
            +{m === 60 ? L('1 小时', '1 h') : L(`${m} 分`, `${m} min`)}
          </button>
        ))}
        {custom ? (
          <span className="countdown-custom">
            <input className="input" type="number" min={1} max={1440} autoFocus value={min || ''} placeholder="90" onChange={(e) => setNextCountdown(+e.target.value || 0)} onBlur={() => setCustom(false)} aria-label={L('分钟', 'Minutes')} />
            {L('分钟', 'min')}
          </span>
        ) : (
          <button type="button" className="chip" onClick={() => setCustom(true)}>
            {L('自定义', 'Custom')}
          </button>
        )}
        {min > 0 && (
          <button type="button" className="chip chip-edit" onClick={() => setNextCountdown(0)}>
            {L('清零', 'Clear')}
          </button>
        )}
      </span>
      {!compact && <span className="muted small cd-hint">{L('可以叠加：点 3 次 +1 小时就是 3 小时。时间到了自动结束并记录（赚钱的自动结算）。', 'They stack: 3 × +1 h = 3 hours. When it runs out the session ends and is logged (paid work is cashed out) automatically.')}</span>}
    </div>
  );
}
