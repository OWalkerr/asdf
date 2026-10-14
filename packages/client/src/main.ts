import type { SlotDef } from '@bulwark/shared';
import { Scene, type Texture, Timer } from 'three/webgpu';
import { GALLERY_CENTER, updateGallery } from './app/gallery';
import { Scenario } from './app/scenario';
import { createDebugPanel } from './debug/DebugPanel';
import { GroundPicker } from './input/GroundPicker';
import { buildHelmsDeep } from './maps/helmsDeep';
import { RTSCamera } from './render/camera/RTSCamera';
import { PickCursor } from './render/fx/PickCursor';
import { createLighting } from './render/lighting';
import { HeightGrid } from './render/map/HeightGrid';
import { buildLookdevScene } from './render/map/lookdev';
import type { MapScene } from './render/map/MapScene';
import { createToonParams, type ToonParams } from './render/materials/ToonMaterial';
import { createPaletteTexture } from './render/palette';
import { createRenderContext } from './render/renderer';
import { UnitRenderer } from './render/units/UnitRenderer';
import { SimHost } from './sim-host/SimHost';

/**
 * Phase 1 giriş noktası: renderer + RTS kamera + harita + zemin/slot seçimi.
 * Harita `?map=helms_deep` (varsayılan) veya `?map=lookdev` ile seçilir.
 * Sim Web Worker'da çalışır (SimHost); birimler snapshot'tan ara değerlenerek çizilir.
 */
const MAPS: Record<string, (palette: Texture, toon: ToonParams) => MapScene> = {
  helms_deep: buildHelmsDeep,
  lookdev: buildLookdevScene,
};

