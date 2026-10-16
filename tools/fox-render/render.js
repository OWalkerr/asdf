const { chromium } = require('/opt/node-tools/node_modules/playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage();
  pg.on('pageerror', e => console.log('PE', e.message)); pg.on('console', m => m.type() === 'error' && console.log('C', m.text()));
  await pg.goto('http://localhost:8765/render.html' + (process.argv[3] || '')); await pg.waitForFunction(() => window.RESULT, null, { timeout: 300000 });
  const r = await pg.evaluate(() => window.RESULT); fs.writeFileSync(process.argv[2] + '.png', Buffer.from(r.png.split(',')[1], 'base64')); fs.writeFileSync(process.argv[2] + '.json', JSON.stringify(r.meta));
  console.log('ok', JSON.stringify(r.meta).length); await b.close(); })();
