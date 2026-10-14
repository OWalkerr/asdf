import {
  BUILDING_DEFS,
  BUILDING_KINDS,
  BUILDING_LEVEL,
  DAMAGE_TYPES,
  ECONOMY,
  type Fx,
  fxFromFloat,
  fxLen,
  MatchState,
  SLOT_BUILDS,
  UPGRADE_DEFS,
} from '@bulwark/shared';
import { addComponent, addEntity, entityExists, hasComponent, query, removeEntity } from 'bitecs';
import { QUEUE_STRIDE, StructureKind } from '../components';
import { SIM_HZ } from '../constants';
import { STAT } from '../unitStats';
import type { SimWorld } from '../world';
import { arrowDmgType, fireProjectile, fireStone } from './combat';
import { spawnBattalion } from './commands';
import { treasuryIncome } from './fortress';
import { forEachMember } from './spatial';

/**
 * Ekonomi ve yapılar (GDD §4, §5.1):
 * - Pasif gelir: tick başına tamsayı birikim (5 altın/sn = her 4 tick'te 1).
 * - İnşa: slot türüne izinli bina, altın düşülür, inşa süresi sayılır.
 * - Okçu kulesi: menzildeki en yakın düşman taburundan rastgele askerlere yaylım.
 * - Kışla: kuyruktaki taburları sırayla yetiştirir, binanın önünde çıkarır.
 */
const REPAIR_TICKS = Math.round(ECONOMY.repairTime * SIM_HZ);

const INCOME_EVERY = Math.max(1, Math.round(SIM_HZ / ECONOMY.income));
/** Yetişen taburun çıktığı nokta: binanın güneyinde (sura doğru) bu kadar ötede. */
const RALLY_OFFSET: Fx = fxFromFloat(9);
const FACE_SOUTH = 16384;

const TOWER = BUILDING_DEFS.arrow_tower.attack as NonNullable<typeof BUILDING_DEFS.arrow_tower.attack>;
const TOWER_RANGE: Fx = fxFromFloat(TOWER.range);
const TOWER_INTERVAL = Math.round(TOWER.interval * SIM_HZ);
const TOWER_RANGE_STEP: Fx = fxFromFloat(BUILDING_LEVEL.towerRange);
const TOWER_DMG_TYPE = DAMAGE_TYPES.indexOf(TOWER.damageType);
const CATA = BUILDING_DEFS.catapult.attack as NonNullable<typeof BUILDING_DEFS.catapult.attack>;
const CATA_RANGE: Fx = fxFromFloat(CATA.range);
const CATA_AOE: Fx = fxFromFloat(CATA.aoe ?? 4);
const CATA_INTERVAL = Math.round(CATA.interval * SIM_HZ);
const CATA_DMG_TYPE = DAMAGE_TYPES.indexOf(CATA.damageType);

export const economySystem = (world: SimWorld): void => {
  if (!world.map || world.match.state !== MatchState.Playing) return;
  if (world.tick % INCOME_EVERY === 0) world.match.gold[0] = (world.match.gold[0] as number) + 1;
  treasuryIncome(world);
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
  Structure.level[e] = 1;
  Structure.invested[e] = def.cost;
  world.match.slots[slotIndex] = e;
  return e;
};

const UPGRADE_TICKS = Math.round(BUILDING_LEVEL.upgradeTime * SIM_HZ);

/** Oyuncunun inşa ettiği (kapı/kale olmayan) ve hâlâ var olan yapı mı. */
export const isBuilding = (world: SimWorld, e: number): boolean => {
  if (!Number.isInteger(e) || e <= 0 || !entityExists(world, e) || !hasComponent(world, e, world.c.Structure))
    return false;
  const kind = world.c.Structure.kind[e] as number;
  return kind !== StructureKind.Gate && kind !== StructureKind.Fortress && kind !== StructureKind.Ladder;
};

/** Seviye çarpanı: taban × (100 + pct·(seviye−1)) / 100. */
const lvl = (world: SimWorld, e: number): number => Math.max(1, world.c.Structure.level[e] as number) - 1;

/** Kışla seviyesine göre yetiştirme süresi (−%20 / seviye). */
const trainTicksAt = (world: SimWorld, e: number, unitType: number): number =>
  Math.max(
    1,
    (((STAT.trainTicks[unitType] as number) * (100 - BUILDING_LEVEL.trainTimePercent * lvl(world, e))) /
      100) |
      0,
  );

/**
 * Bina yükseltme (BFME2 seviyeleri): kule, mancınık ve kışla 3 seviyeye kadar; yükseltme
 * süresince bina devre dışıdır (buildLeft). Her seviye +%25 azami can.
 */
