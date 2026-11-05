import { addDays, dayKey } from '../lib/date';
import type { Account, AssetConfig, Snapshot, State } from './types';

/** Rough defaults so a fresh setup works offline; editable, and refreshable online. Units of USD per 1 currency. */
export const USD_RATES: Record<string, number> = {
  USD: 1, CNY: 0.14, EUR: 1.08, GBP: 1.27, JPY: 0.0066, HKD: 0.128, SGD: 0.74, CAD: 0.73, AUD: 0.66, KRW: 0.00073, TWD: 0.031, CHF: 1.12, BTC: 68000, ETH: 3400,
};

export const CURRENCIES = Object.keys(USD_RATES);

export function defaultRates(base: string): Record<string, number> {
  const b = USD_RATES[base] ?? 1;
  return Object.fromEntries(Object.entries(USD_RATES).map(([k, v]) => [k, v / b]));
}

export const rateOf = (cfg: AssetConfig, cur: string) => (cur === cfg.base ? 1 : (cfg.rates[cur] ?? defaultRates(cfg.base)[cur] ?? 1));

/** Signed value of one account in the base currency (debts count negative). */
export function valueIn(cfg: AssetConfig, a: Account, amount: number) {
  return (a.kind === 'debt' ? -1 : 1) * amount * rateOf(cfg, a.currency);
}

export function netWorth(s: Pick<State, 'accounts' | 'assets'>, snap: Snapshot | undefined) {
  if (!snap) return 0;
  return s.accounts.reduce((acc, a) => acc + (snap.balances[a.id] != null ? valueIn(s.assets, a, snap.balances[a.id]) : 0), 0);
}

export const latestSnapshot = (s: Pick<State, 'snapshots'>) => s.snapshots[s.snapshots.length - 1];

/** Balance of each account carried forward to every snapshot, so a partial check-in never reads as zero. */
export function filledSeries(s: Pick<State, 'accounts' | 'snapshots' | 'assets'>) {
  const last: Record<string, number> = {};
  return s.snapshots.map((snap) => {
    Object.assign(last, snap.balances);
    const filled = { ...snap, balances: { ...last } };
    return { snap: filled, total: netWorth(s, filled) };
  });
}

/** Is a check-in due under the chosen cadence? */
export function checkinDue(s: Pick<State, 'accounts' | 'snapshots' | 'assets'>, today = dayKey()) {
  if (s.assets.cadence === 'off' || !s.accounts.some((a) => !a.archived)) return false;
  const last = latestSnapshot(s)?.date;
  if (!last) return true;
  const gap = s.assets.cadence === 'daily' ? 1 : s.assets.cadence === 'weekly' ? 7 : 30;
  return addDays(last, gap) <= today;
}
