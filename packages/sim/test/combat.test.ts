import {
  fxFromFloat,
  HELMS_DEEP,
  type MapDef,
  MatchState,
  type StampedCommand,
  UnitTypeId,
} from '@bulwark/shared';
import { entityExists, query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, createOpenGrid, Simulation } from '../src';

const F = fxFromFloat;
const stamp = (tick: number, player: number, seq: number, cmd: StampedCommand['cmd']): StampedCommand => ({
  tick,
  player,
  seq,
  cmd,
});
const FACE_EAST = 0;
const FACE_WEST = 32768;

const aliveOf = (sim: Simulation, team: number) =>
  [...query(sim.world, [sim.world.c.Health, sim.world.c.UnitType])].filter(
    (e) => sim.world.c.Team.id[e] === team && sim.world.c.Dead.at[e] === 0,
  ).length;

describe('yakın dövüş', () => {
  it('karşılaşan taburlar savaşır; kayıplar düşer, boşalan tabur ve cesetler temizlenir', () => {
    const sim = new Simulation(3, createOpenGrid(200));
    sim.schedule(
      stamp(0, 0, 0, {
        type: 'spawnBattalion',
        team: 0,
        unitType: UnitTypeId.UrukHai,
        x: F(-6),
        z: 0,
        count: 2,
        facing: FACE_EAST,
      }),
    );
    sim.schedule(
      stamp(0, 1, 0, {
        type: 'spawnBattalion',
        team: 1,
        unitType: UnitTypeId.OrcWarrior,
        x: F(6),
        z: 0,
        count: 1,
        facing: FACE_WEST,
      }),
    );
    sim.step();
    for (let t = 0; t < 1200 && aliveOf(sim, 1) > 0; t++) sim.step();
    expect(aliveOf(sim, 1)).toBe(0);
    expect(aliveOf(sim, 0)).toBeGreaterThan(0);
    // Uruk'lar da hasar aldı (ağır zırh + 160 can: ölmeleri gerekmez).
    const urukHp = [...query(sim.world, [sim.world.c.Health])]
      .filter((e) => sim.world.c.Team.id[e] === 0)
      .reduce((sum, e) => sum + (sim.world.c.Health.hp[e] as number), 0);
    expect(urukHp).toBeLessThan(20 * 160);
    // Düşman taburu silinmiş olmalı; cesetler 90 tick sonra temizlenir.
    const enemyBattalions = [...query(sim.world, [sim.world.c.Battalion])].filter(
      (b) => sim.world.c.Team.id[b] === 1,
    );
    expect(enemyBattalions.length).toBe(0);
    for (let t = 0; t < 100; t++) sim.step();
    const corpses = [...query(sim.world, [sim.world.c.Health])].filter((e) => sim.world.c.Dead.at[e] !== 0);
    expect(corpses.length).toBe(0);
  });

  it('kalan askerlerin yuvaları sıkıştırılır (0..n-1)', () => {
    const sim = new Simulation(4, createOpenGrid(200));
    sim.schedule(
      stamp(0, 0, 0, {
        type: 'spawnBattalion',
        team: 0,
        unitType: UnitTypeId.GondorSoldier,
        x: F(-5),
        z: 0,
        count: 1,
        facing: FACE_EAST,
      }),
    );
    sim.schedule(
      stamp(0, 1, 0, {
        type: 'spawnBattalion',
        team: 1,
        unitType: UnitTypeId.OrcWarrior,
        x: F(5),
        z: 0,
        count: 1,
        facing: FACE_WEST,
      }),
    );
    for (let t = 0; t < 400; t++) sim.step();
    for (const b of query(sim.world, [sim.world.c.Battalion])) {
      const slots = [...query(sim.world, [sim.world.c.Soldier])]
        .filter((s) => sim.world.c.Soldier.battalion[s] === b)
        .map((s) => sim.world.c.Soldier.slot[s] as number)
        .sort((a, c) => a - c);
      expect(slots).toEqual(slots.map((_, i) => i));
      expect(slots.length).toBe(sim.world.c.Battalion.count[b]);
    }
  });
});

describe('okçular', () => {
  it('menzildeki düşmana ok atar ve öldürür; oklar uçuşta görünür', () => {
    const sim = new Simulation(5, createOpenGrid(200));
    sim.schedule(
      stamp(0, 0, 0, {
        type: 'spawnBattalion',
        team: 0,
        unitType: UnitTypeId.GondorArcher,
        x: F(-14),
        z: 0,
        count: 1,
        facing: FACE_EAST,
      }),
    );
    sim.schedule(
      stamp(0, 1, 0, {
        type: 'spawnBattalion',
        team: 1,
        unitType: UnitTypeId.OrcWarrior,
        x: F(14),
        z: 0,
        count: 1,
        facing: FACE_WEST,
      }),
    );
    let maxArrows = 0;
    for (let t = 0; t < 600; t++) {
      sim.step();
      maxArrows = Math.max(maxArrows, query(sim.world, [sim.world.c.Projectile]).length);
    }
    expect(maxArrows).toBeGreaterThan(3);
    // 28 m'deki Orc'lar (yakın dövüşçü, 14 m çatışma menzili dışında) oklarla erir.
    expect(aliveOf(sim, 1)).toBeLessThan(10);
    expect(aliveOf(sim, 0)).toBe(15);
  });
});

