// Open every app on a production build: each lazy chunk must load and render without errors.
const { chromium } = require('playwright');
const URL = process.env.LIFEOS_URL || 'http://localhost:5192/';
(async () => {
  let fails = 0;
  const b = await chromium.launch();
  for (const lang of ['zh-CN', 'en-US']) {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 }, locale: lang });
    await ctx.addInitScript(() => sessionStorage.setItem('lifeos:booted', '1'));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL); await p.getByRole('button', { name: /Explore with demo data|示例数据/ }).first().click(); await p.waitForTimeout(1500);
    const ids = ['quests', 'plan', 'projects', 'roadmap', 'research', 'earn', 'trackers', 'assets', 'mood', 'review', 'timeline', 'report', 'shop', 'trophies', 'settings'];
    for (const id of ids) {
      await p.evaluate((id) => (location.hash = `/${id}`), id); await p.waitForTimeout(700);
      const body = p.locator('.win-body');
      const n = (await body.innerText().catch(() => '')).trim().length;
      const ok = n > 40 && (await p.locator('.win-loading').count()) === 0;
      if (!ok) fails++;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${lang} ${id} (${n} chars)`);
    }
    if (errs.length) (fails++, console.log('FAIL errors', errs));
    await ctx.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); await b.close();
})();
