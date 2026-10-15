import {
  abilityReadyAt,
  bufferOffset,
  FLAG_HIT,
  G_ACTIVE,
  G_CAPACITY,
  G_PROJ_CAPACITY,
  G_PUBLISH,
  H_COUNT,
  H_CP_CAP,
  H_CP_USED,
  H_ELENDIL_UNTIL,
  H_ENEMIES_ALIVE,
  H_FORT_UP,
  H_FORTRESS,
  H_GATE_HP,
  H_GATE_MAX,
  H_GOLD,
  H_GOLD_EARNED,
  H_HERO_BUFF,
  H_HERO_READY,
  H_HERO_XP,
  H_HEROES,
  H_KILLS,
  H_LIVES,
  H_LOSSES,
  H_MATCH_STATE,
  H_NEXT_WAVE_TICK,
  H_PP,
  H_PROJ_COUNT,
  H_RALLY_UNTIL,
  H_SIM_MICROS,
  H_SPELLS,
  H_STRUCT_COUNT,
  H_TICK,
  H_UPGRADES,
  H_VERSION,
  H_WAVE_COUNT,
  H_WAVE_INDEX,
  H_WORKER_READY,
  H_WORKERS,
  H_ZONE,
  MAX_ABILITIES,
  packAnim,
  packBattalionRank,
  packFlight,
  packQueue,
  packStructKind,
  packYawTypeTeam,
  projOffset,
  SNAP_HEADER_INTS,
  SNAP_HEROES,
  SNAP_MAX_GATES,
  SNAP_MAX_STRUCTS,
  SNAP_PROJ_INTS,
  SNAP_SPELLS,
  SNAP_STRUCT_INTS,
  SNAP_UNIT_INTS,
  spellReadyAt,
  structOffset,
  UPGRADE_DEFS,
} from '@bulwark/shared';
import { query } from 'bitecs';
import { QUEUE_STRIDE, StructureKind } from './components';
import { SIM_HZ } from './constants';
import { commandPoints } from './systems/commandPoints';
import { fortressPct } from './systems/fortress';
import { nextWaveTick } from './systems/match';
import { countWorkers } from './systems/workers';
import { STAT } from './unitStats';
import type { SimWorld } from './world';

/** Bu kadar tick içinde hasar alan birim "vurulmuş" bayrağı taşır (render parıltısı). */
const HIT_FLASH_TICKS = 3;

/**
 * Render snapshot'ını aktif olmayan buffer'a yazar ve yayınlar (seqlock + double buffer).
 * Birimler (canlı + ceset), oklar ve maç durumu tek seferde yazılır.
 */
