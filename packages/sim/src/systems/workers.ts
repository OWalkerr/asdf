import {
  BUILD_RADIUS,
  BUILDING_DEFS,
  BUILDING_KINDS,
  COMMAND_POINTS,
  FREE_BUILD,
  type Fx,
  fxDiv,
  fxFromFloat,
  fxLen,
  fxMul,
  MatchState,
  UnitTypeId,
} from '@bulwark/shared';
import { addComponent, addEntity, entityExists, hasComponent, query } from 'bitecs';
import { BattalionMode, StructureKind } from '../components';
import { SIM_HZ } from '../constants';
import { BLOCK_ALL } from '../nav/grid';
import { type Footprint, footprintCells, placementError } from '../nav/placement';
import { STAT } from '../unitStats';
import type { SimWorld } from '../world';
import { commandPoints } from './commandPoints';
import { orderBattalions, spawnBattalion } from './commands';
import { fortressDoor } from './fortress';

/**
 * İşçiler ve serbest inşa (BFME2):
 * - İşçi (tek kişilik tabur) seçilip haritada uygun bir yere yapı yerleştirilir: altın düşülür,
 *   temel atılır (taban nav'da herkese kapanır), işçi inşaata yürür.
 * - İnşaat yalnızca başında işçi varken ilerler (2+ işçi: 1.5×). Boştaki işçiler yakındaki yarım
 *   kalmış inşaata kendiliğinden yardıma gider.
 * - Kaleden yeni işçi yetiştirilir (sınırlı sayıda).
 */
const ticks = (s: number) => Math.round(s * SIM_HZ);
const REACH: Fx = fxFromFloat(FREE_BUILD.reach);
const AUTO: Fx = fxFromFloat(FREE_BUILD.autoAssign);
const FX = 1 / 65536;

const isWorker = (world: SimWorld, b: number): boolean =>
  b > 0 &&
  entityExists(world, b) &&
  hasComponent(world, b, world.c.Battalion) &&
  STAT.worker[world.c.Battalion.unitType[b] as number] === 1 &&
  (world.c.Battalion.count[b] as number) > 0;

const workersOf = (world: SimWorld, team: number): number[] => {
  const { Battalion, Team } = world.c;
  const out: number[] = [];
  for (const b of query(world, [Battalion])) if (Team.id[b] === team && isWorker(world, b)) out.push(b);
  return out;
};

export const countWorkers = (world: SimWorld, team: number): number => workersOf(world, team).length;

/** Haritadaki (serbest + slot) yapıların tabanları (yerleşim çakışma kontrolü). */
export const structureFootprints = (world: SimWorld): Footprint[] => {
  const { Structure, Position } = world.c;
  const out: Footprint[] = [];
  for (const e of query(world, [Structure, Position])) {
    const k = Structure.kind[e] as number;
    if (k === StructureKind.Gate || k === StructureKind.Fortress) continue;
    const kind = BUILDING_KINDS[k - 1];
    out.push({
      x: (Position.x[e] as number) * FX,
      z: (Position.z[e] as number) * FX,
      r: kind ? BUILD_RADIUS[kind] : (Structure.radius[e] as number) * FX,
    });
  }
  return out;
};

/** Serbest yapılar için harita slotlarından sonraki ilk boş slot indeksi (-1 = yer yok). */
const freeSlotIndex = (world: SimWorld): number => {
  const base = world.map?.slots.length ?? 0;
  const used = new Set<number>();
  const { Structure } = world.c;
  for (const e of query(world, [Structure])) used.add(Structure.slot[e] as number);
  for (let i = 0; i < FREE_BUILD.max; i++) if (!used.has(base + i)) return base + i;
  return -1;
};

/** İşçiyi yapının kendisine en yakın kenarına yürüt. */
const sendTo = (world: SimWorld, worker: number, e: number, team: number): void => {
  const { Position, Structure } = world.c;
  const sx = Position.x[e] as number;
  const sz = Position.z[e] as number;
  const dx = ((Position.x[worker] as number) - sx) | 0;
  const dz = ((Position.z[worker] as number) - sz) | 0;
  const d = fxLen(dx, dz);
  const r = ((Structure.radius[e] as number) + fxFromFloat(1.6)) | 0;
  const tx = d > 0 ? (sx + fxMul(fxDiv(dx, d), r)) | 0 : (sx + r) | 0;
  const tz = d > 0 ? (sz + fxMul(fxDiv(dz, d), r)) | 0 : sz;
  orderBattalions(world, [worker], tx, tz, team, BattalionMode.Move);
};

