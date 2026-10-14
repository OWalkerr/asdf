import { DIFFICULTIES, HELMS_DEEP, type MapDef, UnitTypeId } from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, Simulation } from '../src';

const nav = buildNavGrid(HELMS_DEEP);
const enemies = (sim: Simulation) =>
  [...query(sim.world, [sim.world.c.Battalion])].filter((b) => sim.world.c.Team.id[b] === 1);

describe('zorluk', () => {
  it('başlangıç altını, dalga büyüklüğü ve düşman canı zorlukla ölçeklenir', () => {
    const at = (d: number) => {
      const sim = new Simulation(2, nav, HELMS_DEEP, d);
      const gold = sim.world.match.gold[0] as number;
      for (let t = 0; t < 26 * 20; t++) sim.step();
      const bs = enemies(sim);
      const H = sim.world.c.Health;
      const orc = [...query(sim.world, [H])].find((e) => sim.world.c.Team.id[e] === 1) as number;
      return { gold, battalions: bs.length, hp: H.max[orc] as number };
    };
    const easy = at(0);
    const normal = at(1);
    const hard = at(2);
    expect([easy.gold, normal.gold, hard.gold]).toEqual(DIFFICULTIES.map((d) => d.startGold));
    expect(easy.battalions).toBeLessThan(normal.battalions + 1);
    expect(hard.battalions).toBeGreaterThan(normal.battalions);
    expect(easy.hp).toBeLessThan(normal.hp);
    expect(hard.hp).toBeGreaterThan(normal.hp);
  });

  it("geçersiz zorluk Normal'e düşer", () => {
    const sim = new Simulation(2, nav, HELMS_DEEP, 99);
    expect(sim.world.match.difficulty).toBe(1);
  });
});

describe('Lurtz', () => {
  it('boss dalgayla gelir, takımına aura kaynağı olur; ölünce aura biter', () => {
    const map: MapDef = {
      ...HELMS_DEEP,
      waves: [
        {
          name: 'boss',
          groups: [
            { atSec: 1, spawn: 'S_main', unitType: UnitTypeId.Lurtz, battalions: 1 },
            { atSec: 1, spawn: 'S_main', unitType: UnitTypeId.UrukHai, battalions: 2 },
          ],
        },
      ],
    };
    const sim = new Simulation(4, buildNavGrid(map), map);
    for (let t = 0; t < 30; t++) sim.step();
    const boss = sim.world.match.hero[1] as number;
    expect(boss).not.toBe(0);
    expect(sim.world.c.Battalion.unitType[boss]).toBe(UnitTypeId.Lurtz);
    const uruks = enemies(sim).filter((b) => sim.world.c.Battalion.unitType[b] === UnitTypeId.UrukHai);
    expect(uruks.some((b) => sim.world.c.Battalion.aura[b] === 1)).toBe(true);
    // Oyuncu boss'u çağıramaz.
    sim.world.match.gold[0] = 99999;
    sim.schedule({
      tick: sim.world.tick,
      player: 0,
      seq: 1,
      cmd: { type: 'summonHero', unitType: UnitTypeId.Lurtz },
    });
    sim.step();
    expect(sim.world.match.hero[0]).toBe(0);
    const H = sim.world.c.Health;
    for (const e of query(sim.world, [H])) if (sim.world.c.Soldier.battalion[e] === boss) H.hp[e] = 0;
    for (let t = 0; t < 10; t++) sim.step();
    expect(sim.world.match.hero[1]).toBe(0);
    expect(uruks.every((b) => sim.world.c.Battalion.aura[b] === 0)).toBe(true);
  });
});
