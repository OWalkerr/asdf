import {
  AI_LEVELS,
  BUILD_RADIUS,
  BUILDING_DEFS,
  BUILDING_KINDS,
  type BuildingKind,
  FREE_BUILD,
  type Fx,
  factionDef,
  fxFromFloat,
  fxLen,
  heroRoster,
  MatchState,
  SPELL_DEFS,
  UNIT_DEFS,
} from '@bulwark/shared';
import { query } from 'bitecs';
import { BattalionMode, StructureKind } from '../components';
import { SIM_HZ } from '../constants';
import { placementError } from '../nav/placement';
import { allied } from '../team';
import { STAT } from '../unitStats';
import type { AiMemory, SimWorld } from '../world';
import { orderBattalions } from './commands';
import { fortressDoor } from './fortress';
import { castSpell, summonHero, unlockSpell } from './heroes';
import { trainUnit } from './structures';
import { constructAt, structureFootprints, trainWorker } from './workers';

/**
 * Bilgisayar rakip (BFME2 Skirmish AI): sim içinde, deterministik. Düşünme aralığında sırayla:
 * işçi, inşa sırası (kışla → çiftlik → …), kışlalarda birlik, kahraman, güç açma/kullanma ve ordu
 * yönetimi (üssü savun, yeterince büyüyünce en yakın düşman kalesine saldır).
 */

/** İnşa sırası: kış başına hedef sayılar birikimli (ör. ikinci kışla, ikinci çiftlikten sonra). */
const BUILD_ORDER: readonly BuildingKind[] = [
  'barracks',
  'farm',
  'farm',
  'barracks',
  'forge',
  'arrow_tower',
  'farm',
  'barracks',
  'arrow_tower',
  'farm',
  'catapult',
];
const KIND_INDEX = (k: BuildingKind) => BUILDING_KINDS.indexOf(k);
/** Üsse bu kadar yaklaşan düşman savunma alarmı verir. */
const DEFEND_R: Fx = fxFromFloat(48);
/** Bir hedefe bu kadar yakın taburlar "orada" sayılır. */
const NEAR: Fx = fxFromFloat(14);
const FX = 1 / 65536;
/** 16 yön (önceden hesaplanmış; sim'de trigonometri yok → her motorda aynı). */
const DIRS16: readonly (readonly [number, number])[] = [
  [1.0, 0.0],
  [0.92388, 0.382683],
  [0.707107, 0.707107],
  [0.382683, 0.92388],
  [0.0, 1.0],
  [-0.382683, 0.92388],
  [-0.707107, 0.707107],
  [-0.92388, 0.382683],
  [-1.0, 0.0],
  [-0.92388, -0.382683],
  [-0.707107, -0.707107],
  [-0.382683, -0.92388],
  [-0.0, -1.0],
  [0.382683, -0.92388],
  [0.707107, -0.707107],
  [0.92388, -0.382683],
];

const memOf = (world: SimWorld, team: number): AiMemory => {
  const m = world.match;
  let mem = m.aiMem[team];
  if (!mem) {
    // Toplanma noktası: kale kapısından harita merkezine doğru 22 m.
    const [dx, dz] = fortressDoor(world, team);
    const len = fxLen(dx, dz);
    const step = fxFromFloat(22);
    const rx = len > 0 ? (dx - (((dx / len) * step) | 0)) | 0 : dx;
    const rz = len > 0 ? (dz - (((dz / len) * step) | 0)) | 0 : dz;
    mem = { next: 0, waves: 0, rallyX: rx, rallyZ: rz, attackers: [] };
    m.aiMem[team] = mem;
  }
  return mem;
};

export const aiSystem = (world: SimWorld): void => {
  const m = world.match;
  if (!m.versus || !world.map || m.state !== MatchState.Playing) return;
  for (let t = 0; t < 4; t++) {
    const lvl = m.ai[t] as number;
    if (lvl < 0 || !m.alive[t]) continue;
    const mem = memOf(world, t);
    if (world.tick < mem.next) continue;
    const def = AI_LEVELS[lvl] ?? AI_LEVELS[1];
    // Takımlar aynı tick'te düşünmesin (yük dağılımı): takım başına kaydırma.
    mem.next = world.tick + Math.round(def.thinkSec * SIM_HZ) + t;
    think(world, t, mem, def.attackAt);
  }
};