/** İşçiyle serbest inşa; başarılıysa yapı eid'i, değilse 0. */
export const constructAt = (
  world: SimWorld,
  team: number,
  worker: number,
  kindIndex: number,
  x: Fx,
  z: Fx,
): number => {
  const map = world.map;
  const m = world.match;
  const kind = BUILDING_KINDS[kindIndex];
  if (!map || !kind || m.state !== MatchState.Playing || !Number.isInteger(x) || !Number.isInteger(z))
    return 0;
  if (!isWorker(world, worker) || world.c.Team.id[worker] !== team) return 0;
  const def = BUILDING_DEFS[kind];
  const r = BUILD_RADIUS[kind];
  if ((m.gold[team] as number) < def.cost) return 0;
  if (placementError(map, world.nav, x * FX, z * FX, r, structureFootprints(world)) !== null) return 0;
  const slot = freeSlotIndex(world);
  if (slot < 0) return 0;
  m.gold[team] = (m.gold[team] as number) - def.cost;
  const { Position, Team, Structure } = world.c;
  const e = addEntity(world);
  for (const comp of [Position, Team, Structure]) addComponent(world, e, comp);
  Position.x[e] = x;
  Position.z[e] = z;
  Team.id[e] = team;
  Structure.kind[e] = kindIndex + 1;
  Structure.hp[e] = def.hp;
  Structure.max[e] = def.hp;
  Structure.radius[e] = fxFromFloat(r);
  Structure.gateIndex[e] = 255;
  Structure.slot[e] = slot;
  Structure.buildLeft[e] = ticks(def.buildTime);
  Structure.needsWorker[e] = 1;
  Structure.cooldown[e] = 0;
  Structure.height[e] = 600;
  Structure.qLen[e] = 0;
  Structure.qProgress[e] = 0;
  Structure.level[e] = 1;
  Structure.invested[e] = def.cost;
  // Taban herkese kapanır; akış alanları yeniden hesaplanır.
  const grid = world.nav;
  const cells = footprintCells(grid, x * FX, z * FX, r);
  m.footprints.set(e, { cells, orig: cells.map((c) => grid.blocked[c] as number) });
  for (const c of cells) grid.blocked[c] = BLOCK_ALL;
  world.fields.clear();
  sendTo(world, worker, e, team);
  return e;
};

/** Yapı kaldırılınca tabanını nav'a geri açar. */
export const releaseFootprint = (world: SimWorld, e: number): void => {
  const fp = world.match.footprints.get(e);
  if (!fp) return;
  fp.cells.forEach((c, i) => {
    world.nav.blocked[c] = fp.orig[i] as number;
  });
  world.match.footprints.delete(e);
  world.fields.clear();
};

/** Kaleden işçi yetiştir (anında kapıdan çıkar; bekleme süresi ve üst sınır var). */
export const trainWorker = (world: SimWorld, team: number): boolean => {
  const m = world.match;
  const f = m.fortresses[team] as number;
  if (m.state !== MatchState.Playing || f === 0 || world.tick < (m.workerReady[team] as number)) return false;
  if ((world.c.Structure.hp[f] as number) <= 0) return false;
  if (countWorkers(world, team) >= FREE_BUILD.maxWorkers) return false;
  if ((m.gold[team] as number) < FREE_BUILD.workerCost) return false;
  const cp = commandPoints(world, team);
  if (cp.used + COMMAND_POINTS.worker > cp.cap) return false;
  m.gold[team] = (m.gold[team] as number) - FREE_BUILD.workerCost;
  m.workerReady[team] = world.tick + ticks(FREE_BUILD.workerCooldown);
  const [x, z] = fortressDoor(world, team);
  spawnBattalion(world, team, UnitTypeId.Worker, x, z, 16384);
  return true;
};

/** İnşaat ilerlemesi (işçi başındayken) ve boştaki işçilerin yardıma gitmesi. */
export const workerSystem = (world: SimWorld): void => {
  const { Structure, Position, Team, Battalion } = world.c;
  const pending: number[] = [];
  for (const e of query(world, [Structure, Position]))
    if (Structure.needsWorker[e] === 1 && (Structure.hp[e] as number) > 0) pending.push(e);
  if (pending.length === 0) return;
  const teams = new Map<number, number[]>();
  for (const e of pending) {
    const team = Team.id[e] as number;
    let ws = teams.get(team);
    if (!ws) {
      ws = workersOf(world, team);
      teams.set(team, ws);
    }
    const ex = Position.x[e] as number;
    const ez = Position.z[e] as number;
    const reach = ((Structure.radius[e] as number) + REACH) | 0;
    let near = 0;
    for (const w of ws)
      if (fxLen(((Position.x[w] as number) - ex) | 0, ((Position.z[w] as number) - ez) | 0) <= reach) near++;
    if (near === 0) continue;
    const step = near >= 2 && world.tick % 2 === 0 ? 2 : 1;
    const left = Math.max(0, (Structure.buildLeft[e] as number) - step);
    Structure.buildLeft[e] = left;
    if (left === 0) Structure.needsWorker[e] = 0;
  }
  // Boştaki işçiler: en yakın yarım kalmış inşaata (her 10 tick).
  if (world.tick % 10 !== 0) return;
  for (const [team, ws] of teams)
    for (const w of ws) {
      if (Battalion.active[w] === 1) continue;
      const wx = Position.x[w] as number;
      const wz = Position.z[w] as number;
      let best = 0;
      let bestD = AUTO;
      for (const e of pending) {
        if (Team.id[e] !== team || Structure.needsWorker[e] !== 1) continue;
        const d = fxLen(((Position.x[e] as number) - wx) | 0, ((Position.z[e] as number) - wz) | 0);
        const edge = (d - (Structure.radius[e] as number)) | 0;
        if (edge <= REACH) {
          best = 0;
          break; // zaten bir inşaatın başında
        }
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best !== 0) sendTo(world, w, best, team);
    }
};