/** Helm's Deep'in yalnızca verilen dalgalarla bir kopyası. */
const withWaves = (waves: MapDef['waves']): MapDef => ({ ...HELMS_DEEP, waves });

describe("maç (Helm's Deep)", () => {
  it('savunmasız kapı düşer → yenilgi', () => {
    const map = withWaves([
      { name: 't', groups: [{ atSec: 1, spawn: 'S_main', unitType: UnitTypeId.UrukHai, battalions: 3 }] },
    ]);
    const sim = new Simulation(6, buildNavGrid(map), map);
    const gate = sim.world.match.gates[0] as number;
    let t = 0;
    for (; t < 9000 && sim.world.match.state === MatchState.Playing; t++) sim.step();
    expect(sim.world.match.state).toBe(MatchState.Defeat);
    expect(sim.world.c.Structure.hp[gate]).toBe(0);
    expect(sim.world.match.waveIndex).toBe(1);
  }, 60_000);

  it('son dalga yok edilince → zafer', () => {
    const map = withWaves([
      { name: 't', groups: [{ atSec: 2, spawn: 'S_main', unitType: UnitTypeId.OrcWarrior, battalions: 1 }] },
    ]);
    const sim = new Simulation(7, buildNavGrid(map), map);
    // Savunucular causeway'in ayağında bekliyor.
    sim.schedule(
      stamp(0, 0, 0, {
        type: 'spawnBattalion',
        team: 0,
        unitType: UnitTypeId.UrukHai,
        x: F(12),
        z: F(120),
        count: 3,
        facing: 16384,
      }),
    );
    let t = 0;
    for (; t < 6000 && sim.world.match.state === MatchState.Playing; t++) sim.step();
    expect(sim.world.match.state).toBe(MatchState.Victory);
  }, 60_000);

  it('dalgalar programa göre çıkar ve kapıya yönelir', () => {
    const sim = new Simulation(8, buildNavGrid(HELMS_DEEP), HELMS_DEEP);
    expect(sim.world.match.waveCount).toBe(HELMS_DEEP.waves.length);
    for (let t = 0; t < 25 * 20 + 1; t++) sim.step();
    expect(sim.world.match.waveIndex).toBe(1);
    const enemies = [...query(sim.world, [sim.world.c.Battalion])].filter(
      (b) => sim.world.c.Team.id[b] === 1,
    );
    expect(enemies.length).toBe(3);
    for (const b of enemies) {
      expect(sim.world.c.Battalion.targetStructure[b]).toBe(sim.world.match.gates[0]);
      expect(entityExists(sim.world, sim.world.c.Battalion.targetStructure[b] as number)).toBe(true);
    }
  });
});

describe('düşman yapay zekâsı', () => {
  it('kapıdan uzakta boşta kalan düşman taburu kapıya yeniden yönelir', () => {
    const sim = new Simulation(4, buildNavGrid(HELMS_DEEP), HELMS_DEEP);
    for (let t = 0; t < 25 * 20 + 2; t++) sim.step();
    const { Battalion } = sim.world.c;
    const enemies = [...query(sim.world, [Battalion])].filter((b) => sim.world.c.Team.id[b] === 1);
    expect(enemies.length).toBeGreaterThan(0);
    // Taburları ovada "yerleşmiş" duruma zorla (kalabalıkta takılma benzetimi).
    for (const b of enemies) {
      Battalion.active[b] = 0;
      Battalion.mode[b] = 0;
    }
    for (let t = 0; t < 25; t++) sim.step();
    for (const b of enemies) {
      expect(Battalion.active[b]).toBe(1);
      expect(Battalion.mode[b]).toBe(2);
      expect(Battalion.targetStructure[b]).toBe(sim.world.match.gates[0]);
    }
  });
});

describe('savaşta determinizm', () => {
  it('aynı komutlarla aynı hash (yakın dövüş + oklar + ölümler)', () => {
    const run = () => {
      const sim = new Simulation(42, createOpenGrid(200));
      sim.schedule(
        stamp(0, 0, 0, {
          type: 'spawnBattalion',
          team: 0,
          unitType: UnitTypeId.GondorSoldier,
          x: F(-10),
          z: 0,
          count: 2,
          facing: FACE_EAST,
        }),
      );
      sim.schedule(
        stamp(0, 0, 1, {
          type: 'spawnBattalion',
          team: 0,
          unitType: UnitTypeId.GondorArcher,
          x: F(-25),
          z: 0,
          count: 1,
          facing: FACE_EAST,
        }),
      );
      sim.schedule(
        stamp(0, 1, 0, {
          type: 'spawnBattalion',
          team: 1,
          unitType: UnitTypeId.OrcWarrior,
          x: F(20),
          z: 0,
          count: 3,
          facing: FACE_WEST,
        }),
      );
      sim.step();
      const enemy = [...query(sim.world, [sim.world.c.Battalion])].filter(
        (b) => sim.world.c.Team.id[b] === 1,
      );
      sim.schedule(stamp(1, 1, 1, { type: 'move', units: enemy, x: F(-20), z: 0, spacing: F(1) }));
      const hashes: number[] = [];
      for (let t = 0; t < 600; t++) {
        sim.step();
        if (t % 60 === 0) hashes.push(sim.hash());
      }
      return hashes;
    };
    expect(run()).toEqual(run());
  });
});