const boot = async () => {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const info = document.getElementById('hud-info') as HTMLDivElement;
  const subtitle = document.querySelector('#hud-title span') as HTMLSpanElement;
  const bootEl = document.getElementById('boot') as HTMLDivElement;

  const scene = new Scene();
  const palette = createPaletteTexture();
  const toon = createToonParams();
  const params = new URLSearchParams(location.search);
  // Galeri modu birim look-dev'idir: look-dev haritasında, sim olmadan çalışır.
  const gallery = params.has('gallery');
  const mapId = gallery ? 'lookdev' : (params.get('map') ?? 'helms_deep');
  const build = MAPS[mapId];
  if (!build) throw new Error(`Bilinmeyen harita: ${mapId} (seçenekler: ${Object.keys(MAPS).join(', ')})`);
  const world = build(palette, toon);
  scene.add(world.root);
  subtitle.textContent = `· ${world.name}`;

  const ground = new HeightGrid(world.terrainGrid, world.heightAt);
  const half = world.size / 2;
  const light = createLighting(scene, half);

  const cam = new RTSCamera(window.innerWidth / window.innerHeight, {
    bounds: { minX: -half + 20, maxX: half - 20, minZ: -half + 20, maxZ: half - 20 },
    maxDistance: Math.max(150, world.size * 0.55),
    heightAt: ground.sample,
  });
  if (gallery) cam.setHome(GALLERY_CENTER.x, GALLERY_CENTER.z, 0, 24);
  else cam.setHome(world.home.x, world.home.z, world.home.yaw, world.home.distance);
  cam.attach(canvas);

  // --- Zemin / slot seçimi (three-mesh-bvh) -------------------------------------
  const picker = new GroundPicker(world.collider);
  const cursor = new PickCursor();
  scene.add(cursor.mesh);
  const pointer = { x: 0, y: 0, inside: false, dirty: false };
  let hoverText = '—';
  canvas.addEventListener('pointermove', (e) => {
    pointer.x = e.offsetX;
    pointer.y = e.offsetY;
    pointer.inside = true;
    pointer.dirty = true;
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
    cursor.hide();
    world.slots?.setHovered(-1);
  });
  // --- Simülasyon (Web Worker) --------------------------------------------------
  const UNIT_CAPACITY = 8192;
  const sim = await SimHost.start({ seed: world.def?.seed ?? 1, capacity: UNIT_CAPACITY });
  const units = new UnitRenderer(UNIT_CAPACITY, palette, toon, ground.sample);
  for (const m of units.meshes) scene.add(m);
  const scenario = new Scenario(sim, world.def);
  if (!gallery) scenario.start();

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2) {
      const hit = picker.pick(cam.camera, e.offsetX, e.offsetY, canvas.clientWidth, canvas.clientHeight);
      if (hit) scenario.moveAll(hit.point.x, hit.point.z);
      return;
    }
    if (e.button !== 0 || e.altKey || !world.slots) return;
    const hit = picker.pick(cam.camera, e.offsetX, e.offsetY, canvas.clientWidth, canvas.clientHeight);
    world.slots.setSelected(hit ? world.slots.nearest(hit.point.x, hit.point.y, hit.point.z) : -1);
  });
  const updatePick = () => {
    // Kamera hareket ettiğinde de imleç altı değişir; her karede bir raycast yeterince ucuz (BVH).
    if (!pointer.inside) return;
    const hit = picker.pick(cam.camera, pointer.x, pointer.y, canvas.clientWidth, canvas.clientHeight);
    if (!hit) {
      cursor.hide();
      world.slots?.setHovered(-1);
      hoverText = '—';
      return;
    }
    const slot = world.slots ? world.slots.nearest(hit.point.x, hit.point.y, hit.point.z) : -1;
    world.slots?.setHovered(slot);
    cursor.show(hit.point, hit.normal, slot >= 0 ? 0.6 : 1);
    const p = hit.point;
    hoverText = `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`;
  };

  const ctx = await createRenderContext(canvas, scene, cam.camera);
  const debug = await createDebugPanel(ctx.renderer, {
    ctx,
    cam,
    light,
    toon,
    flameIntensity: world.flameIntensity,
    overlay: world.debugOverlay,
    sim: {
      speed: 1,
      setSpeed: (v: number) => sim.setSpeed(v),
      actions: {
        'Düşman grubu gönder (+240)': () => scenario.sendWave(240),
        'Stres testi (+1000 düşman)': () => {
          for (let i = 0; i < 4; i++) scenario.sendWave(250);
        },
      },
    },
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

  const slotLine = (label: string, s: SlotDef | undefined) =>
    s ? `${label} ${s.id} · ${s.kind}${s.allowed.length ? ` · ${s.allowed.join(', ')}` : ''}` : `${label} —`;

  const timer = new Timer();
  timer.connect(document);
  let infoAccum = 0;
  let frames = 0;

  ctx.renderer.setAnimationLoop((now) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    cam.update(dt);
    sim.poll(now);
    if (gallery) updateGallery(units, now / 1000, ground.sample);
    else units.updateFromSim(sim, now);
    updatePick();
    ctx.render();
    debug.update();

    frames++;
    infoAccum += dt;
    if (infoAccum >= 0.25) {
      const r = ctx.renderer.info.render;
      const t = cam.target;
      const lines = [
        `backend  ${ctx.backend.toUpperCase()}   fps ${(frames / infoAccum).toFixed(0)}`,
        `draw     ${r.drawCalls} çağrı · ${(r.triangles / 1000).toFixed(1)}k üçgen`,
        `statik   ${world.stats.instances} instance / ${world.stats.batches} batch`,
        `kamera   (${t.x.toFixed(0)}, ${t.z.toFixed(0)}) zoom ${(cam.zoom01 * 100).toFixed(0)}%`,
        `imleç    ${hoverText}`,
        `birim    ${units.drawn} çizildi · ${units.meshes.length} InstancedMesh`,
        `sim      tick ${sim.tick} · ${sim.frame.count} birim · ${(sim.frame.simMicros / 1000).toFixed(2)} ms · ${sim.shared ? 'SAB' : 'postMessage'}`,
        `hash     #${sim.lastHash.tick} ${sim.lastHash.hash.toString(16).padStart(8, '0')}`,
      ];
      if (world.slots) {
        lines.push(
          slotLine('slot    ', world.slots.hoveredSlot),
          slotLine('seçili  ', world.slots.selectedSlot),
        );
      }
      info.textContent = lines.join('\n');
      infoAccum = 0;
      frames = 0;
    }
  });

  bootEl.classList.add('done');
  // Playwright / debug erişimi için.
  Object.assign(window, { __bulwark: { ctx, cam, scene, world, picker, sim, scenario } });
};

boot().catch((err: unknown) => {
  console.error(err);
  const el = document.getElementById('boot');
  if (el) {
    el.classList.add('error');
    el.textContent = `Başlatma hatası:\n${err instanceof Error ? err.message : String(err)}`;
  }
});
