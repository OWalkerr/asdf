// Görsel smoke test: sahneyi açar, konsol hatalarını toplar, ekran görüntüsü alır.
// Kullanım: node tests/e2e/shot.mjs <url> <çıktı.png> [kamera-eylemi]
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
if (action === 'zoom') {
  await page.mouse.move(640, 360);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -120);
} else if (action === 'rotate') {
  await page.keyboard.down('KeyQ');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyQ');
} else if (action === 'pan') {
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyD');
}
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
const info = await page.evaluate(() => ({
  boot: document.getElementById('boot')?.textContent,
  hud: document.getElementById('hud-info')?.textContent,
}));
console.log(JSON.stringify(info, null, 1));
console.log(errors.slice(0, 15).join('\n') || 'konsol hatası yok');
await browser.close();