export const upgradeBuilding = (world: SimWorld, team: number, building: number): boolean => {
  const { Structure, Team } = world.c;
  if (world.match.state !== MatchState.Playing || !isBuilding(world, building)) return false;
  if (Team.id[building] !== team || (Structure.buildLeft[building] as number) > 0) return false;
  if ((Structure.hp[building] as number) <= 0) return false;
  const kind = BUILDING_KINDS[(Structure.kind[building] as number) - 1];
  const def = kind ? BUILDING_DEFS[kind] : undefined;
  const level = Structure.level[building] as number;
  const cost = def?.levelCosts?.[level - 1];
  if (!def || cost === undefined || level >= BUILDING_LEVEL.max) return false;
  if ((world.match.gold[team] as number) < cost) return false;
  world.match.gold[team] = (world.match.gold[team] as number) - cost;
  const extra = ((def.hp * BUILDING_LEVEL.hpPercent) / 100) | 0;
  Structure.level[building] = level + 1;
  Structure.max[building] = (Structure.max[building] as number) + extra;
  Structure.hp[building] = (Structure.hp[building] as number) + extra;
  Structure.invested[building] = (Structure.invested[building] as number) + cost;
  Structure.buildLeft[building] = UPGRADE_TICKS;
  return true;
};

/** Yapıyı kaldırır: slotu boşaltır, süren araştırmayı iptal eder. */
const removeBuilding = (world: SimWorld, e: number): void => {
  const { Structure, Team } = world.c;
  const m = world.match;
  const slot = Structure.slot[e] as number;
  if (slot >= 0 && m.slots[slot] === e) m.slots[slot] = 0;
  if ((Structure.kind[e] as number) === StructureKind.Forge && (Structure.qLen[e] as number) > 0) {
    const team = Team.id[e] as number;
    m.researching[team] =
      (m.researching[team] as number) & ~(1 << (Structure.queue[e * QUEUE_STRIDE] as number));
  }
  Structure.hp[e] = 0;
  Structure.qLen[e] = 0;
  Structure.kind[e] = 0;
  removeEntity(world, e);
};

/** Satış: yatırılan altının %50'si iade, slot boşalır. */
export const sellBuilding = (world: SimWorld, team: number, building: number): boolean => {
  const { Structure, Team } = world.c;
  if (world.match.state !== MatchState.Playing || !isBuilding(world, building)) return false;
  if (Team.id[building] !== team || (Structure.hp[building] as number) <= 0) return false;
  const refund = (((Structure.invested[building] as number) * BUILDING_LEVEL.sellRefundPercent) / 100) | 0;
  world.match.gold[team] = (world.match.gold[team] as number) + refund;
  removeBuilding(world, building);
  return true;
};

/** Araştırma komutu: geçerliyse demirhane kuyruğuna (tek iş) alır. */
export const researchUpgrade = (
  world: SimWorld,
  team: number,
  building: number,
  upgrade: number,
): boolean => {
  const { Structure, Team } = world.c;
  const m = world.match;
  if (!Number.isInteger(building) || building <= 0 || !entityExists(world, building)) return false;
  if (!hasComponent(world, building, Structure) || Team.id[building] !== team) return false;
  if (Structure.kind[building] !== StructureKind.Forge || (Structure.buildLeft[building] as number) > 0)
    return false;
  const def = UPGRADE_DEFS[upgrade];
  if (!def || !Number.isInteger(upgrade) || (Structure.qLen[building] as number) > 0) return false;
  const bit = 1 << upgrade;
  if (((m.upgrades[team] as number) | (m.researching[team] as number)) & bit) return false;
  if ((m.gold[team] as number) < def.cost) return false;
  m.gold[team] = (m.gold[team] as number) - def.cost;
  m.researching[team] = (m.researching[team] as number) | bit;
  Structure.queue[building * QUEUE_STRIDE] = upgrade;
  Structure.qLen[building] = 1;
  Structure.qProgress[building] = Math.round(def.researchTime * SIM_HZ);
  return true;
};

/** Onarım komutu: kapı ayakta, hasarlı ve onarılmıyorsa altın karşılığı onarım başlatır. */
export const repairGate = (world: SimWorld, team: number, gateIndex: number): boolean => {
  const m = world.match;
  const g = m.gates[gateIndex];
  if (g === undefined || m.state !== MatchState.Playing) return false;
  const { Structure, Team } = world.c;
  if (Team.id[g] !== team || (Structure.hp[g] as number) <= 0) return false;
  if ((Structure.hp[g] as number) >= (Structure.max[g] as number) || (Structure.buildLeft[g] as number) > 0)
    return false;
  if ((m.gold[team] as number) < ECONOMY.repairCost) return false;
  m.gold[team] = (m.gold[team] as number) - ECONOMY.repairCost;
  Structure.buildLeft[g] = REPAIR_TICKS;
  return true;
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
  if (len === 0) Structure.qProgress[building] = trainTicksAt(world, building, unitType);
  Structure.qLen[building] = len + 1;
  return true;
};