const think = (world: SimWorld, team: number, mem: AiMemory, attackAt: number): void => {
  const m = world.match;
  const { Battalion, Structure, Team, Position } = world.c;
  const workers: number[] = [];
  const army: number[] = [];
  for (const b of query(world, [Battalion])) {
    if (Team.id[b] !== team || (Battalion.count[b] as number) === 0) continue;
    const t = Battalion.unitType[b] as number;
    if (STAT.worker[t] === 1) workers.push(b);
    else if (STAT.summoned[t] !== 1) army.push(b);
  }
  // Yapılar
  const counts = new Map<number, number>();
  const barracks: number[] = [];
  let building = false;
  for (const e of query(world, [Structure])) {
    if (Team.id[e] !== team || (Structure.hp[e] as number) <= 0) continue;
    const k = Structure.kind[e] as number;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if ((Structure.buildLeft[e] as number) > 0) building = true;
    else if (k === StructureKind.Barracks) barracks.push(e);
  }
  // 1) İşçi: en az iki (inşaat sürsün).
  if (workers.length < 2 && (m.gold[team] as number) >= FREE_BUILD.workerCost) trainWorker(world, team);
  // 2) İnşa sırası: sıradaki eksik yapı (aynı anda tek inşaat).
  if (!building && workers.length > 0) {
    const need = new Map<number, number>();
    for (const k of BUILD_ORDER) {
      const kind = KIND_INDEX(k) + 1;
      need.set(kind, (need.get(kind) ?? 0) + 1);
      if ((counts.get(kind) ?? 0) >= (need.get(kind) as number)) continue;
      if ((m.gold[team] as number) >= BUILDING_DEFS[k].cost)
        placeBuilding(world, team, workers[0] as number, k);
      break;
    }
  }
  // 3) Kışlalar: kuyruk kısa tutulur; birimler tarafın listesinden sırayla.
  const trains = factionDef(m.factions[team] as number).trains;
  barracks.forEach((e, i) => {
    if ((Structure.qLen[e] as number) >= 2 || trains.length === 0) return;
    const u = trains[(mem.waves + i + ((world.tick / SIM_HZ) | 0)) % trains.length] as number;
    trainUnit(world, team, e, u);
  });
  // 4) Kahraman: altın bolsa ilk uygun olan.
  for (const h of heroRoster(m.factions[team] as number)) {
    const cost = UNIT_DEFS[h.unitType]?.cost ?? 0;
    if ((m.gold[team] as number) >= cost + 400 && summonHero(world, team, h.unitType)) break;
  }
  // 5) Güçler: açılabilen ilk gücü aç, açık güçleri çatışmadaki düşmana kullan.
  SPELL_DEFS.some((_s, i) => unlockSpell(world, team, i));
  const target = engagedEnemy(world, team, army);
  if (target) {
    SPELL_DEFS.forEach((s, i) => {
      if (!((m.spells[team] as number) & (1 << i))) return;
      const self = s.key === 'heal' || s.key === 'rally';
      const p = self ? target.own : target.enemy;
      castSpell(world, team, i, p[0], p[1]);
    });
  }
  // 6) Ordu
  mem.attackers = mem.attackers.filter((b) => army.includes(b));
  const home = defendTarget(world, team);
  const idle = army.filter((b) => !mem.attackers.includes(b));
  if (home) {
    // Üs saldırı altında: boştaki herkes (saldırıdakiler hariç) savunmaya.
    orderBattalions(world, idle, home[0], home[1], team, BattalionMode.AttackMove);
    return;
  }
  const enemy = nearestEnemyFortress(world, team);
  if (!enemy) return;
  const fighters = idle.filter((b) => STAT.hero[Battalion.unitType[b] as number] !== 1 || idle.length > 3);
  if (fighters.length >= attackAt + Math.min(6, mem.waves * 2)) {
    mem.waves++;
    mem.attackers.push(...fighters);
    orderBattalions(world, fighters, enemy.x, enemy.z, team, BattalionMode.AttackMove);
    for (const b of fighters) Battalion.targetStructure[b] = enemy.e;
  } else {
    // Yeni birlikler toplanma noktasında beklesin.
    const loose = idle.filter(
      (b) =>
        !Battalion.active[b] &&
        !Battalion.engaged[b] &&
        fxLen(((Position.x[b] as number) - mem.rallyX) | 0, ((Position.z[b] as number) - mem.rallyZ) | 0) >
          NEAR,
    );
    orderBattalions(world, loose, mem.rallyX, mem.rallyZ, team, BattalionMode.Move);
  }
  // Durmuş saldırganlar hedefe yeniden yönelsin.
  const stalled = mem.attackers.filter((b) => !Battalion.active[b] && !Battalion.engaged[b]);
  if (stalled.length > 0) {
    orderBattalions(world, stalled, enemy.x, enemy.z, team, BattalionMode.AttackMove);
    for (const b of stalled) Battalion.targetStructure[b] = enemy.e;
  }
};

