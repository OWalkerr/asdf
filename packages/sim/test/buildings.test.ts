import {
  BUILDING_DEFS,
  BUILDING_LEVEL,
  fxFromFloat,
  HELMS_DEEP,
  type MapDef,
  type StampedCommand,
  UNIT_DEFS,
  UnitTypeId,
} from '@bulwark/shared';
import { entityExists, query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, Simulation } from '../src';

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
const SOCKET = 0;
const PLOT = HELMS_DEEP.slots.findIndex((s) => s.kind === 'building');
const TOWER = 0;
const BARRACKS = 1;

const newSim = () => new Simulation(7, buildNavGrid(QUIET), QUIET);
const run = (sim: Simulation, n: number) => {
  for (let i = 0; i < n; i++) sim.step();
};
const built = (sim: Simulation, slot: number, kind: number) => {
  sim.world.match.gold[0] = 99999;
  sim.schedule(stamp(sim.world.tick, { type: 'build', slot, kind }));
  run(sim, 1);
  const e = sim.world.match.slots[slot] as number;
  sim.world.c.Structure.buildLeft[e] = 0;
  return e;
};
const battalionsOf = (sim: Simulation, team: number) =>
  [...query(sim.world, [sim.world.c.Battalion])].filter((b) => sim.world.c.Team.id[b] === team);

describe('bina seviyeleri ve satış', () => {
  it('yükseltme: altın, +%25 can, süre boyunca devre dışı, en fazla 3. seviye', () => {
    const sim = newSim();
    const e = built(sim, SOCKET, TOWER);
    const { Structure } = sim.world.c;
    const max0 = Structure.max[e] as number;
    const g0 = sim.world.match.gold[0] as number;
    sim.schedule(stamp(sim.world.tick, { type: 'upgradeBuilding', building: e }));
    run(sim, 1);
    expect(Structure.level[e]).toBe(2);
    expect(Structure.max[e]).toBe(max0 + (BUILDING_DEFS.arrow_tower.hp * BUILDING_LEVEL.hpPercent) / 100);
    expect(Structure.buildLeft[e]).toBeGreaterThan(0);
    // ±1: pasif gelir 4 tick'te bir.
    expect(
      Math.abs((sim.world.match.gold[0] as number) - (g0 - (BUILDING_DEFS.arrow_tower.levelCosts?.[0] ?? 0))),
    ).toBeLessThanOrEqual(1);
    // Yükseltme sürerken ikinci yükseltme reddedilir.
    sim.schedule(stamp(sim.world.tick, { type: 'upgradeBuilding', building: e }));
    run(sim, 1);
    expect(Structure.level[e]).toBe(2);
    Structure.buildLeft[e] = 0;
    sim.schedule(stamp(sim.world.tick, { type: 'upgradeBuilding', building: e }));
    run(sim, 1);
    expect(Structure.level[e]).toBe(3);
    Structure.buildLeft[e] = 0;
    sim.schedule(stamp(sim.world.tick, { type: 'upgradeBuilding', building: e }));
    run(sim, 1);
    expect(Structure.level[e]).toBe(3);
  });

  it('demirhane yükseltilemez', () => {
    const sim = newSim();
    const e = built(sim, PLOT, 2);
    sim.schedule(stamp(sim.world.tick, { type: 'upgradeBuilding', building: e }));
    run(sim, 1);
    expect(sim.world.c.Structure.level[e]).toBe(1);
  });

  it("satış: yatırımın %50'si iade, slot boşalır", () => {
    const sim = newSim();
    const e = built(sim, PLOT, BARRACKS);
    sim.schedule(stamp(sim.world.tick, { type: 'upgradeBuilding', building: e }));
    run(sim, 1);
    const g = sim.world.match.gold[0] as number;
    sim.schedule(stamp(sim.world.tick, { type: 'sellBuilding', building: e }));
    run(sim, 1);
    const invested = BUILDING_DEFS.barracks.cost + (BUILDING_DEFS.barracks.levelCosts?.[0] ?? 0);
    expect(Math.abs((sim.world.match.gold[0] as number) - (g + invested / 2))).toBeLessThanOrEqual(1);
    expect(sim.world.match.slots[PLOT]).toBe(0);
    expect(entityExists(sim.world, e)).toBe(false);
  });

  it('yıkılan bina kaldırılır ve slot yeniden inşaya açılır', () => {
    const sim = newSim();
    const e = built(sim, SOCKET, TOWER);
    sim.world.c.Structure.hp[e] = 0;
    run(sim, 1);
    expect(sim.world.match.slots[SOCKET]).toBe(0);
    expect(entityExists(sim.world, e)).toBe(false);
    expect(built(sim, SOCKET, TOWER)).not.toBe(0);
  });
});