export const structureSystem = (world: SimWorld): void => {
  const { Structure, Position, Team, Battalion } = world.c;
  const ruined: number[] = [];
  for (const e of query(world, [Structure, Position])) {
    const kind = Structure.kind[e] as number;
    if (kind === StructureKind.Fortress || kind === StructureKind.Ladder) continue; // fortressSystem / ladderSystem
    if (kind === StructureKind.Gate) {
      // Onarım: kalan süre boyunca her tick max·oran/süre (tamsayı, son tick'te kalan pay).
      const left = Structure.buildLeft[e] as number;
      if (left > 0 && (Structure.hp[e] as number) > 0) {
        const total = ((Structure.max[e] as number) * ECONOMY.repairPercent) / 100;
        const done = ((total * (REPAIR_TICKS - left + 1)) / REPAIR_TICKS) | 0;
        const prev = ((total * (REPAIR_TICKS - left)) / REPAIR_TICKS) | 0;
        Structure.hp[e] = Math.min(Structure.max[e] as number, (Structure.hp[e] as number) + done - prev);
        Structure.buildLeft[e] = left - 1;
      }
      continue;
    }
    if ((Structure.hp[e] as number) <= 0) {
      ruined.push(e); // yıkıldı: slot yeniden inşaya açılır
      continue;
    }
    if ((Structure.buildLeft[e] as number) > 0) {
      Structure.buildLeft[e] = (Structure.buildLeft[e] as number) - 1;
      continue;
    }
    const team = Team.id[e] as number;
    const up = lvl(world, e);
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
      let best = (TOWER_RANGE + up * TOWER_RANGE_STEP) | 0;
      for (const b of query(world, [Battalion, Position])) {
        if (Team.id[b] === team || (Battalion.count[b] as number) === 0) continue;
        const d = fxLen(((Position.x[b] as number) - x) | 0, ((Position.z[b] as number) - z) | 0);
        if (d < best || (d === best && b < target)) {
          best = d;
          target = b;
        }
      }
      if (target === 0) {
        // Boşta: menzildeki kuşatma merdivenine ok.
        let lad = 0;
        let ld = (TOWER_RANGE + up * TOWER_RANGE_STEP) | 0;
        for (const l of world.match.ladders) {
          const d = fxLen(((Position.x[l.eid] as number) - x) | 0, ((Position.z[l.eid] as number) - z) | 0);
          if (d < ld) {
            ld = d;
            lad = l.eid;
          }
        }
        if (lad !== 0) {
          for (let v = 0; v < TOWER.volley; v++)
            fireProjectile(
              world,
              x,
              z,
              lad,
              TOWER.damage,
              arrowDmgType(world, team, TOWER_DMG_TYPE),
              Structure.height[e] as number,
            );
          Structure.cooldown[e] = TOWER_INTERVAL + world.rng.nextInt(4);
        }
        continue;
      }
      const n = Battalion.count[target] as number;
      const dmg = ((TOWER.damage * (100 + BUILDING_LEVEL.towerDamagePercent * up)) / 100) | 0;
      for (let v = 0; v < TOWER.volley + BUILDING_LEVEL.towerVolley * up; v++) {
        let pick = world.rng.nextInt(n);
        let victim = 0;
        forEachMember(world, target, (m) => {
          if (pick-- === 0) victim = m;
        });
        if (victim !== 0)
          fireProjectile(
            world,
            x,
            z,
            victim,
            dmg,
            arrowDmgType(world, team, TOWER_DMG_TYPE),
            Structure.height[e] as number,
          );
      }
      Structure.cooldown[e] = TOWER_INTERVAL + world.rng.nextInt(4);
      continue;
    }
    if (kind === StructureKind.Catapult) {
      const cd = Structure.cooldown[e] as number;
      if (cd > 0) {
        Structure.cooldown[e] = cd - 1;
        continue;
      }
      let target = 0;
      let best = CATA_RANGE;
      for (const b of query(world, [Battalion, Position])) {
        if (Team.id[b] === team || (Battalion.count[b] as number) === 0) continue;
        const d = fxLen(((Position.x[b] as number) - x) | 0, ((Position.z[b] as number) - z) | 0);
        if (d < best || (d === best && b < target)) {
          best = d;
          target = b;
        }
      }
      if (target === 0) continue;
      fireStone(
        world,
        x,
        z,
        Position.x[target] as number,
        Position.z[target] as number,
        ((CATA.damage * (100 + BUILDING_LEVEL.catapultDamagePercent * up)) / 100) | 0,
        CATA_DMG_TYPE,
        (Structure.height[e] as number) + 200,
        CATA_AOE,
        team,
      );
      Structure.cooldown[e] =
        (((CATA_INTERVAL * (100 - BUILDING_LEVEL.catapultIntervalPercent * up)) / 100) | 0) +
        world.rng.nextInt(6);
      continue;
    }
    if (kind === StructureKind.Forge && (Structure.qLen[e] as number) > 0) {
      const left = (Structure.qProgress[e] as number) - 1;
      Structure.qProgress[e] = Math.max(0, left);
      if (left > 0) continue;
      const bit = 1 << (Structure.queue[e * QUEUE_STRIDE] as number);
      world.match.upgrades[team] = (world.match.upgrades[team] as number) | bit;
      world.match.researching[team] = (world.match.researching[team] as number) & ~bit;
      Structure.qLen[e] = 0;
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
      Structure.qProgress[e] = len > 0 ? trainTicksAt(world, e, Structure.queue[base] as number) : 0;
    }
  }
  for (const e of ruined) removeBuilding(world, e);
};
