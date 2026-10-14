import { FX_ONE, fxCos, fxSin } from '@bulwark/shared';
import { addComponent, addEntity, query, removeEntity } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { createSimWorld, hashWorld, type SimWorld, stepWorld } from '../src';

/** 1.000 birim, rastgele yön değişiklikleri ve entity ekleme/silme ile senaryo. */
const runScenario = (seed: number, ticks: number): { world: SimWorld; hashes: number[] } => {
  const world = createSimWorld(seed);
  const { Position, Velocity, Facing, Team } = world.c;
  const spawn = () => {
    const eid = addEntity(world);
    for (const comp of [Position, Velocity, Facing, Team]) addComponent(world, eid, comp);
    Position.x[eid] = world.rng.range(-200, 200) * FX_ONE;
    Position.z[eid] = world.rng.range(-200, 200) * FX_ONE;
    Team.id[eid] = world.rng.nextInt(2);
    return eid;
  };
  for (let i = 0; i < 1000; i++) spawn();

  const hashes: number[] = [];
  for (let t = 0; t < ticks; t++) {
    // "Komutlar": her tick 50 birime yeni yön/hız ver.
    const ents = query(world, [Velocity]);
    for (let k = 0; k < 50; k++) {
      const eid = ents[world.rng.nextInt(ents.length)] as number;
      const angle = world.rng.nextU32() & 0xffff;
      const speed = world.rng.range(1, 6);
      Velocity.x[eid] = fxCos(angle) * speed;
      Velocity.z[eid] = fxSin(angle) * speed;
    }
    // Ölüm/doğum: sparse set sırasının da deterministik kaldığını doğrular.
    if (t % 10 === 0) {
      removeEntity(world, ents[world.rng.nextInt(ents.length)] as number);
      spawn();
    }
    stepWorld(world);
    if (t % 10 === 9) hashes.push(hashWorld(world));
  }
  return { world, hashes };
};

describe('deterministik simülasyon', () => {
  it('aynı seed + aynı komutlar → her kontrol noktasında aynı hash', () => {
    const a = runScenario(1337, 400);
    const b = runScenario(1337, 400);
    expect(a.hashes).toEqual(b.hashes);
    expect(a.world.tick).toBe(400);
  });

  it('farklı seed → farklı hash', () => {
    expect(runScenario(1, 50).hashes.at(-1)).not.toBe(runScenario(2, 50).hashes.at(-1));
  });

  it('iki dünya aynı süreçte birbirini etkilemez', () => {
    const w1 = createSimWorld(5);
    const w2 = createSimWorld(5);
    expect(w1.c.Position.x).not.toBe(w2.c.Position.x);
  });
});
