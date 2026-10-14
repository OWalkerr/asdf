import type { SlotDef } from '@bulwark/shared';
import { buildNavGrid, createOpenGrid } from '@bulwark/sim';
import { Scene, type Texture, Timer } from 'three/webgpu';
import { GALLERY_CENTER, updateGallery } from './app/gallery';
import { PLAYER, Scenario } from './app/scenario';
import { createDebugPanel } from './debug/DebugPanel';
import { GroundPicker } from './input/GroundPicker';
import { PlayerInput } from './input/PlayerInput';
import { Selection } from './input/Selection';
import { buildHelmsDeep } from './maps/helmsDeep';
import { RTSCamera } from './render/camera/RTSCamera';
import { OrderMarker } from './render/fx/OrderMarker';
import { PickCursor } from './render/fx/PickCursor';
import { SelectionRings } from './render/fx/SelectionRings';
import { createLighting } from './render/lighting';
import { HeightGrid } from './render/map/HeightGrid';
import { buildLookdevScene } from './render/map/lookdev';
import type { MapScene } from './render/map/MapScene';
import { buildNavOverlay } from './render/map/NavOverlay';
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

  // --- Simülasyon (Web Worker) --------------------------------------------------
  const UNIT_CAPACITY = 8192;
  const sim = await SimHost.start({
    seed: world.def?.seed ?? 1,
    capacity: UNIT_CAPACITY,
    mapId: world.def?.id ?? null,
    mapSize: world.size,
  });
  const units = new UnitRenderer(UNIT_CAPACITY, palette, toon, ground.sample);
  for (const m of units.meshes) scene.add(m);
  const scenario = new Scenario(sim, world.def);
  if (!gallery) scenario.start();

  // --- Girdi: zemin/slot seçimi (BVH), tabur seçimi, emirler ----------------------
  const picker = new GroundPicker(world.collider);
  const cursor = new PickCursor();
  const marker = new OrderMarker();
  const rings = new SelectionRings(2048);
  scene.add(cursor.mesh, marker.mesh, rings.mesh);
  const selection = new Selection(units, PLAYER);
  const input = new PlayerInput({
    canvas,
    selBox: document.getElementById('selbox') as HTMLDivElement,
    cam,
    picker,
    selection,
    scenario,
    cursor,
    marker,
    slots: world.slots,
  });
  // Nav ızgarası debug katmanı (sim'in kullandığı ızgaranın aynısı).
  const navOverlay = buildNavOverlay(
    world.def ? buildNavGrid(world.def) : createOpenGrid(world.size),
    ground.sample,
  );
  scene.add(navOverlay);

  const ctx = await createRenderContext(canvas, scene, cam.camera);
  const debug = await createDebugPanel(ctx.renderer, {
    ctx,
    cam,
    light,
    toon,
    flameIntensity: world.flameIntensity,
    overlay: world.debugOverlay,
    navOverlay,
    sim: {
      speed: 1,
      setSpeed: (v: number) => sim.setSpeed(v),
      actions: {
        'Düşman dalgası (+3 tabur)': () => scenario.sendWave(3),
        'Stres testi (+30 tabur)': () => {
          for (let i = 0; i < 6; i++) scenario.sendWave(5);
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
    selection.prune();
    rings.update(units, selection.selected);
    marker.update(now);
    input.update();
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
        `imleç    ${input.hoverText}`,
        `seçim    ${selection.selected.size} tabur${selection.selected.size ? ' · sağ tık: hareket' : ' · tıkla / kutu çiz'}`,
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
  Object.assign(window, { __bulwark: { ctx, cam, scene, world, picker, sim, scenario, selection, units } });
};

boot().catch((err: unknown) => {
  console.error(err);
  const el = document.getElementById('boot');
  if (el) {
    el.classList.add('error');
    el.textContent = `Başlatma hatası:\n${err instanceof Error ? err.message : String(err)}`;
  }
});
