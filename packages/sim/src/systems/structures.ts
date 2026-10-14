import {
  BUILDING_DEFS,
  BUILDING_KINDS,
  DAMAGE_TYPES,
  ECONOMY,
  type Fx,
  fxFromFloat,
  fxLen,
  MatchState,
  SLOT_BUILDS,
} from '@bulwark/shared';
import { addComponent, addEntity, entityExists, hasComponent, query } from 'bitecs';
import { QUEUE_STRIDE, StructureKind } from '../components';
import { SIM_HZ } from '../constants';
import { STAT } from '../unitStats';
import type { SimWorld } from '../world';
import { fireProjectile } from './combat';
import { spawnBattalion } from './commands';
import { forEachMember } from './spatial';

/**
 * Ekonomi ve yapılar (GDD §4, §5.1):
 * - Pasif gelir: tick başına tamsayı birikim (5 altın/sn = her 4 tick'te 1).
 * - İnşa: slot türüne izinli bina, altın düşülür, inşa süresi sayılır.
 * - Okçu kulesi: menzildeki en yakın düşman taburundan rastgele askerlere yaylım.
 * - Kışla: kuyruktaki taburları sırayla yetiştirir, binanın önünde çıkarır.
 */
const INCOME_EVERY = Math.max(1, Math.round(SIM_HZ / ECONOMY.income));
/** Yetişen taburun çıktığı nokta: binanın güneyinde (sura doğru) bu kadar ötede. */
const RALLY_OFFSET: Fx = fxFromFloat(9);
const FACE_SOUTH = 16384;

const TOWER = BUILDING_DEFS.arrow_tower.attack as NonNullable<typeof BUILDING_DEFS.arrow_tower.attack>;
const TOWER_RANGE: Fx = fxFromFloat(TOWER.range);
const TOWER_INTERVAL = Math.round(TOWER.interval * SIM_HZ);
const TOWER_DMG_TYPE = DAMAGE_TYPES.indexOf(TOWER.damageType);

export const economySystem = (world: SimWorld): void => {
  if (!world.map || world.match.state !== MatchState.Playing) return;
  if (world.tick % INCOME_EVERY === 0) world.match.gold[0] = (world.match.gold[0] as number) + 1;
};

/** İnşa komutu: geçerliyse yapıyı kurar ve eid'ini döner, değilse 0. */
export const buildStructure = (
  world: SimWorld,
  team: number,
  slotIndex: number,
  kindIndex: number,
): number => {
  const map = world.map;
  const slot = map?.slots[slotIndex];
  const kind = BUILDING_KINDS[kindIndex];
  if (!map || !slot || !kind || world.match.state !== MatchState.Playing) return 0;
  if ((world.match.slots[slotIndex] as number) !== 0) return 0;
  if (!(SLOT_BUILDS[slot.kind] ?? []).includes(kind)) return 0;
  const def = BUILDING_DEFS[kind];
  if ((world.match.gold[team] as number) < def.cost) return 0;
  world.match.gold[team] = (world.match.gold[team] as number) - def.cost;
  const { Position, Team, Structure } = world.c;
  const e = addEntity(world);
  for (const comp of [Position, Team, Structure]) addComponent(world, e, comp);
  Position.x[e] = fxFromFloat(slot.pos[0]);
  Position.z[e] = fxFromFloat(slot.pos[1]);
  Team.id[e] = team;
  Structure.kind[e] = kindIndex + 1;
  Structure.hp[e] = def.hp;
  Structure.max[e] = def.hp;
  Structure.radius[e] = fxFromFloat(3);
  Structure.gateIndex[e] = 255;
  Structure.slot[e] = slotIndex;
  Structure.buildLeft[e] = Math.round(def.buildTime * SIM_HZ);
  Structure.cooldown[e] = 0;
  // Ok çıkışı: slot yükseltisi (sur) + kule boyu ~6 m.
  Structure.height[e] = Math.round((slot.elevation + 6) * 100);
  Structure.qLen[e] = 0;
  Structure.qProgress[e] = 0;
  world.match.slots[slotIndex] = e;
  return e;
};

