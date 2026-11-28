const { chromium } = require('playwright');
let fails = 0; const ok = (c, m, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${m} ${x}`); if (!c) fails++; };
const SHOT = process.env.SHOTS || require('os').tmpdir() + '/';
const URL = process.env.LIFEOS_URL || 'http://localhost:5173/';
(async () => {
  const b = await chromium.launch();
  for (const lang of ['zh-CN', 'en-US']) {
    const zh = lang === 'zh-CN';
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: lang });
    await ctx.addInitScript(() => sessionStorage.setItem('lifeos:booted', '1'));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL); await p.getByRole('button', { name: /Explore with demo data|示例数据/ }).first().click(); await p.waitForTimeout(1500);
    const run = (fn) => p.evaluate(async (fn) => { const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => n.includes('/src/store/store.ts')); const m = await import(url); return new Function('m', fn)(m); }, fn);
    // a to-do left from yesterday
    await run(`const st=structuredClone(m.getState()); st.quests.push({id:'old1',title:'${zh ? '昨天的报销' : 'Expense report'}',kind:'once',attr:'wealth',difficulty:'easy',createdAt:Date.now()-86400000}); m.actions.replace(st); return 1`);

    // 1) Spotlight capture
    await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
    await p.keyboard.type(zh ? '约导师开会 明天 !' : 'call advisor tomorrow !'); await p.waitForTimeout(300);
    const cap = p.locator('.spot-item', { hasText: zh ? '新建待办' : 'New to-do' });
    ok(await cap.count() === 1 && /(明天|tomorrow)/.test(await cap.innerText()), `${lang}: Spotlight offers to capture with the parsed day`, (await cap.innerText()).replace(/\s+/g, ' '));
    await p.screenshot({ path: `${SHOT}spot-capture-${lang}.png` });
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const made = await run(`return m.getState().quests.find(q=>q.title==='${zh ? '约导师开会' : 'call advisor'}')`);
    ok(made && made.day && made.difficulty === 'hard', `${lang}: captured as a to-do for tomorrow, hard`);
    // Spotlight with an empty query shows the app groups
    await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
    ok(await p.locator('.spot-group', { hasText: zh ? '过好今天' : 'Today' }).count() === 1 && await p.locator('.spot-group', { hasText: zh ? '记录与回顾' : 'Records' }).count() === 1, `${lang}: apps grouped in Spotlight`);
    await p.keyboard.press('Escape');

    // 2) morning plan via the top bar button (force morning by calling openRitual)
    await p.evaluate(() => window.dispatchEvent(new CustomEvent('lifeos:ritual', { detail: 'morning' }))); await p.waitForTimeout(400);
    const dlg = p.getByRole('dialog');
    ok(await dlg.locator('section').first().getByText(zh ? '昨天的报销' : 'Expense report').count() === 1, `${lang}: morning plan lists what was left from before`);
    const stars = dlg.locator('.rt-star');
    for (let i = 0; i < 4; i++) await stars.nth(i).click();
    await p.waitForTimeout(200);
    ok(await dlg.locator('.rt-star.is-on').count() === 3, `${lang}: three stars at most`);
    await dlg.screenshot({ path: `${SHOT}ritual-morning-${lang}.png` });
    await dlg.getByRole('button', { name: zh ? '开始今天' : 'Start the day' }).click(); await p.waitForTimeout(300);
    const plan = await run(`const d=m.getState().dayPlans; const k=Object.keys(d).sort().pop(); return d[k]`);
    ok(plan.top.length === 3 && plan.planned, `${lang}: plan saved`);

    // 3) Quests app shows the starred ones first
    await p.locator(zh ? '[aria-label="程序坞"] [aria-label="任务"]' : '[aria-label="Dock"] [aria-label="Quests"]').click(); await p.waitForTimeout(600);
    const firstOnce = await p.locator('.quest-list').nth(1).locator('.quest').first();
    const firstDaily = await p.locator('.quest-list').first().locator('.quest').first();
    ok((await firstOnce.locator('.q-star.is-on').count()) + (await firstDaily.locator('.q-star.is-on').count()) >= 1, `${lang}: starred items lead the lists`);

    // 4) evening wrap-up: move everything left to tomorrow
    await p.evaluate(() => window.dispatchEvent(new CustomEvent('lifeos:ritual', { detail: 'evening' }))); await p.waitForTimeout(400);
    await dlg.screenshot({ path: `${SHOT}ritual-evening-${lang}.png` });
    const left0 = await dlg.locator('.ritual section').last().locator('.rt-row').count();
    await dlg.getByRole('button', { name: zh ? '全部挪到明天' : 'Move all to tomorrow' }).click(); await p.waitForTimeout(300);
    ok(left0 > 0 && /(都做完了|Everything)/.test(await dlg.innerText()), `${lang}: everything left moved to tomorrow`, left0);
    await dlg.getByRole('button', { name: zh ? '收工' : 'Done for today' }).click(); await p.waitForTimeout(200);
    ok(await run(`const d=m.getState().dayPlans; const k=Object.keys(d).sort().pop(); return !!d[k].closed`), `${lang}: wrap-up saved`);
    ok(await p.locator('.menubar [aria-label*="' + (zh ? '晨间' : 'Morning') + '"], .menubar [aria-label*="' + (zh ? '晚间' : 'Evening') + '"]').count() === 1, `${lang}: top bar button`);
    ok(!errs.length, `${lang}: no errors`, errs.join('|'));
    await ctx.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); await b.close();
})();
