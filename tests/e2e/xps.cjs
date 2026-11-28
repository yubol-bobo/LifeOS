const { chromium, devices } = require('playwright');
let fails = 0; const ok = (c, m, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'} ${m} ${x}`); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [lang, dev] of [['zh-CN', null], ['en-US', null], ['zh-CN', 'iPhone 13']]) {
    const ctx = await b.newContext(dev ? { ...devices[dev], locale: lang } : { viewport: { width: 1400, height: 1000 }, locale: lang });
    await ctx.addInitScript(() => sessionStorage.setItem('lifeos:booted', '1'));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto((process.env.LIFEOS_URL || 'http://localhost:5173/')); await p.getByRole('button', { name: /Explore with demo data|示例数据/ }).first().click(); await p.waitForTimeout(1500);
    await p.evaluate(() => (location.hash = '/trophies')); await p.waitForTimeout(800);
    await p.getByRole('tab', { name: lang === 'zh-CN' ? '经验值来源' : 'XP sources' }).click(); await p.waitForTimeout(600);
    const rows = await p.locator('.xps-list li').count();
    ok(rows > 4, `${lang}${dev ? ' phone' : ''}: sources listed`, rows);
    ok((await p.locator('.xps-facts li').count()) === 4, `${lang}: facts`);
    await p.getByRole('tab', { name: lang === 'zh-CN' ? '全部' : 'All', exact: true }).click(); await p.waitForTimeout(300);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over === 0, `${lang}: no sideways scroll`);
    await p.locator('.xps').screenshot({ path: require('os').tmpdir() + `/xps-${lang}${dev ? '-phone' : ''}.png` });
    ok(!errs.length, `${lang}: no errors`, errs.join('|'));
    await ctx.close();
  }
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); await b.close();
})();
