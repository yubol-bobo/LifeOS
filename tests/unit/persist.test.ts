import { IDBFactory } from 'fake-indexeddb';
import { addDays } from '../../src/lib/date';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// a fresh copy of the module (and a fresh database) for every test
let P: typeof import('../../src/store/persist');
beforeEach(async () => {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  P = await import('../../src/store/persist');
});
const tick = () => new Promise((r) => setTimeout(r, 30));

describe('storage', () => {
  it('saves to IndexedDB with a localStorage copy, and loads it back', async () => {
    await P.save('{"a":1}');
    expect(P.getStorageStatus()).toMatchObject({ backend: 'indexeddb', mirror: true, error: undefined });
    expect(localStorage.getItem(P.LS_KEY)).toBe('{"a":1}');
    localStorage.clear();
    expect(await P.loadSaved()).toBe('{"a":1}');
  });

  it('moves an old localStorage-only save over (first run after upgrading)', async () => {
    localStorage.setItem(P.LS_KEY, '{"old":true}');
    expect(await P.loadSaved()).toBe('{"old":true}');
  });

  it('prefers whichever copy was saved last', async () => {
    await P.save('{"v":1}');
    localStorage.setItem(P.LS_KEY, '{"v":2}');
    localStorage.setItem(`${P.LS_KEY}:at`, String(Date.now() + 1000)); // e.g. written while the page closed
    expect(await P.loadSaved()).toBe('{"v":2}');
    await P.save('{"v":3}');
    expect(await P.loadSaved()).toBe('{"v":3}');
  });

  it('drops the localStorage copy when the data outgrows it, so it is never stale', async () => {
    await P.save('{"small":1}');
    const big = JSON.stringify({ x: 'y'.repeat(2_600_000) });
    await P.save(big);
    expect(localStorage.getItem(P.LS_KEY)).toBeNull();
    expect(P.getStorageStatus().mirror).toBe(false);
    expect(await P.loadSaved()).toBe(big);
  });

  it('never fails silently', async () => {
    const heard: string[] = [];
    P.onSaveError((m) => heard.push(m));
    await P.loadSaved();
    const put = IDBObjectStore.prototype.put;
    const setItem = Storage.prototype.setItem;
    IDBObjectStore.prototype.put = () => {
      throw new Error('quota');
    };
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
    try {
      await P.save('{"z":1}');
    } finally {
      IDBObjectStore.prototype.put = put;
      Storage.prototype.setItem = setItem;
    }
    expect(heard).toHaveLength(1);
    expect(P.getStorageStatus().error).toMatch(/quota/);
    await P.save('{"z":1}');
    expect(P.getStorageStatus().error).toBeUndefined(); // clears once saving works again
  });
});

describe('daily backups', () => {
  it('keeps one per day and restores its exact content', async () => {
    await P.save('{"day":1}');
    await tick();
    await P.save('{"day":1,"later":true}'); // same day: the first one stays
    await tick();
    const list = await P.listBackups();
    expect(list).toHaveLength(1);
    expect(await P.unpack(list[0])).toBe('{"day":1}');
  });

  it('backupNow replaces today with the current state (before a restore)', async () => {
    await P.save('{"a":1}');
    await tick();
    await P.save('{"a":2}');
    await P.backupNow();
    expect(await P.unpack((await P.listBackups())[0])).toBe('{"a":2}');
  });

  it('keeps only the last 30 days', async () => {
    const db: IDBDatabase = await new Promise((res) => {
      const r = indexedDB.open('lifeos', 1);
      r.onupgradeneeded = () => (r.result.createObjectStore('kv'), r.result.createObjectStore('backups'));
      r.onsuccess = () => res(r.result);
    });
    await new Promise((res) => {
      const t = db.transaction('backups', 'readwrite');
      for (let i = 0; i < 40; i++) {
        const day = addDays('2020-01-01', i);
        t.objectStore('backups').put({ day, at: i, size: 2, gz: false, data: '{}' }, day);
      }
      t.oncomplete = res;
    });
    db.close();
    await P.save('{}');
    await tick();
    const list = await P.listBackups();
    expect(list).toHaveLength(30);
    expect(list[0].day > list[29].day).toBe(true);
  });
});
