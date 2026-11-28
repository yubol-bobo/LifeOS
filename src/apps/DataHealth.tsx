import { useEffect, useState } from 'react';
import { useL, useLang } from '../lib/i18n';
import { notify } from '../os/notify';
import { backupNow, listBackups, storageEstimate, unpack, useStorageStatus, type Backup } from '../store/persist';
import { actions, useStore } from '../store/store';
import type { State } from '../store/types';
import { useSyncStatus } from '../sync/engine';
import { Button, Card, Modal } from '../ui/kit';
import { Icon } from '../ui/Icon';

const mb = (n?: number) => (n == null ? '—' : n < 1_000_000 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1_048_576).toFixed(1)} MB`);

/** Settings → General: where the data lives, whether it's safe, and daily backups you can restore. */
export function DataHealth() {
  const L = useL();
  const lang = useLang();
  const st = useStorageStatus();
  const sync = useSyncStatus();
  const s = useStore((x) => x);
  const [est, setEst] = useState<{ usage?: number; quota?: number }>({});
  const [backups, setBackups] = useState<Backup[]>([]);
  const [confirm, setConfirm] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const reload = () => {
    void storageEstimate().then(setEst);
    void listBackups().then(setBackups);
  };
  useEffect(reload, [st.lastBackup]);
  const t = (ts?: number) => (ts ? new Date(ts).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
  const counts: [string, string, number][] = [
    ['任务', 'Quests', s.quests.length],
    ['专注记录', 'Focus sessions', s.sessions.length],
    ['经验流水', 'XP events', s.events.length],
    ['复盘', 'Reviews', Object.keys(s.reviews).length],
    ['心情', 'Moods', Object.keys(s.moods).length],
    ['论文', 'Papers', s.papers.length],
    ['资产快照', 'Asset check-ins', s.snapshots.length],
  ];
  const ok = !st.error;
  const backendName = st.backend === 'indexeddb' ? 'IndexedDB' : st.backend === 'localstorage' ? 'localStorage' : L('仅内存', 'memory only');

  const restore = async (b: Backup) => {
    setBusy(true);
    try {
      const json = await unpack(b);
      const next = JSON.parse(json) as State;
      if (!next || typeof next !== 'object' || !Array.isArray(next.quests)) throw new Error('bad backup');
      await backupNow(); // keep today's state first, so the restore itself can be undone
      actions.replace(next);
      notify({ title: L(`已恢复到 ${b.day}`, `Restored to ${b.day}`), body: L('恢复前的数据也备份好了，后悔可以再恢复回来。', 'What you had before is backed up too, in case you change your mind.'), icon: 'refresh', tone: 'good' });
      setConfirm(null);
      reload();
    } catch {
      notify({ title: L('恢复失败', 'Restore failed'), body: L('这份备份读不出来。', 'That backup couldn’t be read.'), icon: 'info', tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };
  const download = async (b: Backup) => {
    const json = await unpack(b);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `lifeos-backup-${b.day}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };

  return (
    <Card title={L('数据健康', 'Data health')} icon="shield">
      <div className={`dh-state ${ok ? 'is-ok' : 'is-bad'}`}>
        <Icon name={ok ? 'circle-check' : 'info'} size={16} />
        <span>
          {ok
            ? L(`数据安全保存在这个浏览器（${backendName}）里。`, `Your data is safely saved in this browser (${backendName}).`)
            : L(`最近一次保存失败：${st.error}。请先「导出备份」。`, `The last save failed: ${st.error}. Export a backup now.`)}
        </span>
      </div>
      <ul className="dh-grid">
        <li>
          <span>{L('上次保存', 'Last saved')}</span>
          <b>{t(st.lastSaved)}</b>
        </li>
        <li>
          <span>{L('数据大小', 'Data size')}</span>
          <b>{mb(st.bytes)}</b>
        </li>
        <li>
          <span>{L('浏览器存储', 'Browser storage')}</span>
          <b>{est.quota ? `${mb(est.usage)} / ${mb(est.quota)}` : '—'}</b>
        </li>
        <li>
          <span>{L('防止被浏览器清理', 'Protected from eviction')}</span>
          <b>{st.persisted == null ? '—' : st.persisted ? L('是', 'Yes') : L('否（浏览器没同意）', 'No (browser declined)')}</b>
        </li>
        <li>
          <span>{L('多设备同步', 'Sync')}</span>
          <b>{sync.state === 'off' ? L('未开启', 'Off') : sync.state === 'error' ? L('出错了', 'Error') : L(`上次 ${t(sync.lastSync)}`, `Last ${t(sync.lastSync)}`)}</b>
        </li>
        <li>
          <span>{L('上次自动备份', 'Last auto backup')}</span>
          <b>{st.lastBackup ?? backups[0]?.day ?? '—'}</b>
        </li>
      </ul>
      <p className="muted small dh-counts">{counts.map(([zh, en, n]) => `${L(zh, en)} ${n}`).join(' · ')}</p>
      {sync.state === 'off' && <p className="small dh-tip">{L('提示：只存在一个浏览器里的数据，清理浏览器就没了。建议打开「同步」（加密存到你自己的 Gist），并定期导出备份。', 'Tip: data kept in a single browser disappears if the browser data is cleared. Turn on Sync (encrypted into your own Gist) and export backups now and then.')}</p>}

      <h4 className="dh-h">
        <Icon name="clock" size={14} /> {L('每日自动备份（保留 30 天）', 'Daily backups (kept 30 days)')}
      </h4>
      {backups.length ? (
        <ul className="dh-backups">
          {backups.map((b) => (
            <li key={b.day}>
              <b className="num">{b.day}</b>
              <span className="muted small">
                {t(b.at)} · {mb(b.size * 2)}
              </span>
              <span className="spacer" />
              <Button size="sm" variant="ghost" icon="download" onClick={() => void download(b)}>
                {L('下载', 'Download')}
              </Button>
              <Button size="sm" variant="ghost" icon="refresh" onClick={() => setConfirm(b)}>
                {L('恢复到这天', 'Restore')}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">{L('今天第一次保存后会自动生成第一份备份。', 'The first backup is made after today’s first save.')}</p>
      )}

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={L('恢复备份？', 'Restore this backup?')}
        footer={
          <>
            <span className="spacer" />
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {L('取消', 'Cancel')}
            </Button>
            <Button variant="primary" icon="refresh" disabled={busy} onClick={() => confirm && void restore(confirm)}>
              {L('恢复', 'Restore')}
            </Button>
          </>
        }
      >
        <p>{L(`会把所有数据换成 ${confirm?.day} 那天的样子。恢复前，现在的数据会先自动备份一份。`, `Everything goes back to how it was on ${confirm?.day}. Your current data is backed up first.`)}</p>
        <p className="muted small">{L('开着同步的话，恢复后的数据也会同步到其他设备。', 'With Sync on, the restored data syncs to your other devices too.')}</p>
      </Modal>
    </Card>
  );
}
