import {
  bufferOffset,
  G_ACTIVE,
  G_CAPACITY,
  G_PUBLISH,
  H_COUNT,
  H_SIM_MICROS,
  H_TICK,
  H_VERSION,
  packAnim,
  packYawTypeTeam,
  SNAP_HEADER_INTS,
  SNAP_UNIT_INTS,
} from '@bulwark/shared';
import { query } from 'bitecs';
import type { SimWorld } from './world';

/**
 * Render snapshot'ını aktif olmayan buffer'a yazar ve yayınlar (seqlock + double buffer).
 * Render ara değerleme için iki ardışık snapshot'ı eid ile eşler.
 */
export const writeSnapshot = (world: SimWorld, view: Int32Array, simMicros = 0): number => {
  const { Position, Facing, Team, UnitType, Health, Anim } = world.c;
  const capacity = view[G_CAPACITY] as number;
  const index = 1 - Atomics.load(view, G_ACTIVE);
  const base = bufferOffset(capacity, index);
  Atomics.add(view, base + H_VERSION, 1); // tek → yazılıyor
  let o = base + SNAP_HEADER_INTS;
  let count = 0;
  for (const eid of query(world, [Position, Facing, Team, UnitType])) {
    if (count >= capacity) break;
    const max = Health.max[eid] as number;
    const hp8 = max > 0 ? (((Health.hp[eid] as number) * 255) / max) | 0 : 255;
    const animTick = ((world.tick - (Anim.startTick[eid] as number)) & 0xff) >>> 0;
    view[o] = eid;
    view[o + 1] = Position.x[eid] as number;
    view[o + 2] = Position.z[eid] as number;
    view[o + 3] = packYawTypeTeam(
      Facing.angle[eid] as number,
      UnitType.id[eid] as number,
      Team.id[eid] as number,
    );
    view[o + 4] = packAnim(Anim.state[eid] as number, 0, hp8, animTick);
    o += SNAP_UNIT_INTS;
    count++;
  }
  view[base + H_TICK] = world.tick;
  view[base + H_COUNT] = count;
  view[base + H_SIM_MICROS] = simMicros | 0;
  Atomics.add(view, base + H_VERSION, 1); // çift → tamam
  Atomics.store(view, G_ACTIVE, index);
  Atomics.add(view, G_PUBLISH, 1);
  return count;
};
