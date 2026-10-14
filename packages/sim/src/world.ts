import { FX_ONE, fxDiv, HASH_SEED, hashInt, type MapDef, MatchState, Rng } from '@bulwark/shared';
import { createWorld, query, type World } from 'bitecs';
import { type Components, createComponents } from './components';
import { MAX_ENTITIES, SIM_HZ } from './constants';
import { FlowFieldCache } from './nav/flowField';
import { createOpenGrid, type NavGrid } from './nav/grid';
import {
  battalionSpacingSystem,
  battalionSystem,
  engagementSystem,
  formationSystem,
} from './systems/battalion';
import { combatSystem, projectileSystem } from './systems/combat';
import { deathSystem } from './systems/death';
import { enemyAiSystem, matchSystem, setupMatch, waveSystem } from './systems/match';
import { movementSystem } from './systems/movement';
import { animStateSystem, moveToTargetSystem } from './systems/moveToTarget';
import { separationSystem } from './systems/separation';
import { spatialSystem } from './systems/spatial';
import { economySystem, structureSystem } from './systems/structures';

/** Dalga programının düzleştirilmiş hali (tick sırasına göre). */
export interface ScheduledGroup {
  tick: number;
  wave: number;
  spawn: number;
  unitType: number;
  battalions: number;
}

export interface MatchContext {
  state: number;
  /** Başlamış son dalga (1 tabanlı; 0 = henüz yok). */
  waveIndex: number;
  waveCount: number;
  schedule: ScheduledGroup[];
  nextGroup: number;
  /** MapDef.gates sırasıyla kapı entity'leri. */
  gates: number[];
  enemiesAlive: number;
  /** Oyuncu başına altın (GDD §5.1). */
  gold: Int32Array;
  /** MapDef.slots sırasıyla inşa edilmiş yapı eid'i (0 = boş). */
  slots: Int32Array;
}

export interface SimContext {
  c: Components;
  tick: number;
  /** Bir tick'in saniye cinsinden süresi, Fx. */
  dtFx: number;
  rng: Rng;
  nav: NavGrid;
  fields: FlowFieldCache;
  map: MapDef | null;
  match: MatchContext;
  /** Tick başına kurulan uzamsal hash (nav hücresi başına bağlı liste; yalnızca canlı birimler). */
  hashHead: Int32Array;
  hashNext: Int32Array;
  /** Tabur → canlı askerler bağlı listesi (her tick yeniden kurulur). */
  memberHead: Int32Array;
  memberNext: Int32Array;
}

export type SimWorld = World<SimContext>;

/** nav verilmezse 512 m'lik açık ızgara (testler, look-dev). map verilirse kapılar ve dalgalar kurulur. */
export const createSimWorld = (
  seed: number,
  nav: NavGrid = createOpenGrid(512),
  map: MapDef | null = null,
): SimWorld => {
  const world = createWorld<SimContext>({
    c: createComponents(),
    tick: 0,
    dtFx: fxDiv(FX_ONE, SIM_HZ * FX_ONE),
    rng: new Rng(seed),
    nav,
    fields: new FlowFieldCache(nav),
    map,
    match: {
      state: MatchState.Playing,
      waveIndex: 0,
      waveCount: 0,
      schedule: [],
      nextGroup: 0,
      gates: [],
      enemiesAlive: 0,
      gold: new Int32Array(4),
      slots: new Int32Array(map?.slots.length ?? 0),
    },
    hashHead: new Int32Array(nav.cols * nav.rows),
    hashNext: new Int32Array(MAX_ENTITIES),
    memberHead: new Int32Array(MAX_ENTITIES),
    memberNext: new Int32Array(MAX_ENTITIES),
  });
  if (map) setupMatch(world, map);
  return world;
};

/**
 * Tick pipeline (GDD §13.4). Sistem sırası sabittir ve deterministiktir.
 * bitECS sorgu sırası (sparse set) aynı işlem dizisi için her istemcide aynıdır.
 */
export const stepWorld = (world: SimWorld): void => {
  waveSystem(world);
  enemyAiSystem(world);
  economySystem(world);
  spatialSystem(world);
  engagementSystem(world);
  battalionSystem(world);
  battalionSpacingSystem(world);
  formationSystem(world);
  combatSystem(world);
  structureSystem(world);
  moveToTargetSystem(world);
  separationSystem(world);
  movementSystem(world);
  projectileSystem(world);
  deathSystem(world);
  animStateSystem(world);
  matchSystem(world);
  world.tick++;
};

/** Desync tespiti için tüm simülasyon durumunun hash'i (GDD §13.6). */
export const hashWorld = (world: SimWorld): number => {
  const {
    Position,
    Velocity,
    Facing,
    Team,
    MoveTarget,
    Health,
    Anim,
    Battalion,
    Soldier,
    Combat,
    Structure,
  } = world.c;
  let h = hashInt(HASH_SEED, world.tick);
  for (const eid of query(world, [Position])) {
    h = hashInt(h, eid);
    h = hashInt(h, Position.x[eid] as number);
    h = hashInt(h, Position.z[eid] as number);
    h = hashInt(h, Velocity.x[eid] as number);
    h = hashInt(h, Velocity.z[eid] as number);
    h = hashInt(h, Facing.angle[eid] as number);
    h = hashInt(h, Team.id[eid] as number);
    h = hashInt(h, MoveTarget.active[eid] as number);
    h = hashInt(h, Health.hp[eid] as number);
    h = hashInt(h, Anim.state[eid] as number);
    h = hashInt(h, Combat.target[eid] as number);
    h = hashInt(h, Combat.cooldown[eid] as number);
  }
  for (const eid of query(world, [Battalion])) {
    h = hashInt(h, eid);
    h = hashInt(h, Battalion.active[eid] as number);
    h = hashInt(h, Battalion.goalX[eid] as number);
    h = hashInt(h, Battalion.goalZ[eid] as number);
    h = hashInt(h, Battalion.files[eid] as number);
    h = hashInt(h, Battalion.count[eid] as number);
    h = hashInt(h, Battalion.mode[eid] as number);
    h = hashInt(h, Battalion.engaged[eid] as number);
  }
  for (const eid of query(world, [Soldier])) {
    h = hashInt(h, Soldier.battalion[eid] as number);
    h = hashInt(h, Soldier.slot[eid] as number);
  }
  for (const eid of query(world, [Structure])) {
    h = hashInt(h, eid);
    h = hashInt(h, Structure.hp[eid] as number);
    h = hashInt(h, Structure.kind[eid] as number);
    h = hashInt(h, Structure.buildLeft[eid] as number);
    h = hashInt(h, Structure.qLen[eid] as number);
    h = hashInt(h, Structure.qProgress[eid] as number);
  }
  for (const g of world.match.gold) h = hashInt(h, g);
  h = hashInt(h, world.match.state);
  h = hashInt(h, world.match.nextGroup);
  for (const s of world.rng.getState()) h = hashInt(h, s);
  return h;
};
