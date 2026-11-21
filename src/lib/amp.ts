import type { Account, AccountKind, PaletteKey, Snapshot } from '../store/types';

/**
 * Asset Management Pro (AMP) as a net-worth source.
 *
 * AMP publishes its ledger as an AES-GCM vault next to LifeOS on the same GitHub Pages site. Its
 * unlock page keeps a device key in this browser's IndexedDB ("amp-pages-device-v2"). Because both
 * apps live on the same origin, LifeOS can use that key together with the 8-digit unlock code to
 * open the vault right here in the browser, then turns its statements into accounts and monthly
 * net-worth snapshots. Nothing is sent anywhere.
 *
 * With "remember", the PIN-derived secret (never the PIN itself) is kept as a non-extractable
 * CryptoKey in LifeOS's own IndexedDB, so later refreshes need no code.
 */

const PREFIX = 'AMPVAULT2';
const ITER = 600_000;
const enc = new TextEncoder();

export const defaultVaultUrl = () => new URL('/Asset_Management_Pro/vault.bin', location.origin).toString();

/* ---------------- IndexedDB helpers ---------------- */

function idb<T>(name: string, store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    const open = indexedDB.open(name, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(store);
    open.onerror = () => rej(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(store, mode);
      const r = op(tx.objectStore(store));
      tx.oncomplete = () => (db.close(), res(r.result));
      tx.onabort = () => (db.close(), rej(tx.error ?? r.error));
    };
  });
}

/** Does this browser already hold AMP's device key (i.e. AMP was unlocked here with "remember")? */
export async function ampDeviceReady(): Promise<boolean> {
  try {
    // don't create AMP's database by merely looking for it
    if (typeof indexedDB.databases === 'function' && !(await indexedDB.databases()).some((d) => d.name === 'amp-pages-device-v2')) return false;
    const k = await idb<CryptoKey | undefined>('amp-pages-device-v2', 'keys', 'readonly', (s) => s.get('active'));
    return k instanceof CryptoKey;
  } catch {
    return false;
  }
}

const deviceKey = () => idb<CryptoKey | undefined>('amp-pages-device-v2', 'keys', 'readonly', (s) => s.get('active'));
const saveMaterial = (k: CryptoKey) => idb('lifeos-amp', 'keys', 'readwrite', (s) => s.put(k, 'material'));
const loadMaterial = () => idb<CryptoKey | undefined>('lifeos-amp', 'keys', 'readonly', (s) => s.get('material'));
export const forgetAmp = () => idb('lifeos-amp', 'keys', 'readwrite', (s) => s.delete('material'));
export const ampRemembered = async () => {
  try {
    return (await loadMaterial()) instanceof CryptoKey;
  } catch {
    return false;
  }
};

/* ---------------- decrypt ---------------- */

export class AmpError extends Error {
  constructor(public code: 'no-device' | 'no-vault' | 'wrong-code' | 'bad-vault' | 'no-memory') {
    super(code);
  }
}

async function materialFromPin(pin: string): Promise<CryptoKey> {
  const dev = await deviceKey().catch(() => undefined);
  if (!(dev instanceof CryptoKey)) throw new AmpError('no-device');
  const pinBytes = enc.encode(pin);
  const input = new Uint8Array(await crypto.subtle.sign('HMAC', dev, pinBytes));
  pinBytes.fill(0);
  try {
    return await crypto.subtle.importKey('raw', input, 'PBKDF2', false, ['deriveKey']);
  } finally {
    input.fill(0);
  }
}

async function openVault(url: string, material: CryptoKey): Promise<VaultData> {
  let res: Response;
  try {
    res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-cache', credentials: 'omit' });
  } catch {
    throw new AmpError('no-vault');
  }
  if (!res.ok) throw new AmpError('no-vault');
  const bytes = new Uint8Array(await res.arrayBuffer());
  const head = PREFIX.length + 16 + 12;
  if (bytes.length < head + 16 || new TextDecoder().decode(bytes.subarray(0, PREFIX.length)) !== PREFIX) throw new AmpError('bad-vault');
  const salt = bytes.subarray(PREFIX.length, PREFIX.length + 16);
  const iv = bytes.subarray(PREFIX.length + 16, head);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  let plain: Uint8Array;
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(PREFIX), tagLength: 128 }, key, bytes.subarray(head)));
  } catch {
    throw new AmpError('wrong-code');
  }
  try {
    const v = JSON.parse(new TextDecoder().decode(plain));
    if (!v?.data?.['ledger.json']) throw new AmpError('bad-vault');
    return v.data as VaultData;
  } finally {
    plain.fill(0);
  }
}

/** Unlock with the 8-digit code (optionally remembering it for this browser) and read the data. */
export async function ampUnlock(url: string, pin: string, remember: boolean) {
  const material = await materialFromPin(pin);
  const data = await openVault(url, material);
  if (remember) await saveMaterial(material);
  return toLifeOS(data);
}

/** Refresh with the remembered secret. */
export async function ampRefresh(url: string) {
  const material = await loadMaterial().catch(() => undefined);
  if (!(material instanceof CryptoKey)) throw new AmpError('no-memory');
  return toLifeOS(await openVault(url, material));
}

/* ---------------- AMP data → LifeOS accounts + snapshots ---------------- */

