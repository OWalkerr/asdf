import { type Fx, fxAtan2, fxFromFloat, fxMul } from '@bulwark/shared';
import { query } from 'bitecs';
import { isBlockedAt } from '../nav/grid';
import type { SimWorld } from '../world';

/** Bu hızın (m/s) altındaki hareket yön değiştirmez ve "yürüme" sayılmaz (itişme titreşimi). */
export const MIN_MOVE_SPEED: Fx = fxFromFloat(0.35);
export const MIN_MOVE_SPEED_SQ = MIN_MOVE_SPEED * MIN_MOVE_SPEED;

export const speedSq = (vx: number, vz: number): number => vx * vx + vz * vz;

/**
 * Hızı konuma entegre eder (Q16.16). Kapalı hücreye giriş yok: önce iki eksen birden,
 * olmazsa tek eksen boyunca kayar (duvar kenarında takılmadan ilerleme).
 * Taburların sancak noktaları kendi sisteminde hareket eder (Velocity'leri yok).
 */
export const movementSystem = (world: SimWorld): void => {
  const { Position, Velocity, Facing, Team, Dead } = world.c;
  const dt = world.dtFx;
  const grid = world.nav;
  for (const eid of query(world, [Position, Velocity])) {
    const vx = Velocity.x[eid] as number;
    const vz = Velocity.z[eid] as number;
    if ((vx === 0 && vz === 0) || Dead.at[eid] !== 0) continue;
    const team = Team.id[eid] as number;
    const x = Position.x[eid] as number;
    const z = Position.z[eid] as number;
    const nx = (x + fxMul(vx, dt)) | 0;
    const nz = (z + fxMul(vz, dt)) | 0;
    if (!isBlockedAt(grid, nx, nz, team)) {
      Position.x[eid] = nx;
      Position.z[eid] = nz;
    } else if (!isBlockedAt(grid, nx, z, team)) {
      Position.x[eid] = nx;
    } else if (!isBlockedAt(grid, x, nz, team)) {
      Position.z[eid] = nz;
    }
    if (speedSq(vx, vz) > MIN_MOVE_SPEED_SQ) Facing.angle[eid] = fxAtan2(vz, vx);
  }
};
