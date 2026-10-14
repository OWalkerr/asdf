import {
  fxFromFloat,
  HELMS_DEEP,
  MAX_HEROES,
  type MapDef,
  RANK_XP,
  type StampedCommand,
  UnitTypeId,
  WIZARD_BLAST,
} from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, Simulation } from '../src';
import { awardXp } from '../src/systems/heroes';

const F = fxFromFloat;
let seq = 0;
const stamp = (tick: number, cmd: StampedCommand['cmd']): StampedCommand => ({
  tick,
  player: 0,
  seq: seq++,
  cmd,
});
const QUIET: MapDef = {
  ...HELMS_DEEP,
  garrison: [],
  waves: [
    {
      name: 'uzak',
      groups: [{ atSec: 9999, spawn: 'S_main', unitType: UnitTypeId.OrcWarrior, battalions: 1 }],
    },
  ],
};
const newSim = () => new Simulation(5, buildNavGrid(QUIET), QUIET);
const run = (sim: Simulation, n = 1) => {
  for (let i = 0; i < n; i++) sim.step();
};
const send = (sim: Simulation, cmd: StampedCommand['cmd']) => sim.schedule(stamp(sim.world.tick, cmd));
const spawn = (sim: Simulation, team: number, unitType: number, x: number, z: number) =>
  send(sim, { type: 'spawnBattalion', team, unitType, x: F(x), z: F(z), count: 1, facing: 0 });
const battalionsOf = (sim: Simulation, team: number, type: number) =>
  [...query(sim.world, [sim.world.c.Battalion])].filter(
    (b) => sim.world.c.Team.id[b] === team && sim.world.c.Battalion.unitType[b] === type,
  );
const membersHp = (sim: Simulation, b: number) => {
  const { Soldier, Health } = sim.world.c;
  return [...query(sim.world, [Soldier, Health])]
    .filter((s) => Soldier.battalion[s] === b)
    .reduce((a, s) => a + (Health.hp[s] as number), 0);
};

describe('kahraman kadrosu', () => {
  it('Aragorn, Gandalf ve Legolas aynı anda ayrı yuvalarda çağrılır', () => {
    const sim = newSim();
    sim.world.match.gold[0] = 10_000;
    for (const t of [UnitTypeId.Aragorn, UnitTypeId.Gandalf, UnitTypeId.Legolas])
      send(sim, { type: 'summonHero', unitType: t });
    run(sim);
    const h = [...sim.world.match.heroes.slice(0, MAX_HEROES)];
    expect(h.every((b) => b !== 0)).toBe(true);
    expect(new Set(h).size).toBe(3);
    expect(sim.world.match.gold[0]).toBeLessThanOrEqual(10_000 - 1200 - 2000 - 1000 + 1);
  });

  it('Asa Patlaması yakındaki düşmanlara hasar verir', () => {
    const sim = newSim();
    sim.world.match.gold[0] = 10_000;
    send(sim, { type: 'summonHero', unitType: UnitTypeId.Gandalf });
    run(sim);
    const g = sim.world.match.heroes[1] as number;
    const { Position } = sim.world.c;
    spawn(
      sim,
      1,
      UnitTypeId.UrukHai,
      (Position.x[g] as number) / 65536,
      (Position.z[g] as number) / 65536 + WIZARD_BLAST.radius / 2,
    );
    run(sim);
    const u = battalionsOf(sim, 1, UnitTypeId.UrukHai)[0] as number;
    const hp0 = membersHp(sim, u);
    send(sim, { type: 'ability', unit: g, ability: 0 });
    run(sim);
    expect(membersHp(sim, u)).toBeLessThan(hp0);
    // Bekleme: hemen ikinci kez kullanılamaz; Kudret Sözü rütbe 3 ister.
    const hp1 = membersHp(sim, u);
    send(sim, { type: 'ability', unit: g, ability: 0 });
    send(sim, { type: 'ability', unit: g, ability: 1 });
    run(sim);
    expect(membersHp(sim, u)).toBeGreaterThan(hp1 - 200);
  });

  it('Okçu Eğitimi yakındaki dost okçuları bir rütbe yükseltir', () => {
    const sim = newSim();
    sim.world.match.gold[0] = 10_000;
    send(sim, { type: 'summonHero', unitType: UnitTypeId.Legolas });
    run(sim);
    const l = sim.world.match.heroes[2] as number;
    const { Position, Battalion } = sim.world.c;
    awardXp(sim.world, l, RANK_XP[3] as number);
    spawn(
      sim,
      0,
      UnitTypeId.GondorArcher,
      (Position.x[l] as number) / 65536 + 6,
      (Position.z[l] as number) / 65536,
    );
    run(sim);
    const a = battalionsOf(sim, 0, UnitTypeId.GondorArcher)[0] as number;
    expect(Battalion.rank[a]).toBe(1);
    send(sim, { type: 'ability', unit: l, ability: 1 });
    run(sim);
    expect(Battalion.rank[a]).toBe(2);
  });

  it('Balrog ateş aurası çevresini yakar', () => {
    const sim = newSim();
    spawn(sim, 1, UnitTypeId.Balrog, 0, 60);
    spawn(sim, 0, UnitTypeId.GondorSoldier, 0, 64);
    run(sim);
    const s = battalionsOf(sim, 0, UnitTypeId.GondorSoldier)[0] as number;
    const hp0 = membersHp(sim, s);
    run(sim, 25);
    expect(membersHp(sim, s)).toBeLessThan(hp0);
  });
});
