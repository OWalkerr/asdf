import type { SlotDef } from '@bulwark/shared';
import { buildNavGrid, createOpenGrid } from '@bulwark/sim';
import { Scene, type Texture, Timer } from 'three/webgpu';
import { CommandPanel } from './app/CommandPanel';
import { GALLERY_CENTER, updateGallery } from './app/gallery';
import { MatchHud } from './app/MatchHud';
import { Minimap } from './app/Minimap';
import { PLAYER, Scenario } from './app/scenario';
import { AudioEngine } from './audio/AudioEngine';
import { GameAudio } from './audio/GameAudio';
import { createDebugPanel } from './debug/DebugPanel';
import { GroundPicker } from './input/GroundPicker';
import { PlayerInput } from './input/PlayerInput';
import { Selection } from './input/Selection';
import { buildHelmsDeep } from './maps/helmsDeep';
import { createRain } from './render/atmosphere/rain';
import { createSky } from './render/atmosphere/sky';
import { Lightning } from './render/atmosphere/weather';
import { RTSCamera } from './render/camera/RTSCamera';
import { ImpactFx } from './render/fx/ImpactFx';
import { OrderMarker } from './render/fx/OrderMarker';
import { PickCursor } from './render/fx/PickCursor';
import { ProjectileRenderer } from './render/fx/ProjectileRenderer';
import { SelectionRings } from './render/fx/SelectionRings';
import { BattalionHud } from './render/hud/BattalionHud';
import { createLighting, FOG_COLOR } from './render/lighting';
import { HeightGrid } from './render/map/HeightGrid';
import { buildLookdevScene } from './render/map/lookdev';
import type { MapScene } from './render/map/MapScene';
import { buildNavOverlay } from './render/map/NavOverlay';
import { createToonParams, type ToonParams } from './render/materials/ToonMaterial';
import { createPaletteTexture } from './render/palette';
import { createRenderContext } from './render/renderer';
import { StructureRenderer } from './render/structures/StructureRenderer';
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
  const debugMode = params.has('debug') && params.get('debug') !== '0';
  if (debugMode) document.body.classList.add('debug');
  const mapId = gallery ? 'lookdev' : (params.get('map') ?? 'helms_deep');
  const build = MAPS[mapId];
  if (!build) throw new Error(`Bilinmeyen harita: ${mapId} (seçenekler: ${Object.keys(MAPS).join(', ')})`);
  const world = build(palette, toon);
  scene.add(world.root);
  subtitle.textContent = `· ${world.name}`;

  const ground = new HeightGrid(world.terrainGrid, world.heightAt);
  const half = world.size / 2;
  const light = createLighting(scene, half);
  // Atmosfer: gökyüzü kubbesi, yağmur, şimşek (look-dev galerisinde sade gökyüzü).
  const sky = createSky(FOG_COLOR, '#262e3c', '#d98a4e');
  sky.sunDir.value.copy(light.sun.position).normalize();
  scene.add(sky.mesh);
  const weather = !gallery && mapId === 'helms_deep';
  const rain = weather ? createRain() : null;
  if (rain) scene.add(rain.mesh);
  const lightning = weather ? new Lightning(scene, light.hemi, sky.flash) : null;

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
  const arrows = new ProjectileRenderer(2048, ground.sample);
  const impacts = new ImpactFx(palette, toon, ground.sample);
  scene.add(...impacts.meshes);
  scene.add(cursor.mesh, marker.mesh, rings.mesh, arrows.mesh);
  const hud = world.def && !gallery ? new MatchHud(world.def) : null;
  if (hud) hud.onRepair = (gate) => scenario.repair(gate);
  // --- Ses (prosedürel WebAudio; ilk tıklamada açılır, M: sessiz) ---------------------
  const audioEngine = new AudioEngine();
  const sfx = new GameAudio(audioEngine);
  if (lightning) lightning.onStrike = () => sfx.thunder();
  impacts.onHit = (x, z) => sfx.clash(x, z);
  if (hud) {
    hud.onWave = () => sfx.horn(true);
    hud.onEnd = (victory) => sfx.horn(!victory);
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM' && !e.repeat) audioEngine.setMuted(!audioEngine.isMuted);
  });
  const minimap = world.def && !gallery ? new Minimap(world.def, world.heightAt, cam) : null;
  const selection = new Selection(units, PLAYER);
  const structures = world.def ? new StructureRenderer(world.def, world.heightAt, palette, toon) : null;
  if (structures) scene.add(...structures.meshes);
  const banners = new BattalionHud(palette, toon);
  if (!gallery) scene.add(...banners.meshes);
  const panel =
    world.def && structures && world.slots && !gallery
      ? new CommandPanel({
          def: world.def,
          scenario,
          units,
          structures,
          slots: world.slots,
          selected: selection.selected,
        })
      : null;
  if (panel) panel.onClick = () => sfx.click();
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
    slotLift: (slot) => {
      const st = structures?.bySlot.get(slot);
      return st ? (st.top - st.y) * 0.5 : 0;
    },
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
      actions: {},
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
    else {
      units.updateFromSim(sim, now);
      arrows.update(sim, now);
      structures?.update(sim.frame);
      impacts.update(sim.frame, dt);
    }
    sky.update(cam.camera.position);
    rain?.update(cam.target, ground.sample(cam.target.x, cam.target.z));
    lightning?.update(dt);
    selection.prune();
    rings.update(units, selection.selected);
    if (!gallery)
      banners.update(
        units,
        cam.camera,
        selection.selected,
        structures?.bySlot.values() ?? [],
        world.slots?.selectedIndex ?? -1,
      );
    panel?.update(sim.frame.match);
    if (!gallery && world.def) {
      sfx.setListener(cam.target.x, cam.target.z, cam.zoom01);
      sfx.updateFromFrame(sim.frame, world.def.gates);
    }
    minimap?.update(dt, units, structures);
    marker.update(now);
    input.update();
    ctx.render();
    debug.update();

    frames++;
    infoAccum += dt;
    if (infoAccum >= 0.25) {
      const r = ctx.renderer.info.render;
      const t = cam.target;
      const lines = !debugMode
        ? [`fps ${(frames / infoAccum).toFixed(0)} · ${sim.frame.count} birim`]
        : [
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
      if (debugMode && world.slots) {
        lines.push(
          slotLine('slot    ', world.slots.hoveredSlot),
          slotLine('seçili  ', world.slots.selectedSlot),
        );
      }
      info.textContent = lines.join('\n');
      hud?.update(sim.frame.match, sim.tick, structures?.gateRepair);
      infoAccum = 0;
      frames = 0;
    }
  });

  bootEl.classList.add('done');
  // Playwright / debug erişimi için.
  Object.assign(window, {
    __bulwark: { ctx, cam, scene, world, picker, sim, scenario, selection, units, structures },
  });
};

boot().catch((err: unknown) => {
  console.error(err);
  const el = document.getElementById('boot');
  if (el) {
    el.classList.add('error');
    el.textContent = `Başlatma hatası:\n${err instanceof Error ? err.message : String(err)}`;
  }
});
