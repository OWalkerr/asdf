import {
  BUILD_RADIUS,
  BUILDING_KINDS,
  factionDef,
  MAP_DEFS,
  type MatchInfo,
  PLAYER_COLORS,
  type SlotDef,
  UNIT_DEFS,
  UnitTypeId,
} from '@bulwark/shared';
import { buildNavGrid, createOpenGrid, placementError } from '@bulwark/sim';
import { Scene, type Texture, Timer, Vector3 } from 'three/webgpu';
import { CAH_UNITS, cahName, roster, setActiveCah } from './app/cah';
import { GALLERY_CENTER, updateGallery } from './app/gallery';
import { MatchHud } from './app/MatchHud';
import { Minimap, setMinimapTeamColor, setPlayerMinimapColor } from './app/Minimap';
import { chooseMatch } from './app/StartScreen';
import { PLAYER, Scenario } from './app/scenario';
import { CommandBar } from './app/ui/CommandBar';
import { HudController, UNIT_LABELS } from './app/ui/HudController';
import { PowersColumn } from './app/ui/PowersColumn';
import { RadialMenu } from './app/ui/RadialMenu';
import { SpeedControl } from './app/ui/SpeedControl';
import { TopHud } from './app/ui/TopHud';
import { AudioEngine } from './audio/AudioEngine';
import { GameAudio } from './audio/GameAudio';
import { Music } from './audio/Music';
import { Voices } from './audio/Voices';
import { createDebugPanel } from './debug/DebugPanel';
import { GroundPicker } from './input/GroundPicker';
import { PlayerInput } from './input/PlayerInput';
import { Selection } from './input/Selection';
import { buildGenericMap } from './maps/genericMap';
import { buildHelmsDeep } from './maps/helmsDeep';
import { NetSession } from './net/NetSession';
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
import { SpellShow } from './render/fx/SpellShow';
import { BattalionHud, setPlayerBannerColor, setTeamBannerColor } from './render/hud/BattalionHud';
import { createLighting, FOG_COLOR } from './render/lighting';
import { HeightGrid } from './render/map/HeightGrid';
import { buildLookdevScene } from './render/map/lookdev';
import type { MapScene } from './render/map/MapScene';
import { buildNavOverlay } from './render/map/NavOverlay';
import { createToonParams, type ToonParams } from './render/materials/ToonMaterial';
import { createPaletteTexture, setTeamColor, setTeamRowColor } from './render/palette';
import { createRenderContext } from './render/renderer';
import { BuildGhost } from './render/structures/BuildGhost';
import { FortressRenderer } from './render/structures/FortressRenderer';
import { GateRenderer } from './render/structures/GateRenderer';
import { LadderRenderer } from './render/structures/LadderRenderer';
import { faceYaw, StructureRenderer } from './render/structures/StructureRenderer';
import { BannerCarriers } from './render/units/BannerCarriers';
import { Portraits } from './render/units/Portraits';
import { UnitRenderer } from './render/units/UnitRenderer';
import { SimHost } from './sim-host/SimHost';

/**
 * Phase 1 giriş noktası: renderer + RTS kamera + harita + zemin/slot seçimi.
 * Harita `?map=helms_deep` (varsayılan) veya `?map=lookdev` ile seçilir.
 * Sim Web Worker'da çalışır (SimHost); birimler snapshot'tan ara değerlenerek çizilir.
 */
const buildMap = (
  mapId: string,
  palette: Texture,
  toon: ToonParams,
  faction = 0,
  startTeams?: { team: number; faction: number }[],
): MapScene => {
  if (mapId === 'lookdev') return buildLookdevScene(palette, toon);
  if (mapId === 'helms_deep') return buildHelmsDeep(palette, toon);
  const def = MAP_DEFS[mapId];
  if (!def) throw new Error(`Bilinmeyen harita: ${mapId} (seçenekler: ${Object.keys(MAP_DEFS).join(', ')})`);
  return buildGenericMap(palette, toon, def, faction, startTeams);
};

