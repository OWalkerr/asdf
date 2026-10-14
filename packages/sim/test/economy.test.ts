import {
  BUILDING_DEFS,
  ECONOMY,
  fxFromFloat,
  HELMS_DEEP,
  type MapDef,
  type StampedCommand,
  UnitTypeId,
} from '@bulwark/shared';
import { query } from 'bitecs';
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

/** Dalgasız Helm's Deep: ekonomi testleri savaştan bağımsız. */
const QUIET: MapDef = {
  ...HELMS_DEEP,
  waves: [
    {
      name: 'uzak',
      groups: [{ atSec: 9999, spawn: 'S_main', unitType: UnitTypeId.OrcWarrior, battalions: 1 }],
    },
  ],
};
const SOCKET = 0; // W1 (sur soketi)
const PLOT = HELMS_DEEP.slots.findIndex((s) => s.kind === 'building');
const TOWER = 0;
const BARRACKS = 1;

const newSim = (map: MapDef = QUIET, seed = 5) => new Simulation(seed, buildNavGrid(map), map);
const gold = (sim: Simulation) => sim.world.match.gold[0] as number;
const battalionsOf = (sim: Simulation, team: number) =>
  [...query(sim.world, [sim.world.c.Battalion])].filter((b) => sim.world.c.Team.id[b] === team);

describe('ekonomi', () => {
  it('başlangıç altını ve pasif gelir (5/sn)', () => {
    const sim = newSim();
    expect(gold(sim)).toBe(ECONOMY.startGold);
    for (let t = 0; t < 200; t++) sim.step();
    expect(gold(sim)).toBe(ECONOMY.startGold + 50);
  });

  it('inşa altını düşer; dolu slot, yanlış bina ve yetersiz altın reddedilir', () => {
    const sim = newSim();
    sim.schedule(stamp(0, { type: 'build', slot: SOCKET, kind: TOWER }));
    sim.schedule(stamp(0, { type: 'build', slot: SOCKET, kind: TOWER })); // dolu
    sim.schedule(stamp(0, { type: 'build', slot: SOCKET + 1, kind: BARRACKS })); // sura kışla olmaz
    sim.schedule(stamp(0, { type: 'build', slot: PLOT, kind: BARRACKS })); // 700-250 = 450 ≥ 400
    sim.schedule(stamp(0, { type: 'build', slot: PLOT + 1, kind: BARRACKS })); // 50 altın: yetmez
    sim.step();
    // Komutlar tick 0'ın başında uygulanır, ardından tick 0 geliri (+1) eklenir.
    expect(gold(sim)).toBe(
      ECONOMY.startGold - BUILDING_DEFS.arrow_tower.cost - BUILDING_DEFS.barracks.cost + 1,
    );
    expect(sim.world.match.slots[SOCKET]).not.toBe(0);
    expect(sim.world.match.slots[SOCKET + 1]).toBe(0);
    expect(sim.world.match.slots[PLOT]).not.toBe(0);
    expect(sim.world.match.slots[PLOT + 1]).toBe(0);
  });

  it('kule inşa bitince menzildeki düşmana ok atar ve öldürür; ödül altın verir', () => {
    const sim = newSim();
    sim.schedule(stamp(0, { type: 'build', slot: SOCKET, kind: TOWER }));
    const [sx, sz] = HELMS_DEEP.slots[SOCKET]?.pos ?? [0, 0];
    sim.schedule(
      stamp(0, {
        type: 'spawnBattalion',
        team: 1,
        unitType: UnitTypeId.OrcWarrior,
        x: F(sx),
        z: F(sz + 20),
        count: 1,
        facing: 0,
      }),
    );
    sim.step();
    const goldAfterBuild = gold(sim);
    const P = sim.world.c.Projectile;
    // İnşa süresince ateş yok.
    let firedEarly = false;
    for (let t = 0; t < BUILDING_DEFS.arrow_tower.buildTime * 20 - 2; t++) {
      sim.step();
      if (query(sim.world, [P]).length > 0) firedEarly = true;
    }
    expect(firedEarly).toBe(false);
    let fired = false;
    for (let t = 0; t < 1200; t++) {
      sim.step();
      for (const p of query(sim.world, [P])) if ((P.height[p] as number) > 1000) fired = true;
    }
    expect(fired).toBe(true);
    const H = sim.world.c.Health;
    const orcs = [...query(sim.world, [H])].filter(
      (e) => sim.world.c.Team.id[e] === 1 && sim.world.c.Dead.at[e] === 0,
    );
    const before = 12;
    expect(orcs.length).toBeLessThan(before);
    // Gelir + ödül: salt gelirden fazla.
    expect(gold(sim)).toBeGreaterThan(goldAfterBuild + Math.floor((sim.world.tick - 1) / 4));
  });

  it('kışla kuyruğu taburu yetiştirip binanın önünde çıkarır', () => {
    const sim = newSim();
    sim.schedule(stamp(0, { type: 'build', slot: PLOT, kind: BARRACKS }));
    sim.step();
    const barracks = sim.world.match.slots[PLOT] as number;
    // İnşa bitmeden yetiştirme reddedilir.
    sim.schedule(stamp(1, { type: 'train', building: barracks, unitType: UnitTypeId.GondorSoldier }));
    sim.step();
    expect(sim.world.c.Structure.qLen[barracks]).toBe(0);
    while ((sim.world.c.Structure.buildLeft[barracks] as number) > 0) sim.step();
    const t0 = sim.world.tick;
    sim.schedule(stamp(t0, { type: 'train', building: barracks, unitType: UnitTypeId.OrcWarrior })); // eğitilemez
    sim.schedule(stamp(t0, { type: 'train', building: barracks, unitType: UnitTypeId.GondorArcher }));
    sim.step();
    expect(sim.world.c.Structure.qLen[barracks]).toBe(1);
    const before = battalionsOf(sim, 0).length;
    for (let t = 0; t < 12 * 20 + 5; t++) sim.step();
    const after = battalionsOf(sim, 0);
    expect(after.length).toBe(before + 1);
    expect(sim.world.c.Structure.qLen[barracks]).toBe(0);
    const b = after[after.length - 1] as number;
    expect(sim.world.c.Battalion.unitType[b]).toBe(UnitTypeId.GondorArcher);
  });

  it('ekonomi + inşa deterministik', () => {
    const run = () => {
      const sim = newSim(HELMS_DEEP, 21);
      sim.schedule(stamp(0, { type: 'build', slot: SOCKET + 2, kind: TOWER }));
      sim.schedule(stamp(0, { type: 'build', slot: SOCKET + 3, kind: TOWER }));
      for (let t = 0; t < 900; t++) sim.step();
      return sim.hash();
    };
    expect(run()).toBe(run());
  });
});
