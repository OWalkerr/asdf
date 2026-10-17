// node export.js <config> [...]  (serve this folder on :8765 first) -> out/glb/<config>.glb with all animations baked
const { chromium } = require(process.env.PW || 'playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  fs.mkdirSync('out/glb', { recursive: true });
  for (const cfg of process.argv.slice(2)) {
    const pg = await b.newPage(); pg.on('pageerror', e => console.log('PE', cfg, e.message));
    await pg.goto('http://localhost:' + (process.env.PORT || 8765) + '/render.html?glb=1&cfg=' + cfg);
    await pg.waitForFunction(() => window.RESULT, null, { timeout: 600000 });
    const r = await pg.evaluate(() => window.RESULT); const buf = Buffer.from(r.glb, 'base64');
    fs.writeFileSync(`out/glb/${cfg}.glb`, buf); console.log('ok', cfg, (buf.length / 1048576).toFixed(1) + ' MB', '|', r.clips.join(' · '));
    await pg.close();
  }
  await b.close();
})();
