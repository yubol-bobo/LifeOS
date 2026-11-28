const { chromium } = require('playwright');
let fails = 0; const ok = (c, m, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${m} ${x}`); if (!c) fails++; };
const SHOT = process.env.SHOTS || require('os').tmpdir() + '/';
const URL = process.env.LIFEOS_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch();
  const mk = async () => { const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'zh-CN' }); await ctx.addInitScript(() => sessionStorage.setItem('lifeos:booted', '1')); return ctx; };
  const mod = (p, path) => (fn) => p.evaluate(async ([path, fn]) => { const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes(path)); const m = await import(url); return new Function('m', `return (async()=>{${fn}})()`)(m); }, [path, fn]);
  const idb = (p) => p.evaluate(() => new Promise((res) => { const r = indexedDB.open('lifeos', 1); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('state'); g.onsuccess = () => res(g.result ? g.result.json.length : 0); }; r.onerror = () => res(-1); }));

  // 1) an old install: data only in localStorage → moves into IndexedDB
  let ctx = await mk(); let p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.getByRole('button', { name: /示例数据/ }).first().click(); await p.waitForTimeout(1200);
  const legacy = await p.evaluate(() => localStorage.getItem('lifeos:v1')); await ctx.close();
  ctx = await mk(); await ctx.addInitScript((j) => { if (!localStorage.getItem('lifeos:v1')) localStorage.setItem('lifeos:v1', j); }, legacy);
  p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(1500);
  const S = mod(p, '/src/store/store.ts'), P = mod(p, '/src/store/persist.ts');
  const nq = JSON.parse(legacy).quests.length;
  ok(await S(`return m.getState().quests.length`) === nq, 'old localStorage data loads', nq);
  ok((await idb(p)) > 1000, 'and is copied into IndexedDB');
  ok((await P(`return m.getStorageStatus().backend`)) === 'indexeddb', 'backend is IndexedDB');
  ok((await P(`return (await m.listBackups()).length`)) === 1, 'first daily backup made');

  // 2) IndexedDB newer than localStorage wins; big state (> mirror) survives reload
  await S(`const st=structuredClone(m.getState()); const big='x'.repeat(3000); for(let i=0;i<1200;i++) st.quests.push({...st.quests[0], id:'big'+i, title:'big '+i, notes:big}); m.actions.replace(st); return 1`);
  await p.waitForTimeout(1500);
  ok((await p.evaluate(() => localStorage.getItem('lifeos:v1'))) === null, 'too big for localStorage → mirror removed (never stale)');
  await p.reload(); await p.waitForTimeout(2000);
  ok(await S(`return m.getState().quests.length`) === nq + 1200, 'big state reloads from IndexedDB', await S(`return m.getState().quests.length`));
  ok(await P(`return m.getStorageStatus().bytes > 5e6`), 'status shows its size');

  // 3) shrink back, mirror returns
  await S(`const st=structuredClone(m.getState()); st.quests=st.quests.filter(q=>!q.id.startsWith('big')); m.actions.replace(st); return 1`); await p.waitForTimeout(1200);
  ok((await p.evaluate(() => localStorage.getItem('lifeos:v1')))?.length > 1000, 'mirror comes back when it fits');

  // 4) settings card + restore
  await p.evaluate(async () => { const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/os/router')); (await import(url)).open('settings'); }); await p.waitForTimeout(800);
  const card = p.locator('.card', { hasText: '数据健康' });
  ok(await card.count() === 1, 'Data health card in Settings');
  await card.scrollIntoViewIfNeeded(); await card.screenshot({ path: SHOT + 'datahealth.png' });
  ok(await card.locator('.dh-backups li').count() >= 1, 'backup listed');
  await S(`m.actions.addQuest({title:'after-backup-todo', kind:'once', attr:'craft', difficulty:'normal'}); return 1`); await p.waitForTimeout(500);
  // put an older backup (yesterday) holding the legacy data
  await P(`const k='2026-11-01'; await new Promise((res,rej)=>{const r=indexedDB.open('lifeos',1); r.onsuccess=()=>{const t=r.result.transaction('backups','readwrite'); t.objectStore('backups').put({day:k,at:Date.now()-864e5*27,size:${legacy.length},gz:false,data:${JSON.stringify(legacy)}},k); t.oncomplete=res; t.onerror=rej;};}); return 1`);
  await p.evaluate(async () => { const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/os/router')); const r = await import(url); r.open('today'); }); await p.waitForTimeout(300);
  await p.evaluate(async () => { const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/os/router')); const r = await import(url); r.open('settings'); }); await p.waitForTimeout(800);
  const row = card.locator('.dh-backups li', { hasText: '2026-11-01' });
  ok(await row.count() === 1, 'older backup listed');
  await row.getByRole('button', { name: '恢复到这天' }).click(); await p.waitForTimeout(300);
  await p.getByRole('dialog').getByRole('button', { name: '恢复', exact: true }).click(); await p.waitForTimeout(1200);
  ok(await S(`return !m.getState().quests.some(q=>q.title==='after-backup-todo')`), 'restore brings back the old data');
  const todayB = await P(`const b=(await m.listBackups())[0]; return (await m.unpack(b)).includes('after-backup-todo')`);
  ok(todayB, 'what you had before was backed up first (undo possible)');

  // 5) forced write failure → warning
  await p.evaluate(() => { IDBObjectStore.prototype.put = function () { throw new Error('QuotaExceededError (test)'); }; Storage.prototype.setItem = function () { throw new Error('QuotaExceededError (test)'); }; });
  await S(`m.actions.addQuest({title:'x', kind:'once', attr:'craft', difficulty:'normal'}); return 1`); await p.waitForTimeout(1200);
  const warn = p.getByText('保存失败：数据可能没存下来');
  ok(await warn.count() > 0, 'failed save shows a warning');
  ok(await card.locator('.dh-state.is-bad').count() === 1, 'card turns red');
  await p.screenshot({ path: SHOT + 'savefail.png' });
  ok(!errs.length, 'no errors', errs.join('|'));
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  await b.close();
})();
