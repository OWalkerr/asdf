import { AnimState, fxDiv, fxLen, fxMul } from '@bulwark/shared';
import { query } from 'bitecs';
import type { SimWorld } from '../world';

/**
 * Hedefe doğrudan yürüme (Phase 1 / Adım 5). Adım 7'de flow field + formasyon
 * steering bunun yerini alacak. Bir tick'te hedefe ulaşılabiliyorsa birim tam hedefe oturur.
 */
export const moveToTargetSystem = (world: SimWorld): void => {
  const { Position, Velocity, MoveTarget, Speed, Anim } = world.c;
  const dt = world.dtFx;
  for (const eid of query(world, [Position, Velocity, MoveTarget, Speed])) {
    if (!MoveTarget.active[eid]) continue;
    const dx = ((MoveTarget.x[eid] as number) - (Position.x[eid] as number)) | 0;
    const dz = ((MoveTarget.z[eid] as number) - (Position.z[eid] as number)) | 0;
    const dist = fxLen(dx, dz);
    const step = fxMul(Speed.value[eid] as number, dt);
    if (dist <= step) {
      Position.x[eid] = MoveTarget.x[eid] as number;
      Position.z[eid] = MoveTarget.z[eid] as number;
      Velocity.x[eid] = 0;
      Velocity.z[eid] = 0;
      MoveTarget.active[eid] = 0;
      continue;
    }
    const speed = Speed.value[eid] as number;
    Velocity.x[eid] = fxMul(fxDiv(dx, dist), speed);
    Velocity.z[eid] = fxMul(fxDiv(dz, dist), speed);
    if (Anim.state[eid] !== AnimState.Walk) {
      Anim.state[eid] = AnimState.Walk;
      Anim.startTick[eid] = world.tick;
    }
  }
};

/** Duran birimleri Idle'a çeker. */
export const animStateSystem = (world: SimWorld): void => {
  const { Velocity, Anim } = world.c;
  for (const eid of query(world, [Velocity, Anim])) {
    const moving = Velocity.x[eid] !== 0 || Velocity.z[eid] !== 0;
    if (!moving && Anim.state[eid] === AnimState.Walk) {
      Anim.state[eid] = AnimState.Idle;
      Anim.startTick[eid] = world.tick;
    }
  }
};