interface AmpAccount {
  label: string;
  type: 'deposit' | 'cd' | 'credit' | 'shared';
  historical?: boolean;
  owner?: string;
}
interface VaultData {
  'ledger.json': { accounts: Record<string, AmpAccount>; statements: { account: string; end: string; close: number; issue?: unknown }[] };
  'investments.json'?: { balances: { account: string; date: string; amount: number }[] };
  'wallets.json'?: { wallets: { id: string; label: string; owner?: string; balances: { date: string; amount: number }[] }[] };
}

const INVEST_LABELS: Record<string, string> = {
  'rh-individual': 'Robinhood 个人投资',
  'rh-crypto': 'Robinhood Crypto',
  'rh-futures': 'Robinhood 期货',
  vanguard: 'Vanguard 券商账户',
};
const COLORS: PaletteKey[] = ['blue', 'jade', 'orange', 'violet', 'amber', 'teal', 'pink', 'indigo', 'red', 'lime', 'brown', 'slate'];

interface Src {
  id: string;
  name: string;
  kind: AccountKind;
  closed: boolean;
  carry: boolean; // wallets: last reported balance carries forward
  balances: { date: string; amount: number }[]; // dollars, sorted by date
}

export interface AmpImport {
  accounts: Account[];
  snapshots: Snapshot[];
  asOf: string;
  total: number;
}

const monthEnd = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
};

export function toLifeOS(d: VaultData): AmpImport {
  const L = d['ledger.json'];
  const srcs: Src[] = [];
  for (const [id, a] of Object.entries(L.accounts)) {
    const card = a.type === 'credit' || a.type === 'shared';
    srcs.push({
      id,
      name: a.label,
      kind: card ? 'debt' : 'bank',
      closed: !!a.historical,
      carry: false,
      balances: L.statements.filter((s) => s.account === id && !s.issue).map((s) => ({ date: s.end, amount: s.close / 100 })),
    });
  }
  const inv = d['investments.json']?.balances ?? [];
  for (const id of [...new Set(inv.map((b) => b.account))]) {
    srcs.push({ id, name: INVEST_LABELS[id] ?? id, kind: id.includes('crypto') ? 'crypto' : 'invest', closed: false, carry: false, balances: inv.filter((b) => b.account === id).map((b) => ({ date: b.date, amount: b.amount / 100 })) });
  }
  for (const w of d['wallets.json']?.wallets ?? []) {
    srcs.push({ id: w.id, name: w.label, kind: 'cash', closed: false, carry: true, balances: w.balances.map((b) => ({ date: b.date, amount: b.amount / 100 })) });
  }
  const used = srcs.filter((x) => x.balances.length);
  used.forEach((x) => x.balances.sort((a, b) => a.date.localeCompare(b.date)));

  const accounts: Account[] = used.map((x, i) => ({ id: `amp:${x.id}`, name: x.name, kind: x.kind, currency: 'USD', color: COLORS[i % COLORS.length], archived: x.closed || undefined, source: 'amp' }));

  // one snapshot per month (each account's latest balance up to that month; closed accounts drop to 0
  // after their last statement), then today's position (every open account at its latest balance)
  const first = used.reduce((a, x) => (x.balances[0].date < a ? x.balances[0].date : a), '9999').slice(0, 7);
  const lastDate = used.reduce((a, x) => (x.balances.at(-1)!.date > a ? x.balances.at(-1)!.date : a), '0000');
  const snapshots: Snapshot[] = [];
  const valueAt = (x: Src, upto: string) => {
    if (upto < x.balances[0].date.slice(0, 7)) return undefined;
    if (x.closed && upto > x.balances.at(-1)!.date.slice(0, 7)) return 0;
    // a card issues no statement in a month with nothing owed: count it as 0 rather than last month's bill
    if (x.kind === 'debt') return x.balances.findLast((b) => b.date.slice(0, 7) === upto)?.amount ?? 0;
    return x.balances.findLast((b) => b.date.slice(0, 7) <= upto)?.amount;
  };
  for (let [y, m] = first.split('-').map(Number); `${y}-${String(m).padStart(2, '0')}` < lastDate.slice(0, 7); m === 12 ? (y++, (m = 1)) : m++) {
    const mk = `${y}-${String(m).padStart(2, '0')}`;
    const balances: Record<string, number> = {};
    for (const x of used) {
      const v = valueAt(x, mk);
      if (v != null) balances[`amp:${x.id}`] = Math.round(v * 100) / 100;
    }
    const date = monthEnd(mk);
    snapshots.push({ date, ts: Date.parse(`${date}T23:00:00Z`), balances, source: 'amp' });
  }
  const now: Record<string, number> = {};
  for (const x of used) now[`amp:${x.id}`] = x.closed ? 0 : x.balances.at(-1)!.amount;
  snapshots.push({ date: lastDate, ts: Date.parse(`${lastDate}T23:00:00Z`), balances: now, source: 'amp' });

  const total = used.reduce((a, x) => a + (x.closed ? 0 : (x.kind === 'debt' ? -1 : 1) * x.balances.at(-1)!.amount), 0);
  return { accounts, snapshots, asOf: lastDate, total: Math.round(total * 100) / 100 };
}
