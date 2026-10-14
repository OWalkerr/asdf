import { Scene, Timer } from 'three/webgpu';
import { createDebugPanel } from './debug/DebugPanel';
import { RTSCamera } from './render/camera/RTSCamera';
import { createLighting } from './render/lighting';
import { buildLookdevScene } from './render/map/lookdev';
import { createToonParams } from './render/materials/ToonMaterial';
import { createPaletteTexture } from './render/palette';
import { createRenderContext } from './render/renderer';

/**
 * Phase 1 / Adım 1–3 giriş noktası: renderer + RTS kamera + toon look-dev sahnesi.
 * Sim worker bağlantısı Adım 5'te eklenecek.
 */
const boot = async () => {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const info = document.getElementById('hud-info') as HTMLDivElement;
  const bootEl = document.getElementById('boot') as HTMLDivElement;

  const scene = new Scene();
  const palette = createPaletteTexture();
  const toon = createToonParams();
  const world = buildLookdevScene(palette, toon);
  scene.add(world.root);

  const half = world.spec.size / 2;
  const light = createLighting(scene, half);

  const cam = new RTSCamera(window.innerWidth / window.innerHeight, {
    bounds: { minX: -half + 20, maxX: half - 20, minZ: -half + 20, maxZ: half - 20 },
    heightAt: world.heightAt,
  });
  cam.setHome(0, 12, 0, 120);
  cam.attach(canvas);

  const ctx = await createRenderContext(canvas, scene, cam.camera);
  const debug = await createDebugPanel(ctx.renderer, {
    ctx,
    cam,
    light,
    toon,
    flameIntensity: world.flameIntensity,
  });

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    cam.camera.aspect = w / h;
    cam.camera.updateProjectionMatrix();
    ctx.resize(w, h);
  };
  window.addEventListener('resize', resize);
  resize();

  const timer = new Timer();
  timer.connect(document);
  let infoAccum = 0;
  let frames = 0;

  ctx.renderer.setAnimationLoop((now) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    cam.update(dt);
    ctx.render();
    debug.update();

    frames++;
    infoAccum += dt;
    if (infoAccum >= 0.5) {
      const r = ctx.renderer.info.render;
      const t = cam.target;
      info.textContent = [
        `backend  ${ctx.backend.toUpperCase()}   fps ${(frames / infoAccum).toFixed(0)}`,
        `draw     ${r.drawCalls} çağrı · ${(r.triangles / 1000).toFixed(1)}k üçgen`,
        `statik   ${world.stats.instances} instance / ${world.stats.batches} BatchedMesh`,
        `kamera   (${t.x.toFixed(0)}, ${t.z.toFixed(0)}) zoom ${(cam.zoom01 * 100).toFixed(0)}%`,
      ].join('\n');
      infoAccum = 0;
      frames = 0;
    }
  });

  bootEl.classList.add('done');
  // Playwright / debug erişimi için.
  Object.assign(window, { __bulwark: { ctx, cam, scene, world } });
};

boot().catch((err: unknown) => {
  console.error(err);
  const el = document.getElementById('boot');
  if (el) {
    el.classList.add('error');
    el.textContent = `Başlatma hatası:\n${err instanceof Error ? err.message : String(err)}`;
  }
});
