import { AnimState, fxDiv, fxLen, fxMul } from '@bulwark/shared';
import { query } from 'bitecs';
import type { SimWorld } from '../world';
import { ATTACK_ANIM_TICKS } from './combat';
import { MIN_MOVE_SPEED_SQ, speedSq } from './movement';

/**
 * Hedefe doğrudan yürüme (Phase 1 / Adım 5). Adım 7'de flow field + formasyon
 * steering bunun yerini alacak. Bir tick'te hedefe ulaşılabiliyorsa birim tam hedefe oturur.
 */
export const moveToTargetSystem = (world: SimWorld): void => {
  const { Position, Velocity, MoveTarget, Speed, Dead } = world.c;
  const dt = world.dtFx;
  for (const eid of query(world, [Position, Velocity, MoveTarget, Speed])) {
    if (!MoveTarget.active[eid] || Dead.at[eid] !== 0) continue;
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
  }
};

/** Hız eşiğine göre Walk/Idle geçişi (ayrışma titreşimi yürüme sayılmaz). */
export const animStateSystem = (world: SimWorld): void => {
  const { Velocity, Anim, Dead } = world.c;
  for (const eid of query(world, [Velocity, Anim])) {
    if (Dead.at[eid] !== 0) continue;
    const moving = speedSq(Velocity.x[eid] as number, Velocity.z[eid] as number) > MIN_MOVE_SPEED_SQ;
    let state = Anim.state[eid] as number;
    // Saldırı animasyonu bitince yürüme/durma durumuna dön.
    if (state === AnimState.Attack && world.tick - (Anim.startTick[eid] as number) >= ATTACK_ANIM_TICKS) {
      state = moving ? AnimState.Walk : AnimState.Idle;
      Anim.state[eid] = state;
      Anim.startTick[eid] = world.tick;
      continue;
    }
    if (moving && state === AnimState.Idle) {
      Anim.state[eid] = AnimState.Walk;
      Anim.startTick[eid] = world.tick;
    } else if (!moving && state === AnimState.Walk) {
      Anim.state[eid] = AnimState.Idle;
      Anim.startTick[eid] = world.tick;
    }
  }
};
