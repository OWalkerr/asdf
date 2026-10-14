import { factionDef, MAP_DEFS, type SlotDef, UnitTypeId } from '@bulwark/shared';
import { buildNavGrid, createOpenGrid } from '@bulwark/sim';
import { Scene, type Texture, Timer, Vector3 } from 'three/webgpu';
import { GALLERY_CENTER, updateGallery } from './app/gallery';
import { MatchHud } from './app/MatchHud';
import { Minimap, setPlayerMinimapColor } from './app/Minimap';
import { chooseMatch } from './app/StartScreen';
import { PLAYER, Scenario } from './app/scenario';
import { CommandBar } from './app/ui/CommandBar';
import { HudController } from './app/ui/HudController';
import { PowersColumn } from './app/ui/PowersColumn';
import { RadialMenu } from './app/ui/RadialMenu';
import { SpeedControl } from './app/ui/SpeedControl';
import { TopHud } from './app/ui/TopHud';
import { AudioEngine } from './audio/AudioEngine';
import { GameAudio } from './audio/GameAudio';
import { createDebugPanel } from './debug/DebugPanel';
import { GroundPicker } from './input/GroundPicker';
import { PlayerInput } from './input/PlayerInput';
import { Selection } from './input/Selection';
import { buildGenericMap } from './maps/genericMap';
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
import { SpellFx } from './render/fx/SpellFx';
import { BattalionHud, setPlayerBannerColor } from './render/hud/BattalionHud';
import { createLighting, FOG_COLOR } from './render/lighting';
import { HeightGrid } from './render/map/HeightGrid';
import { buildLookdevScene } from './render/map/lookdev';
import type { MapScene } from './render/map/MapScene';
import { buildNavOverlay } from './render/map/NavOverlay';
import { createToonParams, type ToonParams } from './render/materials/ToonMaterial';
import { createPaletteTexture, setTeamColor } from './render/palette';
import { createRenderContext } from './render/renderer';
import { FortressRenderer } from './render/structures/FortressRenderer';
import { GateRenderer } from './render/structures/GateRenderer';
import { LadderRenderer } from './render/structures/LadderRenderer';
import { StructureRenderer } from './render/structures/StructureRenderer';
import { UnitRenderer } from './render/units/UnitRenderer';
import { SimHost } from './sim-host/SimHost';

/**
 * Phase 1 giriş noktası: renderer + RTS kamera + harita + zemin/slot seçimi.
 * Harita `?map=helms_deep` (varsayılan) veya `?map=lookdev` ile seçilir.
 * Sim Web Worker'da çalışır (SimHost); birimler snapshot'tan ara değerlenerek çizilir.
 */