/** Kalenin çevresinde uygun bir yer arar (açı ve yarıçap taraması, deterministik). */
const placeBuilding = (world: SimWorld, team: number, worker: number, kind: BuildingKind): void => {
  const map = world.map;
  if (!map) return;
  const f = world.match.fortresses[team] as number;
  const cx = (world.c.Position.x[f] as number) * FX;
  const cz = (world.c.Position.z[f] as number) * FX;
  const r = BUILD_RADIUS[kind];
  const others = structureFootprints(world);
  // Önce harita merkezine bakan yön (cephe), sonra iki yana açılarak çevre.
  let face = 0;
  let bestDot = -Infinity;
  DIRS16.forEach(([dx, dz], i) => {
    const dot = -cx * dx - cz * dz;
    if (dot > bestDot) {
      bestDot = dot;
      face = i;
    }
  });
  for (const radius of [24, 32, 40, 48, 56]) {
    for (let k = 0; k < 16; k++) {
      const [ux, uz] = DIRS16[(face + (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) + 16) % 16] as [
        number,
        number,
      ];
      // Izgaraya oturt (1 m): her istemcide aynı tamsayı konum.
      const x = Math.round(cx + ux * radius);
      const z = Math.round(cz + uz * radius);
      if (placementError(map, world.nav, x, z, r, others) !== null) continue;
      constructAt(world, team, worker, KIND_INDEX(kind), fxFromFloat(x), fxFromFloat(z));
      return;
    }
  }
};

/** Üssün yakınındaki düşman taburunun konumu (savunma alarmı); yoksa null. */
const defendTarget = (world: SimWorld, team: number): [Fx, Fx] | null => {
  const { Battalion, Position, Team } = world.c;
  const f = world.match.fortresses[team] as number;
  const fx = Position.x[f] as number;
  const fz = Position.z[f] as number;
  let best: [Fx, Fx] | null = null;
  let bestD = DEFEND_R;
  for (const b of query(world, [Battalion, Position])) {
    if ((Battalion.count[b] as number) === 0 || allied(world, Team.id[b] as number, team)) continue;
    const d = fxLen(((Position.x[b] as number) - fx) | 0, ((Position.z[b] as number) - fz) | 0);
    if (d < bestD) {
      bestD = d;
      best = [Position.x[b] as number, Position.z[b] as number];
    }
  }
  return best;
};

/** En yakın ayakta düşman kalesi ve yaklaşma noktası (kapı önü). */
const nearestEnemyFortress = (world: SimWorld, team: number): { e: number; x: Fx; z: Fx } | null => {
  const m = world.match;
  const { Position, Structure } = world.c;
  const own = m.fortresses[team] as number;
  let best: { e: number; x: Fx; z: Fx } | null = null;
  let bestD = 0x7fffffff;
  for (let t = 0; t < 4; t++) {
    const f = m.fortresses[t] as number;
    if (!m.alive[t] || f === 0 || allied(world, t, team) || (Structure.hp[f] as number) <= 0) continue;
    const d = fxLen(
      ((Position.x[f] as number) - (Position.x[own] as number)) | 0,
      ((Position.z[f] as number) - (Position.z[own] as number)) | 0,
    );
    if (d < bestD) {
      bestD = d;
      const [x, z] = fortressDoor(world, t);
      best = { e: f, x, z };
    }
  }
  return best;
};

/** Çatışmadaki ilk tabur: kendi konumu ve karşısındaki düşman (güç hedefi). */
const engagedEnemy = (
  world: SimWorld,
  team: number,
  army: readonly number[],
): { own: [Fx, Fx]; enemy: [Fx, Fx] } | null => {
  const { Battalion, Position } = world.c;
  for (const b of army) {
    if (!Battalion.engaged[b]) continue;
    const e = Battalion.enemy[b] as number;
    if (e === 0 || (Battalion.count[e] as number) === 0) continue;
    if (allied(world, world.c.Team.id[e] as number, team)) continue;
    return {
      own: [Position.x[b] as number, Position.z[b] as number],
      enemy: [Position.x[e] as number, Position.z[e] as number],
    };
  }
  return null;
};
