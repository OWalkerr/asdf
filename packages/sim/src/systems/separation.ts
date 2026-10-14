import { type Fx, fxFromFloat, isqrt } from '@bulwark/shared';
import { query } from 'bitecs';
import { MAX_ENTITIES } from '../constants';
import { cellAt } from '../nav/grid';
import type { SimWorld } from '../world';

/**
 * Ayrışma / yumuşak çarpışma (GDD §2.4 katman 3): askerler birbirinin içinden geçmez.
 * Uzamsal hash = nav ızgarası (2 m hücre); yalnızca 3×3 komşu hücre taranır.
 * Itmeler önce biriktirilir, sonra uygulanır → sonuç sorgu sırasından bağımsızdır.
 * Tamamen tamsayı: mesafe karesi < 2^53, karekök kesin (isqrt).
 */
const RADIUS: Fx = fxFromFloat(0.8);
const RADIUS_SQ = RADIUS * RADIUS;
/** İtme kazancı: örtüşme (m) başına m/s. */
const GAIN = 6;

let head = new Int32Array(0);
const next = new Int32Array(MAX_ENTITIES);
const pushX = new Int32Array(MAX_ENTITIES);
const pushZ = new Int32Array(MAX_ENTITIES);
const units: number[] = [];

export const separationSystem = (world: SimWorld): void => {
  const { Position, Velocity, UnitType } = world.c;
  const grid = world.nav;
  const cells = grid.cols * grid.rows;
  if (head.length !== cells) head = new Int32Array(cells);
  head.fill(-1);
  units.length = 0;
  for (const e of query(world, [Position, Velocity, UnitType])) {
    const c = cellAt(grid, Position.x[e] as number, Position.z[e] as number);
    if (c < 0) continue;
    next[e] = head[c] as number;
    head[c] = e;
    units.push(e);
    pushX[e] = 0;
    pushZ[e] = 0;
  }
  for (const e of units) {
    const ex = Position.x[e] as number;
    const ez = Position.z[e] as number;
    const c = cellAt(grid, ex, ez);
    const c0 = c % grid.cols;
    const r0 = (c / grid.cols) | 0;
    for (let dr = -1; dr <= 1; dr++) {
      const r = r0 + dr;
      if (r < 0 || r >= grid.rows) continue;
      for (let dc = -1; dc <= 1; dc++) {
        const cc = c0 + dc;
        if (cc < 0 || cc >= grid.cols) continue;
        for (let o = head[r * grid.cols + cc] as number; o !== -1; o = next[o] as number) {
          if (o <= e) continue; // her çift bir kez
          const dx = (Position.x[o] as number) - ex;
          const dz = (Position.z[o] as number) - ez;
          if (dx >= RADIUS || dx <= -RADIUS || dz >= RADIUS || dz <= -RADIUS) continue;
          const d2 = dx * dx + dz * dz;
          if (d2 >= RADIUS_SQ) continue;
          let d = isqrt(d2);
          let nx = dx;
          let nz = dz;
          if (d === 0) {
            // Tam üst üste: eid'lerden türetilen sabit yön.
            nx = (o - e) & 1 ? RADIUS : -RADIUS;
            nz = (o + e) & 1 ? RADIUS >> 1 : -(RADIUS >> 1);
            d = RADIUS;
          }
          // İtme hızı = örtüşme · GAIN, yön = normal. (dx/d)·(R−d)·GAIN
          const px = Math.trunc((nx * (RADIUS - d) * GAIN) / d);
          const pz = Math.trunc((nz * (RADIUS - d) * GAIN) / d);
          pushX[e] = ((pushX[e] as number) - px) | 0;
          pushZ[e] = ((pushZ[e] as number) - pz) | 0;
          pushX[o] = ((pushX[o] as number) + px) | 0;
          pushZ[o] = ((pushZ[o] as number) + pz) | 0;
        }
      }
    }
  }
  for (const e of units) {
    Velocity.x[e] = ((Velocity.x[e] as number) + (pushX[e] as number)) | 0;
    Velocity.z[e] = ((Velocity.z[e] as number) + (pushZ[e] as number)) | 0;
  }
};