export const writeSnapshot = (world: SimWorld, view: Int32Array, simMicros = 0): number => {
  const { Position, Facing, Team, UnitType, Health, Anim, Soldier, Projectile, Structure, Battalion } =
    world.c;
  const capacity = view[G_CAPACITY] as number;
  const projCapacity = view[G_PROJ_CAPACITY] as number;
  const index = 1 - Atomics.load(view, G_ACTIVE);
  const base = bufferOffset(view, index);
  Atomics.add(view, base + H_VERSION, 1); // tek → yazılıyor
  let o = base + SNAP_HEADER_INTS;
  let count = 0;
  for (const eid of query(world, [Position, Facing, Team, UnitType])) {
    if (count >= capacity) break;
    const max = Health.max[eid] as number;
    const hp8 = max > 0 ? ((Math.max(0, Health.hp[eid] as number) * 255) / max) | 0 : 255;
    const animTick = (world.tick - (Anim.startTick[eid] as number)) & 0xff;
    const last = Health.lastHit[eid] as number;
    const flags = last !== 0 && world.tick - (last - 1) < HIT_FLASH_TICKS ? FLAG_HIT : 0;
    view[o] = eid;
    view[o + 1] = Position.x[eid] as number;
    view[o + 2] = Position.z[eid] as number;
    view[o + 3] = packYawTypeTeam(
      Facing.angle[eid] as number,
      UnitType.id[eid] as number,
      Team.id[eid] as number,
    );
    view[o + 4] = packAnim(Anim.state[eid] as number, flags, hp8, animTick);
    const bat = Soldier.battalion[eid] as number;
    view[o + 5] =
      bat !== 0
        ? packBattalionRank(
            bat,
            Battalion.rank[bat] as number,
            Battalion.stance[bat] as number,
            Battalion.banner[bat] as number,
            (Battalion.weakUntil[bat] as number) > world.tick ? 1 : 0,
            Battalion.gear[bat] as number,
            Battalion.horde[bat] as number,
            Battalion.combo[bat] as number,
          )
        : 0;
    o += SNAP_UNIT_INTS;
    count++;
  }
  let p = projOffset(view, base);
  let projCount = 0;
  for (const eid of query(world, [Projectile])) {
    if (projCount >= projCapacity) break;
    view[p] = eid;
    view[p + 1] = Projectile.fromX[eid] as number;
    view[p + 2] = Projectile.fromZ[eid] as number;
    view[p + 3] = Projectile.toX[eid] as number;
    view[p + 4] = Projectile.toZ[eid] as number;
    view[p + 5] = packFlight(Projectile.fireTick[eid] as number, Projectile.flight[eid] as number);
    view[p + 6] = (Projectile.height[eid] as number) | ((Projectile.kind[eid] as number) << 16);
    p += SNAP_PROJ_INTS;
    projCount++;
  }
  let s = structOffset(view, base);
  let structCount = 0;
  for (const eid of query(world, [Structure, Position, Team])) {
    const kind = Structure.kind[eid] as number;
    if (structCount >= SNAP_MAX_STRUCTS) continue;
    const qLen = Structure.qLen[eid] as number;
    const head = Structure.queue[eid * QUEUE_STRIDE] as number;
    const total =
      qLen === 0
        ? 1
        : kind === StructureKind.Forge
          ? Math.round((UPGRADE_DEFS[head]?.researchTime ?? 1) * SIM_HZ)
          : (STAT.trainTicks[head] as number);
    const pct =
      qLen > 0
        ? Math.min(100, Math.max(0, (100 - ((Structure.qProgress[eid] as number) * 100) / total) | 0))
        : 0;
    view[s] = eid;
    // Kapılarda slot alanı kapı indeksini taşır.
    const slot =
      kind === StructureKind.Gate ? (Structure.gateIndex[eid] as number) : (Structure.slot[eid] as number);
    view[s + 1] = packStructKind(kind, slot, Team.id[eid] as number, Structure.level[eid] as number);
    view[s + 2] = Structure.hp[eid] as number;
    view[s + 3] = Structure.max[eid] as number;
    view[s + 4] = Structure.buildLeft[eid] as number;
    view[s + 5] = packQueue(qLen, head, pct);
    view[s + 6] = world.c.Position.x[eid] as number;
    view[s + 7] = world.c.Position.z[eid] as number;
    s += SNAP_STRUCT_INTS;
    structCount++;
  }
  const m = world.match;
  view[base + H_STRUCT_COUNT] = structCount;
  view[base + H_WORKER_READY] = m.workerReady;
  view[base + H_WORKERS] = countWorkers(world, 0);
  view[base + H_GOLD] = m.gold[0] as number;
  view[base + H_FORTRESS] = m.fortress;
  view[base + H_FORT_UP] =
    (m.fortressUp[0] as number) | (((m.fortResearch[0] as number) + 1) << 8) | (fortressPct(world) << 16);
  view[base + H_LIVES] = m.lives;
  view[base + H_ZONE] = m.zone;
  view[base + H_KILLS] = m.kills;
  view[base + H_LOSSES] = m.losses;
  view[base + H_GOLD_EARNED] = m.goldEarned;
  const cp = commandPoints(world, 0);
  view[base + H_CP_USED] = cp.used;
  view[base + H_CP_CAP] = cp.cap;
  view[base + H_PP] = m.pp[0] as number;
  view[base + H_SPELLS] = m.spells[0] as number;
  for (let i = 0; i < SNAP_SPELLS; i++) view[base + spellReadyAt(i)] = m.spellReady[i] as number;
  for (let k = 0; k < SNAP_HEROES; k++) {
    const h = m.heroes[k] as number;
    view[base + H_HERO_XP + k] = h !== 0 ? (world.c.Battalion.xp[h] as number) : 0;
  }
  for (let k = 0; k < SNAP_HEROES; k++) {
    view[base + H_HEROES + k] = m.heroes[k] as number;
    view[base + H_HERO_READY + k] = m.heroReady[k] as number;
  }
  for (let k = 0; k < SNAP_HEROES; k++)
    for (let i = 0; i < MAX_ABILITIES; i++)
      view[base + abilityReadyAt(k, i)] = m.abilityReady[k * MAX_ABILITIES + i] as number;
  view[base + H_ELENDIL_UNTIL] = m.heroBuff[0] as number;
  view[base + H_HERO_BUFF] = m.heroBuff[1] as number;
  view[base + H_HERO_BUFF + 1] = m.heroBuff[2] as number;
  view[base + H_RALLY_UNTIL] = m.rallyUntil[0] as number;
  view[base + H_UPGRADES] = (m.upgrades[0] as number) | ((m.researching[0] as number) << 8);
  view[base + H_TICK] = world.tick;
  view[base + H_COUNT] = count;
  view[base + H_SIM_MICROS] = simMicros | 0;
  view[base + H_PROJ_COUNT] = projCount;
  view[base + H_MATCH_STATE] = m.state;
  view[base + H_WAVE_INDEX] = m.waveIndex;
  view[base + H_WAVE_COUNT] = m.waveCount;
  view[base + H_NEXT_WAVE_TICK] = nextWaveTick(world);
  view[base + H_ENEMIES_ALIVE] = m.enemiesAlive;
  for (let g = 0; g < SNAP_MAX_GATES; g++) {
    const gate = m.gates[g];
    view[base + H_GATE_HP + g] = gate !== undefined ? (Structure.hp[gate] as number) : 0;
    view[base + H_GATE_MAX + g] = gate !== undefined ? (Structure.max[gate] as number) : 0;
  }
  Atomics.add(view, base + H_VERSION, 1); // çift → tamam
  Atomics.store(view, G_ACTIVE, index);
  Atomics.add(view, G_PUBLISH, 1);
  return count;
};
