import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { addDays, dayKey, parseDay } from '../lib/date';
import { compact, money } from '../lib/format';
import { useL, useLang } from '../lib/i18n';
import { notify } from '../os/notify';
import { CURRENCIES, checkinDue, defaultRates, filledSeries, rateOf, valueIn } from '../store/assets';
import { PALETTE } from '../store/attrs';
import { actions, useStore } from '../store/store';
import type { Account, AccountKind } from '../store/types';
import { AreaChart, Sparkline } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { Button, Card, Chip, Empty, Field, Modal, Segmented, Stat } from '../ui/kit';

export const KIND_META: Record<AccountKind, { zh: string; en: string; icon: string }> = {
  cash: { zh: '现金', en: 'Cash', icon: 'wallet' },
  bank: { zh: '银行', en: 'Bank', icon: 'landmark' },
  invest: { zh: '投资', en: 'Investments', icon: 'trending-up' },
  retire: { zh: '养老/退休', en: 'Retirement', icon: 'sprout' },
  crypto: { zh: '加密货币', en: 'Crypto', icon: 'gem' },
  property: { zh: '房产/实物', en: 'Property', icon: 'house' },
  debt: { zh: '负债', en: 'Debt', icon: 'trending-down' },
  other: { zh: '其他', en: 'Other', icon: 'coins' },
};

