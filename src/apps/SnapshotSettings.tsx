import { useEffect, useState } from 'react';
import { parseDay } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
import { notify } from '../os/notify';
import { deleteSnap, downloadSnap, listSnaps, onSnapsChanged, setSnapConfig, snapNow, useSnapConfig, type Snap } from '../os/snapshot';
import { Button, Card, Field, Modal } from '../ui/kit';

/** Settings → General: daily dashboard snapshots, plus the saved ones. */
export function SnapshotSettings() {
  const L = useL();
  const lang = useLang();
  const c = useSnapConfig();
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [view, setView] = useState<Snap | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const load = () => void listSnaps().then(setSnaps).catch(() => setSnaps([]));
    load();
    return onSnapsChanged(load);
  }, []);
  const urls = useObjectUrls(snaps);
  const dateOf = (s: Snap) => parseDay(s.day).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', day: 'numeric', weekday: 'short' });
  const timeOf = (s: Snap) => new Date(s.ts).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const takeNow = async () => {
    setBusy(true);
    const s = await snapNow();
    setBusy(false);
    notify(s ? { title: L('已保存今天的仪表盘快照', 'Saved today’s dashboard snapshot'), body: timeOf(s), icon: 'camera', tone: 'good' } : { title: L('没拍成功', 'Couldn’t take the snapshot'), body: L('请稍后再试一次。', 'Please try again in a moment.'), icon: 'camera', tone: 'info' });
  };

  return (
    <Card title={L('每日仪表盘快照', 'Daily dashboard snapshot')} icon="camera">
      <p className="muted small">
        {L(
          '每天到了设定的时间，自动给桌面仪表盘拍一张图，存在这个浏览器里（不会同步、不会上传）。之后每次离开页面（切走标签页、最小化、关掉）还会更新当天这张，所以当天最后的样子都会留下来，忘了 12 点前回来看也没关系。LifeOS 要开着才能拍（放在后台标签页里也行）。',
          'At the set time each day, LifeOS takes a picture of the desktop dashboard and keeps it in this browser (never synced or uploaded). Each time you leave the page after that (switch tabs, minimise, close), today’s picture is refreshed, so the day’s final state is kept even if you don’t come back before midnight. LifeOS needs to be open to take it (a background tab is fine).',
        )}
      </p>
      <div className="toggle-list">
        <button className={`toggle-row ${c.enabled ? 'is-on' : ''}`} role="switch" aria-checked={c.enabled} onClick={() => setSnapConfig({ enabled: !c.enabled })}>
          <span>{L('每天自动拍一张', 'Take one automatically every day')}</span>
          <i className="switch" />
        </button>
        <button className={`toggle-row ${c.download ? 'is-on' : ''}`} role="switch" aria-checked={c.download} disabled={!c.enabled} onClick={() => setSnapConfig({ download: !c.download })}>
          <span>
            {L('同时下载到电脑', 'Also download it to this computer')}
            <small className="muted"> {L('（每天一张，存到「下载」文件夹）', '(one a day, into Downloads)')}</small>
          </span>
          <i className="switch" />
        </button>
      </div>
      <div className="row2">
        <Field label={L('每天几点拍', 'Time')} hint={L('晚一点比较好，比如 23:50。', 'Late is best, e.g. 23:50.')}>
          <input className="input" type="time" value={c.time} disabled={!c.enabled} onChange={(e) => e.target.value && setSnapConfig({ time: e.target.value })} />
        </Field>
        <Field label={L('保留几天', 'Keep')}>
          <select className="input" value={c.keep} onChange={(e) => setSnapConfig({ keep: +e.target.value })}>
            {[30, 90, 180, 365].map((n) => (
              <option key={n} value={n}>
                {L(`最近 ${n} 天`, `Last ${n} days`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="row-gap wrap">
        <Button icon="camera" disabled={busy} onClick={() => void takeNow()}>
          {busy ? L('正在拍…', 'Taking…') : L('现在拍一张', 'Take one now')}
        </Button>
      </div>
      {snaps.length > 0 && (
        <ul className="snap-grid">
          {snaps.map((s) => (
            <li key={s.day}>
              <button type="button" className="snap-thumb" onClick={() => setView(s)} title={L('查看大图', 'View')}>
                {urls[s.day] && <img src={urls[s.day]} alt={dateOf(s)} loading="lazy" />}
              </button>
              <span className="snap-meta">
                <b>{dateOf(s)}</b>
                <span className="muted small num">{timeOf(s)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={!!view}
        onClose={() => setView(null)}
        width={1200}
        title={view ? `${dateOf(view)} · ${timeOf(view)}` : ''}
        footer={
          view && (
            <>
              <Button variant="danger" icon="trash" onClick={() => (void deleteSnap(view.day), setView(null))}>
                {L('删除', 'Delete')}
              </Button>
              <span className="spacer" />
              <Button variant="primary" icon="download" onClick={() => downloadSnap(view)}>
                {L('下载', 'Download')}
              </Button>
            </>
          )
        }
      >
        {view && urls[view.day] && <img className="snap-full" src={urls[view.day]} alt="" />}
      </Modal>
    </Card>
  );
}

/** Object URLs for the thumbnails, released when they change. */
function useObjectUrls(snaps: Snap[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const s of snaps) next[s.day] = URL.createObjectURL(s.blob);
    setUrls(next);
    return () => Object.values(next).forEach((u) => URL.revokeObjectURL(u));
  }, [snaps]);
  return urls;
}
