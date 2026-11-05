import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { duration, money } from '../lib/format';
import { useL } from '../lib/i18n';
import { chime, sysNotify } from '../pet/sound';
import { actions, getState, useStore } from '../store/store';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/kit';
import { useLiveSession } from './live';
import { notify } from './notify';

/** Fireworks from both sides, then a shower from the top. */
function fireworks() {
  const colors = ['#FF6A3D', '#FFD166', '#1BA677', '#7A5AE6', '#3F7BE0', '#E2689A'];
  const end = Date.now() + 1600;
  const side = () => {
    void confetti({ particleCount: 7, angle: 60, spread: 70, startVelocity: 62, origin: { x: 0, y: 0.75 }, colors, disableForReducedMotion: true });
    void confetti({ particleCount: 7, angle: 120, spread: 70, startVelocity: 62, origin: { x: 1, y: 0.75 }, colors, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(side);
  };
  side();
  window.setTimeout(() => void confetti({ particleCount: 160, spread: 160, startVelocity: 36, gravity: 0.8, scalar: 1.1, origin: { x: 0.5, y: 0.1 }, colors, shapes: ['star', 'circle'], disableForReducedMotion: true }), 900);
}

/** Watches the running focus session; when its countdown runs out, celebrates — wherever you are in LifeOS. */
export function FocusCelebrate() {
  const L = useL();
  const live = useLiveSession(500);
  const cur = useStore((s) => s.profile.currency);
  const [done, setDone] = useState<null | { note: string; min: number; ms: number; earned: number; paid: boolean }>(null);

  useEffect(() => {
    if (!live || live.paused || live.target == null || live.active.hit || live.ms < live.target) return;
    actions.updateActive({ hit: true });
    const note = live.active.note || L('专注', 'Focus');
    setDone({ note, min: live.active.targetMin!, ms: live.ms, earned: live.earned, paid: live.paid });
    fireworks();
    const pet = getState().pet;
    if (pet.sound) chime('done');
    if (pet.sysNotify) sysNotify(L('专注完成！', 'Focus complete!'), `${note} · ${live.active.targetMin} min`);
    notify({ title: L('专注完成 🎉', 'Focus complete 🎉'), body: `${note} · ${live.active.targetMin} ${L('分钟', 'min')}`, tone: 'gold', icon: 'trophy' });
  }, [live?.ms]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!done) return null;
  const xp = Math.round(done.ms / 60_000) + Math.max(5, Math.round(done.min / 5));
  const close = () => setDone(null);
  return (
    <div className="fc-scrim" onClick={close}>
      <div className="fc-card" role="dialog" aria-label={L('专注完成', 'Focus complete')} onClick={(e) => e.stopPropagation()}>
        <div className="fc-badge">
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r="52" className="fc-ring" />
          </svg>
          <Icon name="trophy" size={44} />
        </div>
        <p className="eyebrow">{L('倒计时结束', 'Countdown complete')}</p>
        <h2>{L('专注完成！', 'You did it!')}</h2>
        <p className="fc-what">
          <b>{done.note}</b> · {duration(done.ms)}
        </p>
        <div className="fc-stats">
          <span>
            <b className="num">+{xp}</b> XP
          </span>
          {done.paid ? (
            <span>
              <b className="num">{money(done.earned, cur)}</b> {L('入账', 'earned')}
            </span>
          ) : (
            <span>
              <b>🌱</b> {L('不为钱的努力也算数', 'Effort counts, paid or not')}
            </span>
          )}
        </div>
        <div className="fc-actions">
          <Button variant="primary" size="lg" icon="check" onClick={() => (actions.stopFocus(), close())}>
            {done.paid ? L('结束并结算', 'Stop & cash out') : L('结束并记录', 'Stop & log it')}
          </Button>
          <Button size="lg" icon="plus" onClick={() => (actions.extendFocus(15), close())}>
            {L('再来 15 分钟', '15 more minutes')}
          </Button>
          <Button variant="ghost" onClick={close}>
            {L('继续计时', 'Keep the clock running')}
          </Button>
        </div>
      </div>
    </div>
  );
}