describe('yeni düşmanlar', () => {
  it('ork okçuları menzildeki binaya ateşli ok atar', () => {
    const sim = newSim();
    const e = built(sim, SOCKET, TOWER);
    sim.world.c.Structure.buildLeft[e] = 99999; // kule ateş etmesin
    const [sx, sz] = HELMS_DEEP.slots[SOCKET]?.pos ?? [0, 0];
    sim.schedule(
      stamp(sim.world.tick, {
        type: 'spawnBattalion',
        team: 1,
        unitType: UnitTypeId.OrcArcher,
        x: F(sx),
        z: F(sz + 18),
        count: 1,
        facing: 49152,
      }),
    );
    const hp0 = sim.world.c.Structure.hp[e] as number;
    run(sim, 120);
    expect(sim.world.c.Structure.hp[e] as number).toBeLessThan(hp0);
  });

  it('mağara trolü yarma vuruşuyla birden çok askere hasar verir', () => {
    const sim = newSim();
    sim.schedule(
      stamp(0, {
        type: 'spawnBattalion',
        team: 0,
        unitType: UnitTypeId.GondorSoldier,
        x: F(0),
        z: F(-10),
        count: 1,
        facing: 16384,
      }),
    );
    sim.schedule(
      stamp(0, {
        type: 'spawnBattalion',
        team: 1,
        unitType: UnitTypeId.CaveTroll,
        x: F(0),
        z: F(-4),
        count: 1,
        facing: 49152,
      }),
    );
    run(sim, 1);
    const { Health, Team, Soldier } = sim.world.c;
    const soldiers = [...query(sim.world, [Soldier, Health])].filter((s) => Team.id[s] === 0);
    run(sim, 60);
    const hurt = soldiers.filter((s) => (Health.hp[s] as number) < (Health.max[s] as number)).length;
    expect(hurt).toBeGreaterThanOrEqual(3);
  });

  it('FD: yakındaki yakın dövüş taburu arsadaki binaya saldırır', () => {
    const sim = newSim();
    const e = built(sim, PLOT, BARRACKS);
    const [px, pz] = HELMS_DEEP.slots[PLOT]?.pos ?? [0, 0];
    sim.schedule(
      stamp(sim.world.tick, {
        type: 'spawnBattalion',
        team: 1,
        unitType: UnitTypeId.UrukHai,
        x: F(px + 9),
        z: F(pz),
        count: 1,
        facing: 0,
      }),
    );
    run(sim, 1);
    for (const b of battalionsOf(sim, 1)) sim.world.c.Battalion.lane[b] = 1;
    const hp0 = sim.world.c.Structure.hp[e] as number;
    run(sim, 300);
    expect(sim.world.c.Structure.hp[e] as number).toBeLessThan(hp0);
  });
});

describe('maç istatistikleri', () => {
  it('öldürülen düşman, kayıp ve kazanılan altın sayılır', () => {
    const sim = newSim();
    sim.schedule(
      stamp(0, {
        type: 'spawnBattalion',
        team: 1,
        unitType: UnitTypeId.OrcWarrior,
        x: F(0),
        z: F(60),
        count: 1,
        facing: 0,
      }),
    );
    sim.schedule(
      stamp(0, {
        type: 'spawnBattalion',
        team: 0,
        unitType: UnitTypeId.GondorSoldier,
        x: F(20),
        z: F(40),
        count: 1,
        facing: 0,
      }),
    );
    run(sim, 1);
    const { Health, Soldier } = sim.world.c;
    const g0 = sim.world.match.goldEarned;
    for (const e of query(sim.world, [Soldier, Health])) Health.hp[e] = 0;
    run(sim, 1);
    expect(sim.world.match.kills).toBe(UNIT_DEFS[UnitTypeId.OrcWarrior]?.battalionSize);
    expect(sim.world.match.losses).toBe(UNIT_DEFS[UnitTypeId.GondorSoldier]?.battalionSize);
    expect(sim.world.match.goldEarned).toBeGreaterThan(g0);
  });
});
