import { fxAtan2, fxMul } from '@bulwark/shared';
import { query } from 'bitecs';
import type { SimWorld } from '../world';

/** Hızı konuma entegre eder ve yüzü hareket yönüne çevirir. */
export const movementSystem = (world: SimWorld): void => {
  const { Position, Velocity, Facing } = world.c;
  const dt = world.dtFx;
  for (const eid of query(world, [Position, Velocity])) {
    const vx = Velocity.x[eid] as number;
    const vz = Velocity.z[eid] as number;
    if (vx === 0 && vz === 0) continue;
    Position.x[eid] = ((Position.x[eid] as number) + fxMul(vx, dt)) | 0;
    Position.z[eid] = ((Position.z[eid] as number) + fxMul(vz, dt)) | 0;
    Facing.angle[eid] = fxAtan2(vz, vx);
  }
};