export function Assets() {
  const L = useL();
  const lang = useLang();
  const s = useStore((x) => x);
  const [edit, setEdit] = useState<Partial<Account> | null>(null);
  const [range, setRange] = useState<'3m' | '1y' | 'all'>('1y');
  const [ratesOpen, setRatesOpen] = useState(false);
  const base = s.assets.base;
  const series = useMemo(() => filledSeries(s), [s]);
  const latest = series.at(-1);
  const prev = series.at(-2);
  const since = (days: number) => {
    const cut = addDays(dayKey(), -days);
    return [...series].reverse().find((x) => x.snap.date <= cut);
  };
  const m30 = since(30);
  const yStart = [...series].reverse().find((x) => x.snap.date < `${new Date().getFullYear()}-01-01`);
  const delta = (a?: number, b?: number) => (a != null && b != null ? a - b : null);
  const cut = range === '3m' ? addDays(dayKey(), -92) : range === '1y' ? addDays(dayKey(), -366) : '0000';
  const chart = series.filter((x) => x.snap.date >= cut).map((x) => ({ x: parseDay(x.snap.date).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: '2-digit', month: 'short', day: 'numeric' }), y: Math.round(x.total) }));
  const active = s.accounts.filter((a) => !a.archived);

  // composition by kind (assets only)
  const byKind = new Map<AccountKind, number>();
  for (const a of active) {
    const v = latest?.snap.balances[a.id];
    if (v == null || a.kind === 'debt') continue;
    byKind.set(a.kind, (byKind.get(a.kind) ?? 0) + valueIn(s.assets, a, v));
  }
  const gross = [...byKind.values()].reduce((x, y) => x + y, 0);
  const debt = active.filter((a) => a.kind === 'debt').reduce((acc, a) => acc + (latest?.snap.balances[a.id] ?? 0) * rateOf(s.assets, a.currency), 0);

  return (
    <div className="app">
      <div className="app-head">
        <div>
          <h1>{L('资产', 'Assets')}</h1>
          <p className="muted">{L('定期花一分钟记下每个账户的余额，时间会把它们连成一条曲线。', 'Spend a minute now and then noting each balance — time turns them into a curve.')}</p>
        </div>
        <div className="row-gap">
          <Button icon="plus" onClick={() => setEdit({ name: '', kind: 'bank', currency: base, color: PALETTE[s.accounts.length % PALETTE.length] })}>
            {L('添加账户', 'Add account')}
          </Button>
          <Button variant="primary" icon="wallet" disabled={!active.length} onClick={() => window.dispatchEvent(new Event('lifeos:asset-checkin'))}>
            {L('记录此刻', 'Check in now')}
          </Button>
        </div>
      </div>

      {checkinDue(s) && (
        <div className="banner">
          <span>{L('到了盘点的时候：花一分钟更新各账户余额。', 'Check-in due: take a minute to update your balances.')}</span>
          <Button variant="primary" size="sm" icon="wallet" onClick={() => window.dispatchEvent(new Event('lifeos:asset-checkin'))}>
            {L('开始', 'Start')}
          </Button>
        </div>
      )}

      <div className="stats-row">
        <Stat label={L(`净资产（${base}）`, `Net worth (${base})`)} value={latest ? money(latest.total, base, 0) : '—'} tone="wealth" sub={latest ? L(`更新于 ${latest.snap.date}`, `as of ${latest.snap.date}`) : undefined} />
        <Stat label={L('较上次', 'Since last')} value={<DeltaVal v={delta(latest?.total, prev?.total)} base={base} />} />
        <Stat label={L('近 30 天', 'Last 30 days')} value={<DeltaVal v={delta(latest?.total, m30?.total)} base={base} />} />
        <Stat label={L('今年以来', 'Year to date')} value={<DeltaVal v={delta(latest?.total, yStart?.total)} base={base} />} />
      </div>

      <div className="grid-2-1">
        <Card
          title={L('净资产走势', 'Net worth over time')}
          icon="chart"
          action={
            <Segmented
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: '3m', label: L('3 个月', '3M') },
                { value: '1y', label: L('1 年', '1Y') },
                { value: 'all', label: L('全部', 'All') },
              ]}
            />
          }
        >
          {chart.length > 1 ? <AreaChart data={chart} tone="wealth" height={240} baseline="auto" format={(v) => money(v, base, 0)} /> : <Empty icon="chart" title={L('记录两次以上显示走势', 'Check in twice to see a trend')} />}
        </Card>
        <Card title={L('构成', 'Composition')} icon="grid">
          {gross > 0 ? (
            <>
              <div className="comp-bar" role="img" aria-label="composition">
                {[...byKind.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <i key={k} style={{ flex: v, background: `var(--p-${PALETTE[Object.keys(KIND_META).indexOf(k) % PALETTE.length]})` }} title={`${L(KIND_META[k].zh, KIND_META[k].en)} ${Math.round((v / gross) * 100)}%`} />
                  ))}
              </div>
              <ul className="comp-list">
                {[...byKind.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <li key={k}>
                      <i style={{ background: `var(--p-${PALETTE[Object.keys(KIND_META).indexOf(k) % PALETTE.length]})` }} />
                      <span>{L(KIND_META[k].zh, KIND_META[k].en)}</span>
                      <span className="num muted">{Math.round((v / gross) * 100)}%</span>
                      <strong className="num">{money(v, base, 0)}</strong>
                    </li>
                  ))}
                {debt > 0 && (
                  <li>
                    <i style={{ background: 'var(--ink-3)' }} />
                    <span>{L('负债', 'Debt')}</span>
                    <span />
                    <strong className="num">−{money(debt, base, 0)}</strong>
                  </li>
                )}
              </ul>
            </>
          ) : (
            <Empty icon="grid" title={L('还没有余额', 'No balances yet')} />
          )}
        </Card>
      </div>

      <Card
        title={L('账户', 'Accounts')}
        icon="landmark"
        action={
          <div className="row-gap">
            <Segmented
              size="sm"
              value={s.assets.cadence}
              onChange={(v) => actions.setAssets({ cadence: v })}
              options={[
                { value: 'off', label: L('不提醒', 'No reminder') },
                { value: 'daily', label: L('每天', 'Daily') },
                { value: 'weekly', label: L('每周', 'Weekly') },
                { value: 'monthly', label: L('每月', 'Monthly') },
              ]}
            />
            <Button size="sm" variant="ghost" icon="globe" onClick={() => setRatesOpen(true)}>
              {base}
            </Button>
          </div>
        }
      >
        {active.length === 0 ? (
          <Empty icon="wallet" title={L('还没有账户', 'No accounts yet')} body={L('银行卡、支付宝、券商、退休账户、信用卡……币种可以不同，会按汇率折算。', 'Bank, brokerage, retirement, credit cards… currencies can differ — they’re converted at your rates.')} />
        ) : (
          <ul className="acct-list">
            {active.map((a) => {
              const hist = series.map((x) => x.snap.balances[a.id]).filter((v) => v != null) as number[];
              const cur = latest?.snap.balances[a.id];
              const before = prev?.snap.balances[a.id];
              const d = cur != null && before != null ? cur - before : null;
              return (
                <li key={a.id} style={{ '--tone': `var(--p-${a.color})` } as CSSProperties}>
                  <span className="acct-ic">
                    <Icon name={KIND_META[a.kind].icon} size={16} />
                  </span>
                  <div className="acct-main">
                    <strong>{a.name}</strong>
                    <span className="muted small">
                      {L(KIND_META[a.kind].zh, KIND_META[a.kind].en)} · {a.currency}
                    </span>
                  </div>
                  <Sparkline values={hist.slice(-16)} tone="wealth" width={96} height={30} />
                  <div className="acct-val">
                    <strong className="num">{cur != null ? (a.kind === 'debt' ? '−' : '') + money(cur, a.currency, 0) : '—'}</strong>
                    {d != null && d !== 0 && (
                      <span className={`num small ${(a.kind === 'debt' ? -d : d) > 0 ? 'pos' : 'neg'}`}>
                        {d > 0 ? '+' : '−'}
                        {compact(Math.abs(d))}
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" icon="pencil" title={L('编辑', 'Edit')} onClick={() => setEdit(a)} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {s.snapshots.length > 0 && (
        <Card title={L('盘点记录', 'Check-in history')} icon="clock">
          <ul className="xp-log">
            {[...series]
              .reverse()
              .slice(0, 8)
              .map((x, i, arr) => {
                const d = arr[i + 1] ? x.total - arr[i + 1].total : null;
                return (
                  <li key={x.snap.date}>
                    <span className="xp-dot" style={{ background: 'var(--p-jade)' }} />
                    <span className="xp-label num">{x.snap.date}</span>
                    {d != null && <span className={`num small ${d >= 0 ? 'pos' : 'neg'}`}>{(d >= 0 ? '+' : '−') + money(Math.abs(d), base, 0)}</span>}
                    <span className="xp-amt num">{money(x.total, base, 0)}</span>
                  </li>
                );
              })}
          </ul>
        </Card>
      )}

      <AccountEditor value={edit} onClose={() => setEdit(null)} />
      <RatesModal open={ratesOpen} onClose={() => setRatesOpen(false)} />
    </div>
  );
}

function DeltaVal({ v, base }: { v: number | null; base: string }) {
  if (v == null) return <>—</>;
  return <span className={v >= 0 ? 'pos' : 'neg'}>{(v >= 0 ? '+' : '−') + money(Math.abs(v), base, 0)}</span>;
}

function AccountEditor({ value, onClose }: { value: Partial<Account> | null; onClose: () => void }) {
  const L = useL();
  const [d, setD] = useState<Partial<Account>>({});
  const [key, setKey] = useState<string | undefined>('__');
  const k = value ? (value.id ?? 'new') : undefined;
  if (k !== key) {
    setKey(k);
    if (value) setD(value);
  }
  const a = { name: '', kind: 'bank', currency: 'USD', color: 'blue', ...d } as Account;
  const save = () => {
    if (!a.name.trim()) return;
    actions.saveAccount({ ...a, name: a.name.trim() });
    onClose();
  };
  return (
    <Modal
      open={!!value}
      onClose={onClose}
      title={a.id ? L('编辑账户', 'Edit account') : L('添加账户', 'Add account')}
      footer={
        <>
          {a.id && (
            <Button variant="danger" icon="trash" onClick={() => (actions.removeAccount(a.id), onClose())}>
              {L('删除', 'Delete')}
            </Button>
          )}
          <span className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            {L('取消', 'Cancel')}
          </Button>
          <Button variant="primary" icon="check" disabled={!a.name.trim()} onClick={save}>
            {L('保存', 'Save')}
          </Button>
        </>
      }
    >
      <div className="form">
        <Field label={L('账户名', 'Name')}>
          <input className="input" value={a.name} onChange={(e) => setD({ ...a, name: e.target.value })} placeholder={L('例如：招行储蓄卡', 'e.g. Chase checking')} />
        </Field>
        <Field label={L('类型', 'Type')}>
          <div className="kind-pick">
            {(Object.keys(KIND_META) as AccountKind[]).map((kk) => (
              <button type="button" key={kk} className={a.kind === kk ? 'is-on' : ''} onClick={() => setD({ ...a, kind: kk })}>
                <Icon name={KIND_META[kk].icon} size={15} />
                {L(KIND_META[kk].zh, KIND_META[kk].en)}
              </button>
            ))}
          </div>
        </Field>
        <div className="row2">
          <Field label={L('币种', 'Currency')}>
            <select className="input" value={a.currency} onChange={(e) => setD({ ...a, currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label={L('颜色', 'Color')}>
            <div className="swatches">
              {PALETTE.map((c) => (
                <button key={c} type="button" aria-label={c} className={a.color === c ? 'is-on' : ''} style={{ '--sw': `var(--p-${c})` } as CSSProperties} onClick={() => setD({ ...a, color: c })} />
              ))}
            </div>
          </Field>
        </div>
        {a.kind === 'debt' && <p className="muted small">{L('负债账户填欠款金额（正数），会从净资产里扣除。', 'For debts, enter the amount owed as a positive number; it’s subtracted from net worth.')}</p>}
      </div>
    </Modal>
  );
}

function RatesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const L = useL();
  const cfg = useStore((s) => s.assets);
  const accounts = useStore((s) => s.accounts);
  const used = [...new Set(accounts.map((a) => a.currency))];
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    setBusy(true);
    try {
      const r = await fetch(`https://open.er-api.com/v6/latest/${cfg.base}`);
      const j = await r.json();
      if (j.result !== 'success') throw new Error('rates');
      const rates: Record<string, number> = { ...cfg.rates };
      for (const [c, v] of Object.entries(j.rates as Record<string, number>)) if (v) rates[c] = 1 / v;
      actions.setAssets({ rates, ratesAt: Date.now() });
      notify({ title: L('汇率已更新', 'Rates updated'), icon: 'globe', tone: 'good' });
    } catch {
      notify({ title: L('汇率获取失败', 'Couldn’t fetch rates'), body: L('可以手动填写。', 'You can enter them by hand.'), icon: 'info', tone: 'warn' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={L('报告币种与汇率', 'Base currency & rates')}>
      <div className="form">
        <Field label={L('用哪个币种看净资产', 'Report net worth in')}>
          <select className="input" value={cfg.base} onChange={(e) => actions.setAssets({ base: e.target.value, rates: defaultRates(e.target.value) })}>
            {CURRENCIES.filter((c) => c !== 'BTC' && c !== 'ETH').map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        {used
          .filter((c) => c !== cfg.base)
          .map((c) => (
            <Field key={c} label={`1 ${c} = ? ${cfg.base}`}>
              <input className="input" type="number" step="any" min={0} value={+rateOf(cfg, c).toPrecision(6)} onChange={(e) => actions.setAssets({ rates: { ...cfg.rates, [c]: +e.target.value } })} />
            </Field>
          ))}
        <div className="row-gap">
          <Button icon="refresh" disabled={busy} onClick={refresh}>
            {busy ? L('获取中…', 'Fetching…') : L('在线更新汇率', 'Fetch latest rates')}
          </Button>
          {cfg.ratesAt && <span className="muted small">{new Date(cfg.ratesAt).toLocaleString()}</span>}
        </div>
      </div>
    </Modal>
  );
}

/** Global "how much is in each account right now?" sheet. Opened by the pet, Spotlight, widgets. */
export function CheckinSheet() {
  const L = useL();
  const s = useStore((x) => x);
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>({});
  const active = s.accounts.filter((a) => !a.archived);
  useEffect(() => {
    const f = () => {
      const last = filledSeries(s).at(-1)?.snap.balances ?? {};
      setVals(Object.fromEntries(active.map((a) => [a.id, last[a.id] != null ? String(last[a.id]) : ''])));
      setOpen(true);
    };
    window.addEventListener('lifeos:asset-checkin', f);
    return () => window.removeEventListener('lifeos:asset-checkin', f);
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => {
    const balances: Record<string, number> = {};
    for (const [id, v] of Object.entries(vals)) if (v.trim() !== '' && Number.isFinite(+v)) balances[id] = +v;
    if (!Object.keys(balances).length) return;
    actions.checkin(balances);
    setOpen(false);
    notify({ title: L('盘点完成', 'Checked in'), body: L('资产曲线已更新。', 'Your net-worth curve is updated.'), icon: 'wallet', tone: 'gold' });
  };
  if (!open) return null;
  return (
    <Modal
      open
      onClose={() => setOpen(false)}
      title={L('此刻，各账户里有多少？', 'Right now, how much is in each account?')}
      width={520}
      footer={
        <>
          <span className="muted small">{L('已预填上次的数字，只改变化的就好', 'Prefilled with last time — just change what moved')}</span>
          <span className="spacer" />
          <Button variant="primary" icon="check" onClick={save}>
            {L('保存 +20 XP', 'Save +20 XP')}
          </Button>
        </>
      }
    >
      {active.length === 0 ? (
        <Empty icon="wallet" title={L('先在「资产」里添加账户', 'Add accounts in Assets first')} />
      ) : (
        <form className="checkin" onSubmit={(e) => (e.preventDefault(), save())}>
          {active.map((a, i) => (
            <label key={a.id} style={{ '--tone': `var(--p-${a.color})` } as CSSProperties}>
              <span className="acct-ic">
                <Icon name={KIND_META[a.kind].icon} size={15} />
              </span>
              <span className="ci-name">
                {a.name}
                {a.kind === 'debt' && <Chip>{L('欠款', 'owed')}</Chip>}
              </span>
              <input className="input" type="number" step="any" inputMode="decimal" autoFocus={i === 0} value={vals[a.id] ?? ''} onChange={(e) => setVals({ ...vals, [a.id]: e.target.value })} />
              <span className="input-addon">{a.currency}</span>
            </label>
          ))}
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}