/** Çok oyunculu durum şeridi: oyuncular, bekleme, ayrılma, desync. */
const mountNetStatus = (net: NetSession) => {
  const el = document.createElement('div');
  el.id = 'net-status';
  document.body.appendChild(el);
  const colors = ['#4a8fe0', '#e0c34a', '#59c06a', '#d0604a'];
  const render = () => {
    const wait = net.waiting();
    const names = net.start.nicks
      .map(
        (n, i) =>
          `<span class="${net.gone.has(i) ? 'gone' : ''}"><i style="background:${colors[i] ?? '#999'}"></i>${n
            .replace(/[&<>"']/g, '')
            .slice(0, 20)}${i === net.start.me ? ' (sen)' : ''}</span>`,
      )
      .join('');
    const gone = [...net.gone].map((i) => net.start.nicks[i] ?? `Oyuncu ${i + 1}`);
    let msg = '';
    if (net.desync) msg = '<b class="bad">Senkron bozuldu — oyun durumları ayrıştı.</b>';
    else if (gone.length > 0 && wait.length > 0)
      msg = `<b class="bad">${gone.join(', ')} oyundan ayrıldı — oyun devam edemiyor.</b>`;
    else if (wait.length > 0) msg = `<b>Bekleniyor: ${wait.join(', ')}…</b>`;
    el.innerHTML = `<div class="who">${names}</div>${msg}`;
  };
  net.onStatus = render;
  setInterval(render, 300);
  render();
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
  // Kahraman Yarat: seçilen sınıf J kahramanının yerini alır; adı arayüzde görünür.
  setActiveCah(choice.cah ?? -1, choice.cahName ?? '');
  for (const u of CAH_UNITS) UNIT_LABELS[u] = cahName(u) ?? '';
  // Çatışma: snapshot görüş takımı = 0; gerçek takım t ↔ eşlenmiş takım (yerel oyuncu ile 0 yer değiştirir).
  const vs = choice.versus ?? null;
  const mapped = (t: number): number => (vs ? (t === vs.me ? 0 : t === 0 ? vs.me : t) : t);
  // Takım rengi: tarafın sancak rengi (Gondor mavi, Rohan yeşil); çatışmada lobide seçilen renkler.
  setTeamColor(palette, factionDef(faction).color);
  setPlayerBannerColor(factionDef(faction).color.main);
  if (vs) {
    for (let t = 0; t < 4; t++) {
      const c = PLAYER_COLORS[vs.colors[t] ?? t]?.main;
      if (!c) continue;
      setTeamRowColor(palette, mapped(t), c);
      setTeamBannerColor(mapped(t), c);
      setMinimapTeamColor(mapped(t), c);
    }
  } else if (faction > 0)
    setPlayerMinimapColor(
      ['#8fb8ff', '#8be07a', '#8fe0d0', '#ecece4', '#ff8a5a', '#e0c060'][faction] ?? '#8fb8ff',
    );
  const mapId = choice.mapId;
  const difficulty = choice.difficulty;
  const vsDef = vs ? MAP_DEFS[mapId] : undefined;
  const startTeams = vs
    ? (vsDef?.starts ?? []).map((_, i) => {
        const slot = vs.setup.slots.find((s) => s.start === i);
        return slot ? { team: mapped(slot.team), faction: slot.faction } : { team: -1, faction: 0 };
      })
    : undefined;
  const myStart = vs ? vsDef?.starts?.[vs.setup.slots.find((s) => s.team === vs.me)?.start ?? 0] : undefined;
  const world = buildMap(mapId, palette, toon, faction, startTeams);
  // Çatışma: arayüzde "kale" = kendi başlangıç kalemiz (seçim, panel, yükseltme görselleri).
  if (myStart && world.def) world.def = { ...world.def, citadel: myStart };
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
  else if (myStart)
    cam.setHome(myStart.pos[0] * 0.72, myStart.pos[1] * 0.72, world.home.yaw, world.home.distance * 0.9);
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
    players: choice.net?.start.order.length,
    cah: choice.cah ?? -1,
    versus: vs?.setup ?? null,
    viewTeam: vs?.me ?? 0,
  });
  // Çok oyunculu: komutlar tur paketlerine (lockstep); oyuncu numarası başlatma sırası.
  const net = choice.net ? new NetSession(choice.net.room, sim, choice.net.start) : null;
  if (net) {
    sim.player = net.start.me;
    mountNetStatus(net);
    // Hata ayıklama / otomatik test erişimi.
    Object.assign(globalThis, { __net: net });
  }
  // Kuşatma merdivenleri: birimler merdiven geçidinde surun üstüne tırmanır (zemin + ek yükseklik).
  let ladders: LadderRenderer | null = null;
  const units = new UnitRenderer(UNIT_CAPACITY, palette, toon, (x, z) =>
    ladders ? ground.sample(x, z) + ladders.climb(x, z) : ground.sample(x, z),
  );
  for (const m of units.meshes) scene.add(m);
  // Sancaktarlar (tabur yükseltmesi): taburun ilk askeri uzun savaş sancağı taşır.
  const bannerCarriers = new BannerCarriers(palette, toon);
  scene.add(...bannerCarriers.meshes);
  const scenario = new Scenario(sim, world.def, faction);
  // Başlangıç garnizonunu yalnızca kurucu (oyuncu 0) kurar; diğerleri aynı komutları turundan alır.
  if (!gallery && !vs && (!net || net.start.me === 0)) scenario.start();

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
  // Uyarlanır müzik (F7) ve birim cevapları (F8).
  const music = new Music(audioEngine);
  music.setFaction(factionDef(faction).evil === true);
  const voices = new Voices();
  voices.muted = () => audioEngine.isMuted;
  if (lightning) lightning.onStrike = () => sfx.thunder();
  impacts.onHit = (x, z) => sfx.clash(x, z);
  if (hud) {
    hud.difficulty = difficulty;
    hud.faction = faction;
    hud.campaign = choice.campaign ?? null;
    hud.versus = vs !== null;
    hud.health = () => {
      const m = sim.frame.match;
      if (world.def?.mode === 'TD') return m.lives / Math.max(1, world.def.lives ?? 20);
      const f = structures?.fortress;
      return f ? f.hp / Math.max(1, f.max) : 1;
    };
    hud.onWave = () => {
      sfx.horn(true);
      music.waveStart();
    };
    hud.onEnd = (victory) => {
      sfx.horn(!victory);
      music.finale(victory);
    };
  }
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyM') audioEngine.setMuted(!audioEngine.isMuted);
    else if (e.code === 'F7') {
      music.toggle();
      e.preventDefault();
    } else if (e.code === 'F8') {
      voices.toggle();
      e.preventDefault();
    }
  });
  const minimap = world.def && !gallery ? new Minimap(world.def, world.heightAt, cam) : null;
  const selection = new Selection(units, PLAYER);
  const structures = world.def ? new StructureRenderer(world.def, world.heightAt, palette, toon) : null;
  if (structures) scene.add(...structures.meshes);
  ladders =
    world.def?.mode === 'FD'
      ? new LadderRenderer(
          world.def,
          buildNavGrid(world.def),
          ground.sample,
          palette,
          toon,
          factionDef(faction).evil === true,
        )
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
      ? new FortressRenderer(
          myStart ? { ...world.def, citadel: myStart } : world.def,
          world.heightAt,
          palette,
          toon,
          faction,
        )
      : null;
  if (fortressFx) scene.add(...fortressFx.meshes);
  const banners = new BattalionHud(palette, toon);
  if (!gallery) scene.add(...banners.meshes);
  // Seçili şey: taburlar (Selection), inşa yuvası (SlotMarkers) veya kale (bu bayrak).
  let fortressSelected = false;
  const citadel = world.def?.citadel;
  const fortressScreen = new Vector3();
  const hostile = (t: number): boolean => t !== 0 && ((sim.frame.match.allyMask >> t) & 1) === 0;
  const input = new PlayerInput({
    isHostile: hostile,
    enemyStructureAt: (x, z) => {
      if (!vs || !structures) return 0;
      for (const f of structures.fortresses)
        if (hostile(f.team) && f.hp > 0 && Math.hypot(f.x - x, f.z - z) < 15) return f.eid;
      for (const st of structures.bySlot.values())
        if (hostile(st.team) && st.hp > 0 && Math.hypot(st.x - x, st.z - z) < 7) return st.eid;
      return 0;
    },
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
  // Müzik yoğunluğu (kaleye yakın düşman taburu) ve birim cevapları (seçim değişince).
  let audioAcc = 0;
  let lastSel = '';
  const citadelPos = world.def?.citadel.pos ?? [0, 0];
  const audioTick = (m: MatchInfo) => {
    const selKey = [...selection.selected].join(',');
    if (selKey !== lastSel) {
      lastSel = selKey;
      const first = [...selection.selected][0];
      const info = first !== undefined ? units.battalionInfo.get(first) : undefined;
      if (info && info.team === 0) voices.say(info.type, 'select');
    }
    if (++audioAcc % 15 !== 0) return;
    let near = 0;
    for (const info of units.battalionInfo.values())
      if (info.team !== 0 && (info.x - citadelPos[0]) ** 2 + (info.z - citadelPos[1]) ** 2 < 110 * 110)
        near++;
    const busy = m.enemiesAlive > 0 ? 0.25 : 0;
    music.setIntensity(m.state !== 0 ? 0.05 : busy + Math.min(0.75, near / 10));
  };
  scenario.onCommand = (kind, list) => {
    const info = list[0] !== undefined ? units.battalionInfo.get(list[0]) : undefined;
    if (info) voices.say(info.type, kind);
  };
  // Kahraman seviye atlaması: altın sütun, çan, ekranda duyuru (yeni yetenek açıldıysa adıyla).
  const levelUps = {
    prev: [0, 0, 0],
    el: null as HTMLDivElement | null,
    check(m: MatchInfo) {
      const heroes = roster(faction);
      for (let k = 0; k < 3; k++) {
        const b = m.heroes[k] ?? 0;
        const info = b !== 0 ? units.battalionInfo.get(b) : undefined;
        const lvl = info?.rank ?? 0;
        const was = this.prev[k] ?? 0;
        this.prev[k] = lvl;
        if (!info || was === 0 || lvl <= was) continue;
        spellFx.pulse(info.x, info.y, info.z, 6, '#ffd75a', 1.4);
        sfx.chime(true);
        const def = heroes[k];
        const ab = def?.abilities.find((a) => a.rank === lvl);
        if (!ui) continue;
        if (!this.el) {
          this.el = document.createElement('div');
          this.el.id = 'levelup';
          document.body.appendChild(this.el);
        }
        this.el.innerHTML = `<b>${UNIT_DEFS[def?.unitType ?? 0]?.name ?? ''} · ${lvl}. seviye</b>${ab ? `<span>Yeni yetenek: ${ab.name}</span>` : ''}`;
        this.el.classList.remove('on');
        void this.el.offsetWidth;
        this.el.classList.add('on');
      }
    },
  };
  // Büyük güç gösterileri: kartallar, sel, deprem, güneş parlaması.
  const spellShow = new SpellShow(palette, toon);
  scene.add(...spellShow.meshes);
  spellShow.onShake = (amp, dur) => cam.shake(amp, dur);
  spellShow.onSound = (kind) => sfx.spell(kind);
  input.onTargetHover = (x, y, z, r) => spellFx.showTarget(x, y, z, r);
  // İşçiyle serbest inşa: hayalet önizleme + yerleşim kuralı (sim ile aynı fonksiyon).
  const ghost = new BuildGhost(palette, toon);
  scene.add(...ghost.meshes);
  input.onTargetEnd = () => {
    spellFx.hideTarget();
    ghost.hide();
  };
  const placeGrid = world.def ? buildNavGrid(world.def) : null;
  const placementOk = (kind: number, x: number, z: number): boolean => {
    const k = BUILDING_KINDS[kind];
    if (!k || !world.def || !placeGrid) return false;
    const others = [...(structures?.bySlot.values() ?? [])].map((st) => ({
      x: st.x,
      z: st.z,
      r: BUILD_RADIUS[BUILDING_KINDS[st.kind] ?? 'arrow_tower'],
    }));
    return placementError(world.def, placeGrid, x, z, BUILD_RADIUS[k], others) === null;
  };
  const beginPlacement = (kind: number, workers: number[]) => {
    const k = BUILDING_KINDS[kind];
    const def = world.def;
    if (!k || !def) return;
    const r = BUILD_RADIUS[k];
    input.beginTargeting({
      radius: r,
      repeat: true,
      onHover: (x, y, z) => {
        const ok = placementOk(kind, x, z);
        ghost.show(kind, x, y, z, faceYaw(def, x, z), ok);
        spellFx.showTarget(x, y, z, r, ok);
      },
      canPick: (x, z) => placementOk(kind, x, z),
      onPick: (x, z) => {
        // Seçili işçilerden yere en yakını kurar; diğer boştaki işçiler kendiliğinden yardıma gelir.
        let best = 0;
        let bestD = Number.POSITIVE_INFINITY;
        for (const w of workers) {
          const info = units.battalionInfo.get(w);
          if (!info) continue;
          const d = (info.x - x) ** 2 + (info.z - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = w;
          }
        }
        if (best === 0) return;
        scenario.construct(best, kind, x, z);
        sfx.click();
      },
    });
  };
  // --- BFME2 tarzı arayüz: komut çubuğu, güçler sütunu, üst arayüz ----------------------
  const ui = world.def && structures && world.slots && !gallery;
  const bar = ui ? new CommandBar() : null;
  if (bar) bar.onClick = () => sfx.click();
  const portraits = new Portraits();
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
          portrait: (t) => portraits.get(t),
          beginPlacement,
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
        summon_dead: [10, '#5dffa8', 1.4],
        summon_elves: [8, '#bff5d0', 1.2],
        istar_light: [20, '#fff4c0', 1.2],
        eagle_call: [14, '#ffe0a0', 1.2],
        flood_call: [20, '#8fd0ff', 1.2],
      };
      const [r, color, dur] = fx[key] ?? [6, '#ffffff', 1];
      // Büyük yetenekler güç gösterilerini kahramanın konumunda oynatır.
      const show: Record<string, string> = {
        istar_light: 'sun_flare',
        eagle_call: 'eagles',
        flood_call: 'flood',
      };
      let shown = false;
      units.forEach((x, y, z, b) => {
        if (b !== hero || shown) return;
        shown = true;
        spellFx.pulse(x, y, z, r, color, dur);
        const sk = show[key];
        if (sk) spellShow.cast(sk, x, y, z, r);
      });
      if (key === 'word_of_power' || key === 'wizard_blast') sfx.thunder();
      else sfx.chime(true);
    };
  const speedUi = ui && !net ? new SpeedControl(sim) : null;
  if (speedUi) speedUi.onClick = () => sfx.click();
  const powers = ui
    ? new PowersColumn({
        faction,
        scenario,
        input,
        fx: spellFx,
        show: spellShow,
        cam,
        groundY: ground.sample,
        onClick: () => sfx.click(),
      })
    : null;
  const top =
    ui && world.def
      ? new TopHud({
          def: world.def,
          versus: vs
            ? {
                names: [0, 1, 2, 3].map((m) => vs.names[mapped(m)] ?? ''),
                colors: [0, 1, 2, 3].map((m) => PLAYER_COLORS[vs.colors[mapped(m)] ?? 0]?.main ?? '#999'),
              }
            : undefined,
          faction,
          portrait: (t) => portraits.get(t),
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
  // BFME2 tarzı portreler: birim modelleri bir kez render edilir (asenkron).
  if (!gallery)
    portraits.onProgress = () => {
      bar?.invalidate();
      radial?.invalidate();
    };
  if (!gallery)
    void portraits
      .build(ctx.renderer, palette, toon, [
        ...roster(faction).map((h) => h.unitType),
        ...factionDef(faction).trains,
        UnitTypeId.Worker,
      ])
      .then(() => {
        bar?.invalidate();
        radial?.invalidate();
      })
      .catch((e) => console.warn('Portreler üretilemedi:', e));
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
      bannerCarriers.update(units, now);
      // Serbest yapılar seçilebilsin: konumlarını slot işaretçisine ek slot olarak ver.
      if (world.slots && structures) {
        world.slots.extra.clear();
        for (const st of structures.bySlot.values())
          if (st.free && st.team === 0)
            world.slots.extra.set(st.slot, {
              x: st.x,
              y: st.y,
              z: st.z,
              r: BUILD_RADIUS[BUILDING_KINDS[st.kind] ?? 'arrow_tower'],
            });
      }
      levelUps.check(mi);
      audioTick(mi);
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
    spellShow.update(dt);
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
      spellShow,
      groundY: ground.sample,
      bannerCarriers,
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
      portraits,
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
