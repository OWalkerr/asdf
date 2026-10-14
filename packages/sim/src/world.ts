import { FX_ONE, fxDiv, HASH_SEED, hashInt, Rng } from '@bulwark/shared';
import { createWorld, query, type World } from 'bitecs';
import { type Components, createComponents } from './components';
import { SIM_HZ } from './constants';
import { movementSystem } from './systems/movement';

export interface SimContext {
  c: Components;
  tick: number;
  /** Bir tick'in saniye cinsinden süresi, Fx. */
  dtFx: number;
  rng: Rng;
}

export type SimWorld = World<SimContext>;

export const createSimWorld = (seed: number): SimWorld =>
  createWorld<SimContext>({
    c: createComponents(),
    tick: 0,
    dtFx: fxDiv(FX_ONE, SIM_HZ * FX_ONE),
    rng: new Rng(seed),
  });

/**
 * Tick pipeline (GDD §13.4). Sistem sırası sabittir; yeni sistemler buraya eklenir.
 * bitECS sorgu sırası (sparse set) aynı işlem dizisi için her istemcide aynıdır.
 */
export const stepWorld = (world: SimWorld): void => {
  movementSystem(world);
  world.tick++;
};

/** Desync tespiti için tüm simülasyon durumunun hash'i (GDD §13.6). */
export const hashWorld = (world: SimWorld): number => {
  const { Position, Velocity, Facing, Team } = world.c;
  let h = hashInt(HASH_SEED, world.tick);
  for (const eid of query(world, [Position])) {
    h = hashInt(h, eid);
    h = hashInt(h, Position.x[eid] as number);
    h = hashInt(h, Position.z[eid] as number);
    h = hashInt(h, Velocity.x[eid] as number);
    h = hashInt(h, Velocity.z[eid] as number);
    h = hashInt(h, Facing.angle[eid] as number);
    h = hashInt(h, Team.id[eid] as number);
  }
  for (const s of world.rng.getState()) h = hashInt(h, s);
  return h;
};
