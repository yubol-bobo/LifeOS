import { useState } from 'react';
import { useL } from '../lib/i18n';
import { notify } from '../os/notify';
import { connect, defaultDeviceName, disconnect, renameDevice, syncNow, useSyncStatus, type ConnectResult } from '../sync/engine';
import { Icon } from '../ui/Icon';
import { Button, Card, Field, Modal } from '../ui/kit';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=LifeOS%20sync';

export function ago(ts: number | undefined, L: (zh: string, en: string) => string) {
  if (!ts) return L('从未', 'never');
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return L('刚刚', 'just now');
  const m = Math.round(s / 60);
  if (m < 60) return L(`${m} 分钟前`, `${m} min ago`);
  const h = Math.round(m / 60);
  return h < 48 ? L(`${h} 小时前`, `${h} h ago`) : L(`${Math.round(h / 24)} 天前`, `${Math.round(h / 24)} d ago`);
}

export function errorText(e: string | undefined, L: (zh: string, en: string) => string) {
  if (!e) return '';
  if (e === 'wrong-password') return L('同步密码不对：云端数据无法解密。请输入第一次设置时用的密码。', 'Wrong sync password — the cloud copy can’t be decrypted. Use the password you set first.');
  if (/invalid|expired/i.test(e)) return L('GitHub token 无效或已过期，请重新生成。', 'GitHub token is invalid or expired — create a new one.');
  if (/scope|not found/i.test(e)) return L('找不到同步文件，或 token 没有 gist 权限。', 'Sync file not found, or the token lacks the gist scope.');
  return L(`同步出错：${e}`, `Sync error: ${e}`);
}

/** Connect form, usable from Settings and from the first-run setup. */
export function SyncConnect({ onDone }: { onDone?: () => void }) {
  const L = useL();
  const [token, setToken] = useState('');
  const [pass, setPass] = useState('');
  const [device, setDevice] = useState(defaultDeviceName());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [choose, setChoose] = useState(false);

  const go = async (mode?: 'cloud' | 'merge') => {
    setBusy(true);
    setErr('');
    try {
      const r: ConnectResult = await connect({ token, pass, device }, mode);
      if (r === 'choose') {
        setChoose(true);
        return;
      }
      setChoose(false);
      notify({ title: r === 'created' ? L('已开启同步', 'Sync is on') : L('已连接到你的其他设备', 'Connected to your other devices'), body: r === 'created' ? L('在其他设备上用同一个 token 和同步密码连接即可。', 'Connect other devices with the same token and sync password.') : L('数据已同步到这台设备。', 'Your data is now on this device.'), icon: 'cloud-check', tone: 'good' });
      onDone?.();
    } catch (e) {
      setErr(errorText((e as Error).message === 'wrong password' ? 'wrong-password' : (e as Error).message, L));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form">
      <ol className="sync-steps">
        <li>
          {L('创建一个只有 gist 权限的 GitHub token：', 'Create a GitHub token with only the gist scope: ')}
          <a href={TOKEN_URL} target="_blank" rel="noreferrer">
            {L('一键打开创建页面', 'open the creation page')} <Icon name="external" size={12} />
          </a>
          <span className="muted small">{L('（权限只勾 gist，可设置过期时间）', ' (tick only “gist”; an expiry is fine)')}</span>
        </li>
        <li>{L('设置一个同步密码——所有设备都用同一个。它只保存在你的设备上，用来加密数据。', 'Pick a sync password — the same on every device. It stays on your devices and encrypts your data.')}</li>
      </ol>
      <Field label="GitHub token">
        <input className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_…" />
      </Field>
      <div className="row2">
        <Field label={L('同步密码', 'Sync password')} hint={L('忘记就无法解密云端数据，请务必记好。', 'If forgotten, the cloud copy can’t be decrypted.')}>
          <input className="input" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </Field>
        <Field label={L('这台设备的名字', 'This device')}>
          <input className="input" value={device} onChange={(e) => setDevice(e.target.value)} />
        </Field>
      </div>
      {err && <p className="error">{err}</p>}
      <Button variant="primary" icon="cloud" disabled={busy || token.trim().length < 10 || pass.length < 6} onClick={() => go()}>
        {busy ? L('连接中…', 'Connecting…') : L('连接并同步', 'Connect & sync')}
      </Button>
      {pass.length > 0 && pass.length < 6 && <p className="muted small">{L('同步密码至少 6 位。', 'Use at least 6 characters.')}</p>}
      <Modal
        open={choose}
        onClose={() => setChoose(false)}
        title={L('云端已经有数据了', 'There’s already data in the cloud')}
        footer={
          <>
            <span className="spacer" />
            <Button disabled={busy} onClick={() => go('merge')}>
              {L('合并两边', 'Merge both')}
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => go('cloud')}>
              {L('使用云端数据', 'Use the cloud copy')}
            </Button>
          </>
        }
      >
        <p>{L('这台设备上也有记录。你可以用云端的数据替换本机（推荐：新设备），或者把两边合并在一起（同一项设置以云端为准）。', 'This device also has data. Replace it with the cloud copy (recommended for a new device), or merge both (cloud wins where the same setting differs).')}</p>
      </Modal>
    </div>
  );
}

