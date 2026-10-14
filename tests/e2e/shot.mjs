// Görsel smoke test: sahneyi açar, konsol hatalarını toplar, ekran görüntüsü alır.
// Kullanım: node tests/e2e/shot.mjs <url> <çıktı.png> [zoom|rotate|pan|overlay|nav|click:x,y|cam:x,z,yaw,dist]
import { chromium } from '@playwright/test';

const [url = 'http://localhost:5173/', out = 'shot.png', action = ''] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-features=Vulkan'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForFunction(
  () =>
    document.getElementById('boot')?.classList.contains('done') ||
    document.getElementById('boot')?.classList.contains('error'),
  null,
  { timeout: 60000 },
);
// PRE_JS: açılıştan sonra sayfada çalıştırılacak betik (ör. inşa komutları, sim hızı).
if (process.env.PRE_JS) await page.evaluate(process.env.PRE_JS);
if (action === 'zoom') {
  await page.mouse.move(640, 360);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -120);
} else if (action === 'rotate') {
  await page.keyboard.down('KeyQ');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyQ');
} else if (action.startsWith('click:')) {
  // click:x,y → imleci taşı, sol tıkla (slot seçimi), imleç orada kalsın
  const [x, y] = action.slice(6).split(',').map(Number);
  await page.mouse.move(x, y);
  await page.waitForTimeout(300);
  await page.mouse.down();
  await page.mouse.up();
} else if (action.startsWith('cam:')) {
  // cam:x,z,yawDeg,mesafe → kamerayı anında konumlandır
  const [x, z, yaw, dist] = action.slice(4).split(',').map(Number);
  await page.evaluate(
    ([x, z, yaw, dist]) => window.__bulwark.cam.setHome(x, z, yaw, dist),
    [x, z, yaw, dist],
  );
} else if (action === 'nav') {
  await page.evaluate(() => {
    window.__bulwark.scene.getObjectByName('nav-overlay').visible = true;
  });
} else if (action === 'overlay') {
  await page.evaluate(() => {
    window.__bulwark.world.debugOverlay.visible = true;
  });
} else if (action === 'pan') {
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyD');
}
await page.waitForTimeout(Number(process.env.WAIT_MS ?? 2500));
await page.screenshot({ path: out });
const info = await page.evaluate(() => ({
  boot: document.getElementById('boot')?.textContent,
  hud: document.getElementById('hud-info')?.textContent,
}));
console.log(JSON.stringify(info, null, 1));
console.log(errors.slice(0, 15).join('\n') || 'konsol hatası yok');
await browser.close();
