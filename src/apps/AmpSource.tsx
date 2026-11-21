import { useEffect, useState } from 'react';
import { money } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { AmpError, ampDeviceReady, ampRefresh, ampRemembered, ampUnlock, defaultVaultUrl, forgetAmp } from '../lib/amp';
import { notify } from '../os/notify';
import { actions, useStore } from '../store/store';
import { Button, Card, Field, Segmented } from '../ui/kit';

let refreshing: Promise<unknown> | null = null;

/** Quietly refresh from Asset Management Pro when the remembered secret is there and the data is a few hours old. */
export function autoRefreshAmp(state: { assets: { source?: string; amp?: { url?: string; syncedAt?: number } } }) {
  const a = state.assets;
  if (a.source !== 'amp' || refreshing) return;
  if (a.amp?.syncedAt && Date.now() - a.amp.syncedAt < 6 * 3_600_000) return;
  const url = a.amp?.url || defaultVaultUrl();
  refreshing = ampRefresh(url)
    .then((imp) => actions.importAmp(imp, a.amp?.url))
    .catch(() => {})
    .finally(() => (refreshing = null));
}

/** Assets → where net worth comes from: your own check-ins, or Asset Management Pro. */
export function AmpSource() {
  const L = useL();
  const lang = useLang();
  const assets = useStore((s) => s.assets);
  const amp = assets.source === 'amp';
  const [device, setDevice] = useState<boolean | null>(null);
  const [remembered, setRemembered] = useState(false);
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(amp);
  const url = assets.amp?.url || defaultVaultUrl();
  useEffect(() => {
    void ampDeviceReady().then(setDevice);
    void ampRemembered().then(setRemembered);
  }, []);

  const why = (e: unknown) => {
    const c = e instanceof AmpError ? e.code : 'bad-vault';
    return c === 'wrong-code'
      ? L('解锁码不对。', 'That unlock code didn’t work.')
      : c === 'no-device'
        ? L('这个浏览器里没有 Asset Management Pro 的设备密钥：先打开它，导入设备密钥并勾选「记住」。', 'This browser has no Asset Management Pro device key: open it once, import the device key and tick “remember”.')
        : c === 'no-vault'
          ? L('取不到加密数据（vault.bin），检查网络或地址。', 'Couldn’t fetch the encrypted data (vault.bin); check the network or address.')
          : c === 'no-memory'
            ? L('需要再输入一次解锁码。', 'Enter the unlock code again.')
            : L('数据格式不认识。', 'Unrecognised data.');
  };
  const done = (imp: { total: number; asOf: string; accounts: unknown[] }) => {
    notify({ title: L('已从 Asset Management Pro 同步', 'Synced from Asset Management Pro'), body: L(`${imp.accounts.length} 个账户 · 净资产 ${money(imp.total, 'USD', 0)} · 截至 ${imp.asOf}`, `${imp.accounts.length} accounts · net worth ${money(imp.total, 'USD', 0)} · as of ${imp.asOf}`), icon: 'landmark', tone: 'good' });
  };
  const unlock = async () => {
    if (!/^\d{8}$/.test(pin)) return setErr(L('解锁码是 8 位数字。', 'The unlock code is 8 digits.'));
    setBusy(true);
    setErr('');
    try {
      const imp = await ampUnlock(url, pin, remember);
      setPin('');
      actions.importAmp(imp, assets.amp?.url);
      if (assets.base !== 'USD') actions.setAssets({ base: 'USD' });
      setRemembered(remember);
      done(imp);
    } catch (e) {
      setErr(why(e));
    } finally {
      setBusy(false);
    }
  };
  const refresh = async () => {
    setBusy(true);
    setErr('');
    try {
      const imp = await ampRefresh(url);
      actions.importAmp(imp, assets.amp?.url);
      done(imp);
    } catch (e) {
      setErr(why(e));
      if (e instanceof AmpError && e.code === 'no-memory') setRemembered(false);
    } finally {
      setBusy(false);
    }
  };
  const synced = assets.amp?.syncedAt ? new Date(assets.amp.syncedAt).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

  // Only offered where it can work: AMP's device key is in this browser, or it's already in use.
  if (!amp && device === false && !open) return null;
  if (!amp && !open)
    return (
      <div className="banner amp-offer">
        <span>{L('检测到这个浏览器里有 Asset Management Pro：可以直接用它的账户和净资产，不用再手动记录。', 'Asset Management Pro is set up in this browser: use its accounts and net worth instead of checking in by hand.')}</span>
        <Button size="sm" variant="primary" icon="landmark" onClick={() => setOpen(true)}>
          {L('连接', 'Connect')}
        </Button>
      </div>
    );

  return (
    <Card
      title={L('数据来源', 'Data source')}
      icon="landmark"
      action={
        <Segmented
          size="sm"
          value={amp ? 'amp' : 'manual'}
          onChange={(v) => (v === 'manual' ? actions.setAssetSource('manual') : assets.amp?.syncedAt ? actions.setAssetSource('amp') : setOpen(true))}
          options={[
            { value: 'manual', label: L('手动记录', 'My check-ins') },
            { value: 'amp', label: 'Asset Management Pro' },
          ]}
        />
      }
    >
      {amp ? (
        <div className="amp-status">
          <p className="small">
            {L('账户和净资产来自 Asset Management Pro（在这个浏览器里解密，不经过任何服务器）。', 'Accounts and net worth come from Asset Management Pro, decrypted in this browser (nothing passes through a server).')}{' '}
            {synced && <span className="muted">{L(`上次同步 ${synced} · 数据截至 ${assets.amp?.asOf}`, `Last synced ${synced} · data as of ${assets.amp?.asOf}`)}</span>}
          </p>
          <p className="muted small">{L('你自己手动记的账户和盘点都还在，切回「手动记录」就能看到。', 'Your own accounts and check-ins are kept; switch back to “My check-ins” to see them.')}</p>
        </div>
      ) : (
        <p className="small">{L('用 Asset Management Pro 的账户、余额和历史月度净资产代替手动记录。输入它的 8 位解锁码，在这个浏览器里解密读取，不经过任何服务器。', 'Use Asset Management Pro’s accounts, balances and monthly net-worth history instead of checking in by hand. Enter its 8-digit unlock code; it’s decrypted in this browser, nothing passes through a server.')}</p>
      )}
      {remembered && amp ? (
        <div className="row-gap wrap">
          <Button icon="refresh" disabled={busy} onClick={() => void refresh()}>
            {busy ? L('同步中…', 'Syncing…') : L('立即同步', 'Sync now')}
          </Button>
          <Button variant="ghost" icon="lock" onClick={() => void forgetAmp().then(() => setRemembered(false))}>
            {L('忘记解锁码', 'Forget the unlock code')}
          </Button>
          <span className="muted small">{L('打开 LifeOS 时会自动同步（超过 6 小时才会）。', 'LifeOS syncs by itself when opened (if it’s been 6+ hours).')}</span>
        </div>
      ) : (
        <form className="amp-unlock" onSubmit={(e) => (e.preventDefault(), void unlock())}>
          <Field label={L('解锁码', 'Unlock code')}>
            <input className="input" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••••••" />
          </Field>
          <label className="check-row">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>
              {L('在这个浏览器里记住（以后自动同步）', 'Remember in this browser (sync automatically later)')}
              <small className="muted"> {L('· 能用这个浏览器的人也就能看到资产数据', '· anyone using this browser can then see the data')}</small>
            </span>
          </label>
          <div className="row-gap">
            <Button type="submit" variant="primary" icon="landmark" disabled={busy || pin.length !== 8}>
              {busy ? L('解锁中…', 'Unlocking…') : L('解锁并同步', 'Unlock & sync')}
            </Button>
            {!amp && (
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {L('取消', 'Cancel')}
              </Button>
            )}
          </div>
        </form>
      )}
      {device === false && <p className="error small">{L('这个浏览器里还没有 Asset Management Pro 的设备密钥。先在这个浏览器打开 Asset Management Pro，导入设备密钥并勾选「记住」，再回来。', 'This browser has no Asset Management Pro device key yet. Open Asset Management Pro in this browser, import the device key with “remember” ticked, then come back.')}</p>}
      {err && <p className="error small">{err}</p>}
    </Card>
  );
}