export function SyncSettings() {
  const L = useL();
  const st = useSyncStatus();
  const [name, setName] = useState(st.device ?? '');
  if (st.state === 'off')
    return (
      <div className="grid-1-1">
        <Card title={L('多设备同步', 'Multi-device sync')} icon="cloud">
          <p className="muted small" style={{ marginBottom: 14 }}>
            {L('数据会端到端加密后保存在你自己 GitHub 账号下的一个私密 Gist 里。电脑、手机都连上后，任何一边的改动都会自动出现在另一边。', 'Your data is end-to-end encrypted and stored in a secret Gist on your own GitHub account. Connect your laptop and phone and changes flow between them automatically.')}
          </p>
          <SyncConnect />
        </Card>
        <Card title={L('它是怎么工作的', 'How it works')} icon="shield">
          <ul className="sync-facts">
            <li>
              <Icon name="key" size={15} />
              <span>{L('加密在浏览器里完成（AES-256-GCM），GitHub 只存密文；同步密码从不上传。', 'Encrypted in your browser (AES-256-GCM); GitHub only stores ciphertext. Your sync password never leaves your devices.')}</span>
            </li>
            <li>
              <Icon name="refresh" size={15} />
              <span>{L('打开页面、切回标签页、每分钟、以及每次修改后几秒，都会自动同步。', 'Syncs on open, when you return to the tab, every minute, and a few seconds after each change.')}</span>
            </li>
            <li>
              <Icon name="list-checks" size={15} />
              <span>{L('按每一项记录合并：两台设备各自改了不同的东西，都会保留；只有同一项被两边同时改时，才以较新的为准。删除也会同步。', 'Merged item by item: different edits on two devices are both kept; only the very same item edited on both is decided by recency. Deletions sync too.')}</span>
            </li>
            <li>
              <Icon name="phone" size={15} />
              <span>{L('新设备：打开网站 → 设置助手里选「从其他设备同步」，填同一个 token 和同步密码即可。', 'New device: open the site → choose “Sync from another device” in setup and enter the same token and password.')}</span>
            </li>
          </ul>
        </Card>
      </div>
    );
  return (
    <div className="grid-1-1">
      <Card title={L('多设备同步', 'Multi-device sync')} icon="cloud-check" action={<span className={`sync-pill is-${st.state}`}>{st.state === 'syncing' ? L('同步中…', 'Syncing…') : st.state === 'error' ? L('出错', 'Error') : L('已开启', 'On')}</span>}>
        <dl className="sync-dl">
          <dt>{L('上次同步', 'Last sync')}</dt>
          <dd>{ago(st.lastSync, L)}</dd>
          <dt>{L('云端版本', 'Cloud revision')}</dt>
          <dd className="num">{st.rev ?? '—'}</dd>
          <dt>{L('最近写入的设备', 'Last written by')}</dt>
          <dd>{st.lastDevice ?? '—'}</dd>
          <dt>Gist</dt>
          <dd>
            {st.gistId ? (
              <a href={`https://gist.github.com/${st.gistId}`} target="_blank" rel="noreferrer">
                {st.gistId.slice(0, 8)}… <Icon name="external" size={12} />
              </a>
            ) : (
              '—'
            )}
          </dd>
        </dl>
        {st.state === 'error' && <p className="error">{errorText(st.error, L)}</p>}
        <div className="row-gap wrap" style={{ marginTop: 14 }}>
          <Button variant="primary" icon="refresh" disabled={st.state === 'syncing'} onClick={() => void syncNow()}>
            {L('立即同步', 'Sync now')}
          </Button>
          <Button variant="ghost" icon="unplug" onClick={disconnect}>
            {L('断开这台设备', 'Disconnect this device')}
          </Button>
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          {L('断开只会停止同步并从本机删除 token，本机和云端的数据都会保留。', 'Disconnecting stops syncing and removes the token from this device; data stays both here and in the cloud.')}
        </p>
      </Card>
      <Card title={L('这台设备', 'This device')} icon="laptop">
        <Field label={L('名字', 'Name')}>
          <div className="input-group">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            <Button disabled={!name.trim() || name === st.device} onClick={() => renameDevice(name.trim())}>
              {L('保存', 'Save')}
            </Button>
          </div>
        </Field>
      </Card>
    </div>
  );
}
