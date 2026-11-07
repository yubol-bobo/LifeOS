import { useEffect, useRef, useState } from 'react';
import { fmtMinutes } from '../lib/nextCountdown';
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

/** Watches the running focus session; when its countdown runs out it settles the session automatically
 *  (logs it; paid work is cashed out) and celebrates — wherever you are in LifeOS. */
export function FocusCelebrate() {
  const L = useL();
  const live = useLiveSession(500);
  const cur = useStore((s) => s.profile.currency);
  const parked = useStore((s) => s.parked ?? []);
  const busy = useRef(false);
  type Done = { note: string; min: number; ms: number; earned: number; paid: boolean; again: { rate: number; attr: string; note: string; projectId?: string; goalId?: string; questId?: string } };
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    if (!live || live.paused || live.target == null || live.ms < live.target || busy.current) return;
    busy.current = true;
    const a = live.active;
    const s = actions.stopFocus(true, { capToTarget: true });
    busy.current = false;
    const note = a.note || getState().projects.find((p) => p.id === a.projectId)?.name || (a.rate > 0 ? L('赚钱的工作', 'Paid work') : L('专注', 'Focus'));
    const ms = s?.activeMs ?? a.targetMin! * 60_000;
    setDone({ note, min: a.targetMin!, ms, earned: s?.earned ?? 0, paid: a.rate > 0, again: { rate: a.rate, attr: a.attr, note: a.note, projectId: a.projectId, goalId: a.goalId, questId: a.questId } });
    fireworks();
    const pet = getState().pet;
    if (pet.sound) chime('done');
    if (pet.sysNotify) sysNotify(L('专注完成！', 'Focus complete!'), `${note} · ${a.targetMin} min`);
    notify({ title: a.rate > 0 ? L('倒计时结束，已自动结算 🎉', 'Countdown done — cashed out 🎉') : L('倒计时结束，已自动记录 🎉', 'Countdown done — logged 🎉'), body: `${note} · ${a.targetMin} ${L('分钟', 'min')}`, tone: 'gold', icon: 'trophy' });
  }, [live?.ms]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!done) return null;
  const xp = Math.round(done.ms / 60_000) + Math.max(5, Math.round(done.min / 5));
  const close = () => setDone(null);
  const again = (min: number) => {
    const g = done.again;
    actions.startFocus(g.rate, g.attr, g.note, { projectId: g.projectId, goalId: g.goalId, questId: g.questId, targetMin: min });
    close();
  };
  const p0 = parked[0];
  return (
    <div className="fc-scrim" onClick={close}>
      <div className="fc-card" role="dialog" aria-label={L('专注完成', 'Focus complete')} onClick={(e) => e.stopPropagation()}>
        <div className="fc-badge">
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r="52" className="fc-ring" />
          </svg>
          <Icon name="trophy" size={44} />
        </div>
        <p className="eyebrow">{done.paid ? L('倒计时结束 · 已自动结算', 'Countdown complete · cashed out') : L('倒计时结束 · 已自动记录', 'Countdown complete · logged')}</p>
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
              <b>📂</b> {L('项目时间也算数', 'Project time counts too')}
            </span>
          )}
        </div>
        <div className="fc-actions">
          <Button variant="primary" size="lg" icon="check" onClick={close}>
            {L('好的', 'Done')}
          </Button>
          <Button size="lg" icon="refresh" onClick={() => again(done.min)}>
            {L(`再来一轮 · ${fmtMinutes(done.min, true)}`, `Another round · ${fmtMinutes(done.min, false)}`)}
          </Button>
          <Button size="lg" icon="plus" onClick={() => again(15)}>
            {L('再专注 15 分钟', '15 more minutes')}
          </Button>
          {p0 && (
            <Button variant="ghost" icon="play" onClick={() => (actions.resumeParked(0), close())}>
              {L(`恢复暂停的「${p0.note || '专注'}」`, `Resume “${p0.note || 'Focus'}”`)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
