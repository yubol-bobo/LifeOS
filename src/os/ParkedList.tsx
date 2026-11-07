import { duration } from '../lib/format';
import { useL } from '../lib/i18n';
import { actions, useStore } from '../store/store';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/kit';
import { activeMs } from './live';
import { notify } from './notify';

/** Sessions you paused and set aside to do something else — resume, finish (log) or discard them. */
export function ParkedList() {
  const L = useL();
  const parked = useStore((s) => s.parked ?? []);
  const projects = useStore((s) => s.projects);
  if (!parked.length) return null;
  const nameOf = (i: number) => parked[i].note || projects.find((p) => p.id === parked[i].projectId)?.name || (parked[i].rate > 0 ? L('赚钱的工作', 'Paid work') : L('专注', 'Focus'));
  return (
    <section className="parked">
      <p className="muted small parked-h">
        <Icon name="pause" size={12} /> {L('暂停中的任务（随时可以恢复）', 'Paused — resume any time')}
      </p>
      <ul>
        {parked.map((a, i) => {
          const ms = activeMs(a);
          const left = a.targetMin ? Math.max(0, a.targetMin * 60_000 - ms) : null;
          return (
            <li key={`${a.start}-${i}`}>
              <span className={`parked-dot ${a.rate > 0 ? 'is-paid' : ''}`} />
              <span className="parked-name">
                <b>{nameOf(i)}</b>
                <span className="muted small num">
                  {a.rate > 0 ? L('赚钱', 'Paid') : L('项目', 'Project')} · {duration(ms)}
                  {left != null ? L(` · 倒计时还剩 ${duration(left)}`, ` · ${duration(left)} left`) : ''}
                </span>
              </span>
              <Button size="sm" variant="primary" icon="play" onClick={() => actions.resumeParked(i)}>
                {L('恢复', 'Resume')}
              </Button>
              <Button
                size="sm"
                icon="square"
                title={L('结束并记录', 'Stop & log')}
                onClick={() => {
                  const name = nameOf(i);
                  const s = actions.stopParked(i);
                  notify({ title: s ? L('已记录', 'Logged') : L('不足 1 分钟，未记录', 'Under a minute — not logged'), body: s ? `${name} · ${duration(s.activeMs)}` : undefined, icon: 'check', tone: s ? 'good' : 'info' });
                }}
              >
                {L('结束', 'Stop')}
              </Button>
              <Button size="sm" variant="ghost" icon="trash" title={L('丢弃', 'Discard')} onClick={() => actions.stopParked(i, false)} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
