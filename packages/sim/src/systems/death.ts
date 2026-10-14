import { AnimState } from '@bulwark/shared';
import { entityExists, query, removeEntity } from 'bitecs';
import { STAT } from '../unitStats';
import type { SimWorld } from '../world';
import { awardXp, onBattalionRemoved } from './heroes';
import { ENEMY_TEAM } from './match';

/** Cesetlerin sahnede kaldığı süre (tick; ölüm animasyonu + yere batma). */
const CORPSE_TICKS = 90;

/**
 * Ölümler (GDD §6): hp ≤ 0 olan birim Dead olur (animasyon Die), taburundan çıkar.
 * Kayıp veren taburların yuvaları sıkıştırılır (formasyonda boşluk kalmaz); askeri kalmayan
 * tabur silinir. Cesetler CORPSE_TICKS sonra temizlenir.
 */
export const deathSystem = (world: SimWorld): void => {
  const { Health, UnitType, Dead, Anim, Velocity, Combat, Soldier, Battalion, MoveTarget, Team } = world.c;
  const affected: number[] = [];
  const units = query(world, [Health, UnitType]);
  for (const e of units) {
    const at = Dead.at[e] as number;
    if (at !== 0) {
      if (world.tick - (at - 1) > CORPSE_TICKS) {
        Dead.at[e] = 0;
        removeEntity(world, e);
      }
      continue;
    }
    if ((Health.hp[e] as number) > 0) continue;
    Dead.at[e] = world.tick + 1;
    Anim.state[e] = AnimState.Die;
    Anim.startTick[e] = world.tick;
    Velocity.x[e] = 0;
    Velocity.z[e] = 0;
    Combat.target[e] = 0;
    MoveTarget.active[e] = 0;
    const type = UnitType.id[e] as number;
    // Ödül (GDD §5.1): saldıran takımın her kaybı savunan oyuncuya altın ve Güç Puanı kazandırır.
    if (world.map && Team.id[e] === ENEMY_TEAM) {
      world.match.gold[0] = (world.match.gold[0] as number) + (STAT.bounty[type] as number);
      world.match.pp[0] = (world.match.pp[0] as number) + (STAT.ppValue[type] as number);
    }
    // XP: son vuran tabur (karşı takımdan) ölenin değeri kadar deneyim kazanır.
    const killer = Health.lastBy[e] as number;
    if (killer !== 0 && entityExists(world, killer) && Team.id[killer] !== Team.id[e])
      awardXp(world, killer, STAT.xpValue[type] as number);
    const b = Soldier.battalion[e] as number;
    if (b !== 0) {
      Soldier.battalion[e] = 0;
      Battalion.count[b] = Math.max(0, (Battalion.count[b] as number) - 1);
      if (!affected.includes(b)) affected.push(b);
    }
  }
  if (affected.length === 0) return;
  affected.sort((a, b) => a - b);
  for (const b of affected) {
    if (!entityExists(world, b)) continue;
    if ((Battalion.count[b] as number) === 0) {
      onBattalionRemoved(world, b, Team.id[b] as number);
      removeEntity(world, b);
      continue;
    }
    // Yuva sıkıştırma: canlı askerler mevcut yuva sırasıyla 0..n-1.
    const members: number[] = [];
    for (let s = world.memberHead[b] as number; s !== 0; s = world.memberNext[s] as number) {
      if (Dead.at[s] === 0 && Soldier.battalion[s] === b) members.push(s);
    }
    members.sort((a, c) => (Soldier.slot[a] as number) - (Soldier.slot[c] as number) || a - c);
    members.forEach((s, i) => {
      Soldier.slot[s] = i;
    });
  }
};