const buildMap = (mapId: string, palette: Texture, toon: ToonParams, faction = 0): MapScene => {
  if (mapId === 'lookdev') return buildLookdevScene(palette, toon);
  if (mapId === 'helms_deep') return buildHelmsDeep(palette, toon);
  const def = MAP_DEFS[mapId];
  if (!def) throw new Error(`Bilinmeyen harita: ${mapId} (seçenekler: ${Object.keys(MAP_DEFS).join(', ')})`);
  return buildGenericMap(palette, toon, def, faction);
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
  // Maç öncesi ekran: harita + zorluk (galeri / look-dev'de yok).
  const lookdev = gallery || params.get('map') === 'lookdev';
  const choice = lookdev ? { mapId: 'lookdev', difficulty: 1, faction: 0 } : await chooseMatch();
  const faction = choice.faction;
  // Takım rengi: tarafın sancak rengi (Gondor mavi, Rohan yeşil).
  setTeamColor(palette, factionDef(faction).color);
  setPlayerBannerColor(factionDef(faction).color.main);
  if (faction > 0) setPlayerMinimapColor(faction === 1 ? '#8be07a' : '#8fe0d0');
  const mapId = choice.mapId;
  const difficulty = choice.difficulty;
  const world = buildMap(mapId, palette, toon, faction);
  scene.add(world.root);
  subtitle.textContent = `· ${world.name}`;

  const ground = new HeightGrid(world.terrainGrid, world.heightAt);
  const half = world.size / 2;
  const light = createLighting(scene, half);
  // Atmosfer: gökyüzü kubbesi, yağmur, şimşek (look-dev galerisinde sade gökyüzü).
  const sky = createSky(FOG_COLOR, '#262e3c', '#d98a4e');
  sky.sunDir.value.copy(light.sun.position).normalize();
  scene.add(sky.mesh);
  const weather = !lookdev;
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
    difficulty,
    faction,
    seed: world.def?.seed ?? 1,
    capacity: UNIT_CAPACITY,
    mapId: world.def?.id ?? null,
    mapSize: world.size,
  });
  // Kuşatma merdivenleri: birimler merdiven geçidinde surun üstüne tırmanır (zemin + ek yükseklik).
  let ladders: LadderRenderer | null = null;
  const units = new UnitRenderer(UNIT_CAPACITY, palette, toon, (x, z) =>
    ladders ? ground.sample(x, z) + ladders.climb(x, z) : ground.sample(x, z),
  );
  for (const m of units.meshes) scene.add(m);
  const scenario = new Scenario(sim, world.def, faction);
  if (!gallery) scenario.start();

  // --- Girdi: zemin/slot seçimi (BVH), tabur seçimi, emirler ----------------------
  const picker = new GroundPicker(world.collider);
  const cursor = new PickCursor();
  const marker = new OrderMarker();
  const rings = new SelectionRings(2048);
  const arrows = new ProjectileRenderer(2048, ground.sample);
  const impacts = new ImpactFx(palette, toon, ground.sample);
  scene.add(...impacts.meshes);
  scene.add(cursor.mesh, marker.mesh, rings.mesh, arrows.mesh, arrows.stones, arrows.fireballs);
  const hud = world.def && !gallery ? new MatchHud(world.def) : null;
  // --- Ses (prosedürel WebAudio; ilk tıklamada açılır, M: sessiz) ---------------------
  const audioEngine = new AudioEngine();
  const sfx = new GameAudio(audioEngine);
  if (lightning) lightning.onStrike = () => sfx.thunder();
  impacts.onHit = (x, z) => sfx.clash(x, z);
  if (hud) {
    hud.difficulty = difficulty;
    hud.faction = faction;
    hud.health = () => {
      const m = sim.frame.match;
      if (world.def?.mode === 'TD') return m.lives / Math.max(1, world.def.lives ?? 20);
      const f = structures?.fortress;
      return f ? f.hp / Math.max(1, f.max) : 1;
    };
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
  ladders =
    world.def?.mode === 'FD'
      ? new LadderRenderer(world.def, buildNavGrid(world.def), ground.sample, palette, toon)
      : null;
  if (ladders) scene.add(ladders.mesh, ladders.towers);
  // Kapı kanatları (kırılınca enkaz) ve kale yükseltme görselleri.
  const hdPlateau = world.def?.id === 'helms_deep' ? world.def.terrain.plateaus[0] : undefined;
  const gates = world.def
    ? new GateRenderer(world.def, world.heightAt, palette, toon, (i) => {
        const g = world.def?.gates[i];
        if (!hdPlateau || !g) return undefined;
        return g.id === 'culvert' ? 0.4 : hdPlateau.height - 0.4;
      })
    : null;
  if (gates) scene.add(...gates.meshes);
  const fortressFx =
    world.def && world.def.id !== 'helms_deep'
      ? new FortressRenderer(world.def, world.heightAt, palette, toon)
      : null;
  if (fortressFx) scene.add(...fortressFx.meshes);
  const banners = new BattalionHud(palette, toon);
  if (!gallery) scene.add(...banners.meshes);
  // Seçili şey: taburlar (Selection), inşa yuvası (SlotMarkers) veya kale (bu bayrak).
  let fortressSelected = false;
  const citadel = world.def?.citadel;
  const fortressScreen = new Vector3();
  const input = new PlayerInput({
    onSelectFortress: (on) => {
      fortressSelected = on;
    },
    fortressPick: (sx, sy, w, h) => {
      if (!citadel) return false;
      const y = ground.sample(citadel.pos[0], citadel.pos[1]) + (citadel.elevation ?? 0) + 8;
      fortressScreen.set(citadel.pos[0], y, citadel.pos[1]).project(cam.camera);
      if (fortressScreen.z > 1) return false;
      const px = ((fortressScreen.x + 1) / 2) * w;
      const py = ((1 - fortressScreen.y) / 2) * h;
      // Ekranda kalenin görünen boyutu: mesafeyle küçülür.
      const r = Math.max(
        40,
        (1600 /
          Math.max(20, cam.camera.position.distanceTo(new Vector3(citadel.pos[0], y, citadel.pos[1])))) *
          10,
      );
      return Math.hypot(px - sx, py - sy) < r;
    },
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
  // --- Kahraman + Spellbook ----------------------------------------------------------
  const spellFx = new SpellFx();
  scene.add(...spellFx.meshes);
  input.onTargetHover = (x, y, z, r) => spellFx.showTarget(x, y, z, r);
  input.onTargetEnd = () => spellFx.hideTarget();
  // --- BFME2 tarzı arayüz: komut çubuğu, güçler sütunu, üst arayüz ----------------------
  const ui = world.def && structures && world.slots && !gallery;
  const bar = ui ? new CommandBar() : null;
  if (bar) bar.onClick = () => sfx.click();
  const radial = ui ? new RadialMenu(cam.camera) : null;
  if (radial) radial.onClick = () => sfx.click();
  const hudCtl =
    ui && bar && world.def && structures && world.slots
      ? new HudController({
          def: world.def,
          faction,
          scenario,
          units,
          structures,
          slots: world.slots,
          selected: selection.selected,
          bar,
          fortressSelected: () => fortressSelected,
          gateRepair: () => structures.gateRepair,
          radial: radial ?? undefined,
          groundY: (x, z) => ground.sample(x, z),
        })
      : null;
  if (hudCtl)
    hudCtl.onAbility = (key, hero) => {
      // Yetenek efekti: [yarıçap, renk, süre]
      const fx: Record<string, [number, string, number]> = {
        elendil: [4, '#9cc4ff', 0.8],
        athelas: [15, '#7dffa0', 1.2],
        wizard_blast: [10, '#e8f4ff', 0.9],
        word_of_power: [30, '#ffffff', 1.6],
        arrow_wind: [40, '#ffd27a', 1.0],
        train_archers: [30, '#bff5d0', 1.0],
      };
      const [r, color, dur] = fx[key] ?? [6, '#ffffff', 1];
      units.forEach((x, y, z, b) => {
        if (b === hero) spellFx.pulse(x, y, z, r, color, dur);
      });
      if (key === 'word_of_power' || key === 'wizard_blast') sfx.thunder();
      else sfx.chime(true);
    };
  const speedUi = ui ? new SpeedControl(sim) : null;
  if (speedUi) speedUi.onClick = () => sfx.click();
  const powers = ui
    ? new PowersColumn({
        scenario,
        input,
        fx: spellFx,
        cam,
        groundY: ground.sample,
        onClick: () => sfx.click(),
      })
    : null;
  const top =
    ui && world.def
      ? new TopHud({
          def: world.def,
          faction,
          scenario,
          units,
          structures,
          cam,
          onClick: () => sfx.click(),
          selectHero: (hero) => {
            selection.click(hero, false);
            world.slots?.setSelected(-1);
            fortressSelected = false;
          },
          selectFortress: () => {
            selection.click(0, false);
            world.slots?.setSelected(-1);
            fortressSelected = true;
          },
        })
      : null;
  // Yardım penceresi + palantır düğmeleri.
  const help = document.getElementById('hud-help');
  const toggleHelp = () => document.body.classList.toggle('show-help');
  window.addEventListener('keydown', (e) => {
    if (e.key === '?' || e.code === 'F1') {
      toggleHelp();
      e.preventDefault();
    }
  });
  help?.addEventListener('click', () => document.body.classList.remove('show-help'));
  if (minimap)
    minimap.onButton = (a) => {
      if (a === 'help') toggleHelp();
      else if (a === 'sound') audioEngine.setMuted(!audioEngine.isMuted);
      else if (a === 'home') cam.lookAt(world.home.x, world.home.z);
      sfx.click();
    };
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
      const mi = sim.frame.match;
      const buffed = mi.heroBuff.findIndex((t) => t > sim.tick);
      units.glowBattalion = buffed >= 0 ? (mi.heroes[buffed] ?? 0) : 0;
      units.updateFromSim(sim, now);
      arrows.update(sim, now);
      structures?.update(sim.frame);
      ladders?.update(sim.frame);
      gates?.update(sim.frame.match);
      fortressFx?.update(sim.frame.match);
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
    hudCtl?.update(sim.frame.match, sim.tick);
    radial?.place(window.innerWidth, window.innerHeight);
    powers?.update(sim.frame.match, sim.tick);
    top?.update(sim.frame.match, sim.tick);
    // Kale seçiliyken çevresinde altın halka.
    if (fortressSelected && citadel) {
      if (selection.selected.size > 0 || (world.slots?.selectedIndex ?? -1) >= 0) fortressSelected = false;
      spellFx.showSelect(
        citadel.pos[0],
        ground.sample(citadel.pos[0], citadel.pos[1]) + (citadel.elevation ?? 0),
        citadel.pos[1],
        citadel.radius + 2,
      );
    } else spellFx.hideSelect();
    spellFx.update(dt);
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
      hud?.update(sim.frame.match, sim.tick);
      // Boss çubuğu: öncelik Balrog > Su Gözcüsü > Ateş Ejderi > Lurtz.
      const BOSS_RANK: Record<number, number> = {
        [UnitTypeId.Balrog]: 4,
        [UnitTypeId.Watcher]: 3,
        [UnitTypeId.Wyrm]: 2,
        [UnitTypeId.Lurtz]: 1,
      };
      let boss: number | null = null;
      let bossType = -1;
      units.forEach((_x, _y, _z, b, _t, hp, type) => {
        const r = BOSS_RANK[type] ?? 0;
        if (b === 0 || r === 0) return;
        const cur = BOSS_RANK[bossType] ?? 0;
        if (r > cur) {
          boss = hp;
          bossType = type;
        } else if (r === cur && boss !== null) boss = Math.max(boss, hp);
      });
      hud?.setBoss(boss, bossType);
      infoAccum = 0;
      frames = 0;
    }
  });

  bootEl.classList.add('done');
  // Playwright / debug erişimi için.
  Object.assign(window, {
    __bulwark: {
      ctx,
      cam,
      scene,
      world,
      picker,
      sim,
      scenario,
      selection,
      units,
      structures,
      fortress: fortressFx,
      ladders,
      hud,
    },
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
