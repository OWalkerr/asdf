import { FX_ONE, fxDiv, HASH_SEED, hashInt, Rng } from '@bulwark/shared';
import { createWorld, query, type World } from 'bitecs';
import { type Components, createComponents } from './components';
import { SIM_HZ } from './constants';
import { FlowFieldCache } from './nav/flowField';
import { createOpenGrid, type NavGrid } from './nav/grid';
import { battalionSpacingSystem, battalionSystem, formationSystem } from './systems/battalion';
import { movementSystem } from './systems/movement';
import { animStateSystem, moveToTargetSystem } from './systems/moveToTarget';
import { separationSystem } from './systems/separation';

export interface SimContext {
  c: Components;
  tick: number;
  /** Bir tick'in saniye cinsinden süresi, Fx. */
  dtFx: number;
  rng: Rng;
  nav: NavGrid;
  fields: FlowFieldCache;
}

export type SimWorld = World<SimContext>;

/** nav verilmezse 512 m'lik açık ızgara (testler, look-dev). */
export const createSimWorld = (seed: number, nav: NavGrid = createOpenGrid(512)): SimWorld =>
  createWorld<SimContext>({
    c: createComponents(),
    tick: 0,
    dtFx: fxDiv(FX_ONE, SIM_HZ * FX_ONE),
    rng: new Rng(seed),
    nav,
    fields: new FlowFieldCache(nav),
  });

/**
 * Tick pipeline (GDD §13.4). Sistem sırası sabittir; yeni sistemler buraya eklenir.
 * bitECS sorgu sırası (sparse set) aynı işlem dizisi için her istemcide aynıdır.
 */
export const stepWorld = (world: SimWorld): void => {
  battalionSystem(world);
  battalionSpacingSystem(world);
  formationSystem(world);
  moveToTargetSystem(world);
  separationSystem(world);
  movementSystem(world);
  animStateSystem(world);
  world.tick++;
};

/** Desync tespiti için tüm simülasyon durumunun hash'i (GDD §13.6). */
export const hashWorld = (world: SimWorld): number => {
  const { Position, Velocity, Facing, Team, MoveTarget, Health, Anim } = world.c;
  let h = hashInt(HASH_SEED, world.tick);
  for (const eid of query(world, [Position])) {
    h = hashInt(h, eid);
    h = hashInt(h, Position.x[eid] as number);
    h = hashInt(h, Position.z[eid] as number);
    h = hashInt(h, Velocity.x[eid] as number);
    h = hashInt(h, Velocity.z[eid] as number);
    h = hashInt(h, Facing.angle[eid] as number);
    h = hashInt(h, Team.id[eid] as number);
    h = hashInt(h, MoveTarget.x[eid] as number);
    h = hashInt(h, MoveTarget.z[eid] as number);
    h = hashInt(h, MoveTarget.active[eid] as number);
    h = hashInt(h, Health.hp[eid] as number);
    h = hashInt(h, Anim.state[eid] as number);
  }
  const { Battalion, Soldier } = world.c;
  for (const eid of query(world, [Battalion])) {
    h = hashInt(h, eid);
    h = hashInt(h, Battalion.active[eid] as number);
    h = hashInt(h, Battalion.goalX[eid] as number);
    h = hashInt(h, Battalion.goalZ[eid] as number);
    h = hashInt(h, Battalion.files[eid] as number);
    h = hashInt(h, Battalion.lagging[eid] as number);
    h = hashInt(h, Battalion.stall[eid] as number);
  }
  for (const eid of query(world, [Soldier])) {
    h = hashInt(h, Soldier.battalion[eid] as number);
    h = hashInt(h, Soldier.slot[eid] as number);
  }
  for (const s of world.rng.getState()) h = hashInt(h, s);
  return h;
};
