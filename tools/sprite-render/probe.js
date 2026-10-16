const { chromium } = require(process.env.PW || 'playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const pg = await b.newPage();
  pg.on('pageerror', e => console.log('PE', e.message));
  for (const f of process.argv.slice(2)) { await pg.goto('http://localhost:' + (process.env.PORT || 8765) + '/probe.html?f=models/' + f + '.glb'); await pg.waitForFunction(() => window.RESULT, null, { timeout: 300000 });
    const r = await pg.evaluate(() => window.RESULT); fs.mkdirSync('out', { recursive: true }); fs.writeFileSync(`out/probe_${f}.png`, Buffer.from(r.png.split(',')[1], 'base64')); fs.writeFileSync(`out/probe_${f}.txt`, r.tree); console.log(f, r.size.map(v => v.toFixed(2)).join(' ')); }
  await b.close(); })();
