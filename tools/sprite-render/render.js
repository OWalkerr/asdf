// node render.js <config> [outName]  (serve this folder on :8765 first: python3 -m http.server 8765)
const { chromium } = require(process.env.PW || 'playwright'); const fs = require('fs');
(async () => { const cfg = process.argv[2], out = process.argv[3] || cfg;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage();
  pg.on('pageerror', e => { console.log('PE', e.message); process.exit(1); }); pg.on('console', m => console.log('C', m.text()));
  await pg.goto('http://localhost:' + (process.env.PORT || 8765) + '/render.html?cfg=' + cfg + (process.env.QUICK ? '&quick=1' : '')); await pg.waitForFunction(() => window.RESULT, null, { timeout: 600000 });
  const r = await pg.evaluate(() => window.RESULT);
  fs.mkdirSync('out', { recursive: true }); fs.writeFileSync(`out/${out}.png`, Buffer.from(r.png.split(',')[1], 'base64')); fs.writeFileSync(`out/${out}.json`, JSON.stringify(r.meta));
  console.log('ok', out, 'clips:', r.clips.join(' | '), '\nbones:', r.bones.join(','));
  await b.close(); })();
