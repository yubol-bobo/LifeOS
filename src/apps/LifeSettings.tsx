import { useEffect, useState } from 'react';
import { lifeProgress } from '../lib/date';
import { useL } from '../lib/i18n';
import { actions, useStore } from '../store/store';
import { Button, Field, Modal } from '../ui/kit';

/** Number input that only clamps when you're done typing (so "90" can be typed). */
export function ExpectancyInput() {
  const L = useL();
  const v = useStore((s) => s.profile.lifeExpectancy);
  const [draft, setDraft] = useState(String(v));
  useEffect(() => setDraft(String(v)), [v]);
  const commit = () => {
    const n = Math.round(Number(draft));
    const next = Number.isFinite(n) && n > 0 ? Math.max(30, Math.min(120, n)) : v;
    setDraft(String(next));
    if (next !== v) actions.profile({ lifeExpectancy: next });
  };
  return (
    <input
      className="input"
      type="number"
      inputMode="numeric"
      min={30}
      max={120}
      value={draft}
      aria-label={L('预期寿命（年）', 'Life expectancy (years)')}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  );
}

/** Quick editor for the numbers behind "Life progress" and "Life in weeks". */
export function LifeSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const L = useL();
  const p = useStore((s) => s.profile);
  const lp = lifeProgress(p.birthDate, p.lifeExpectancy);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={L('人生进度设置', 'Life progress settings')}
      width={460}
      footer={
        <>
          <span className="spacer" />
          <Button variant="primary" onClick={onClose}>
            {L('完成', 'Done')}
          </Button>
        </>
      }
    >
      <div className="form">
        <Field label={L('出生日期', 'Birth date')}>
          <input className="input" type="date" value={p.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => e.target.value && actions.profile({ birthDate: e.target.value })} />
        </Field>
        <Field label={L('预期寿命（年）', 'Life expectancy (years)')} hint={L('30–120 岁。只用来画进度条和人生周格。', '30–120. Only used for the progress bar and the life-in-weeks grid.')}>
          <div className="life-exp">
            <ExpectancyInput />
            <div className="row-gap wrap">
              {[75, 80, 85, 90, 100].map((n) => (
                <button key={n} type="button" className={`chip ${p.lifeExpectancy === n ? 'is-active' : ''}`} onClick={() => actions.profile({ lifeExpectancy: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </Field>
        <p className="life-preview">
          {L(
            `${lp.age.toFixed(1)} 岁 · 已度过 ${lp.weeksLived.toLocaleString()} 周 · 人生进度 ${(lp.life * 100).toFixed(1)}%`,
            `Age ${lp.age.toFixed(1)} · ${lp.weeksLived.toLocaleString()} weeks lived · ${(lp.life * 100).toFixed(1)}% of life`,
          )}
        </p>
      </div>
    </Modal>
  );
}