/** Yetiştirme komutu: geçerliyse kuyruğa ekler. */
export const trainUnit = (world: SimWorld, team: number, building: number, unitType: number): boolean => {
  const { Structure, Team } = world.c;
  if (!Number.isInteger(building) || building <= 0 || !entityExists(world, building)) return false;
  if (!hasComponent(world, building, Structure) || Team.id[building] !== team) return false;
  if (Structure.kind[building] !== StructureKind.Barracks || (Structure.buildLeft[building] as number) > 0)
    return false;
  if (!(BUILDING_DEFS.barracks.trains ?? []).includes(unitType)) return false;
  const len = Structure.qLen[building] as number;
  const cost = STAT.cost[unitType] as number;
  if (len >= ECONOMY.queueMax || (world.match.gold[team] as number) < cost) return false;
  world.match.gold[team] = (world.match.gold[team] as number) - cost;
  Structure.queue[building * QUEUE_STRIDE + len] = unitType;
  if (len === 0) Structure.qProgress[building] = STAT.trainTicks[unitType] as number;
  Structure.qLen[building] = len + 1;
  return true;
};

export const structureSystem = (world: SimWorld): void => {
  const { Structure, Position, Team, Battalion } = world.c;
  for (const e of query(world, [Structure, Position])) {
    const kind = Structure.kind[e] as number;
    if (kind === StructureKind.Gate) continue;
    if ((Structure.buildLeft[e] as number) > 0) {
      Structure.buildLeft[e] = (Structure.buildLeft[e] as number) - 1;
      continue;
    }
    const team = Team.id[e] as number;
    const x = Position.x[e] as number;
    const z = Position.z[e] as number;
    if (kind === StructureKind.ArrowTower) {
      const cd = Structure.cooldown[e] as number;
      if (cd > 0) {
        Structure.cooldown[e] = cd - 1;
        continue;
      }
      // En yakın düşman taburu (sancak) menzilde mi.
      let target = 0;
      let best = TOWER_RANGE;
      for (const b of query(world, [Battalion, Position])) {
        if (Team.id[b] === team || (Battalion.count[b] as number) === 0) continue;
        const d = fxLen(((Position.x[b] as number) - x) | 0, ((Position.z[b] as number) - z) | 0);
        if (d < best || (d === best && b < target)) {
          best = d;
          target = b;
        }
      }
      if (target === 0) continue;
      const n = Battalion.count[target] as number;
      for (let v = 0; v < TOWER.volley; v++) {
        let pick = world.rng.nextInt(n);
        let victim = 0;
        forEachMember(world, target, (m) => {
          if (pick-- === 0) victim = m;
        });
        if (victim !== 0)
          fireProjectile(world, x, z, victim, TOWER.damage, TOWER_DMG_TYPE, Structure.height[e] as number);
      }
      Structure.cooldown[e] = TOWER_INTERVAL + world.rng.nextInt(4);
      continue;
    }
    if (kind === StructureKind.Barracks && (Structure.qLen[e] as number) > 0) {
      const left = (Structure.qProgress[e] as number) - 1;
      if (left > 0) {
        Structure.qProgress[e] = left;
        continue;
      }
      const base = e * QUEUE_STRIDE;
      const unitType = Structure.queue[base] as number;
      spawnBattalion(world, team, unitType, x, (z + RALLY_OFFSET) | 0, FACE_SOUTH);
      const len = (Structure.qLen[e] as number) - 1;
      for (let i = 0; i < len; i++) Structure.queue[base + i] = Structure.queue[base + i + 1] as number;
      Structure.qLen[e] = len;
      Structure.qProgress[e] = len > 0 ? (STAT.trainTicks[Structure.queue[base] as number] as number) : 0;
    }
  }
};
