import { fxFromFloat, type NavOp, type StampedCommand, UnitTypeId } from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, isBlockedAt, Simulation } from '../src';

const F = fxFromFloat;
const stamp = (tick: number, player: number, seq: number, cmd: StampedCommand['cmd']): StampedCommand => ({
  tick,
  player,
  seq,
  cmd,
});

/** 80×80 m arena; ortada kuzey-güney duvarı, güneyde ~7.5 m'lik dar geçit. */
const arena = () => {
  const ops: NavOp[] = [
    {
      op: 'open',
      shape: {
        type: 'polygon',
        points: [
          [-39, -39],
          [39, -39],
          [39, 39],
          [-39, 39],
        ],
      },
    },
    { op: 'block', shape: { type: 'capsule', a: [0, -40], b: [0, 30], halfWidth: 1.5 } },
  ];
  return buildNavGrid({ size: 80, nav: { cellSize: 2, ops } });
};

const battalions = (sim: Simulation) => [...query(sim.world, [sim.world.c.Battalion])];
const soldiersOf = (sim: Simulation, b: number) =>
  [...query(sim.world, [sim.world.c.Soldier])].filter((s) => sim.world.c.Soldier.battalion[s] === b);

describe('tabur hareketi', () => {
  it('engelin arkasındaki hedefe varır; hiçbir asker duvara girmez; askerler üst üste binmez', () => {
    const sim = new Simulation(5, arena());
    sim.schedule(
      stamp(0, 0, 0, {
        type: 'spawnBattalion',
        team: 0,
        unitType: UnitTypeId.GondorSoldier,
        x: F(-20),
        z: F(-20),
        count: 1,
        facing: 0,
      }),
    );
    sim.step();
    const [b] = battalions(sim);
    if (b === undefined) throw new Error('tabur yok');
    const soldiers = soldiersOf(sim, b);
    expect(soldiers.length).toBe(15);
    sim.schedule(stamp(sim.tick, 0, 1, { type: 'move', units: [b], x: F(20), z: F(-20), spacing: F(1) }));
    const { Position } = sim.world.c;
    for (let t = 0; t < 900; t++) {
      sim.step();
      for (const s of soldiers)
        expect(isBlockedAt(sim.world.nav, Position.x[s] as number, Position.z[s] as number)).toBe(false);
    }
    expect(sim.world.c.Battalion.active[b]).toBe(0);
    // Sancak noktası hedefte.
    expect(Math.abs((Position.x[b] as number) / 65536 - 20)).toBeLessThan(1);
    // Askerler sancağın etrafında toplanmış ve birbirinden ayrık.
    let minD = Number.POSITIVE_INFINITY;
    for (const s of soldiers) {
      const dx = ((Position.x[s] as number) - (Position.x[b] as number)) / 65536;
      const dz = ((Position.z[s] as number) - (Position.z[b] as number)) / 65536;
      expect(Math.hypot(dx, dz)).toBeLessThan(8);
      for (const o of soldiers) {
        if (o <= s) continue;
        const d = Math.hypot(
          ((Position.x[o] as number) - (Position.x[s] as number)) / 65536,
          ((Position.z[o] as number) - (Position.z[s] as number)) / 65536,
        );
        minD = Math.min(minD, d);
      }
    }
    expect(minD).toBeGreaterThan(0.6);
  });

  it('dar geçitte formasyon daralır (kolon), açıkta genişler', () => {
    const sim = new Simulation(5, arena());
    sim.schedule(
      stamp(0, 0, 0, {
        type: 'spawnBattalion',
        team: 0,
        unitType: UnitTypeId.GondorSoldier,
        x: F(-20),
        z: F(-20),
        count: 1,
        facing: 0,
      }),
    );
    sim.step();
    const [b] = battalions(sim);
    if (b === undefined) throw new Error('tabur yok');
    sim.step();
    expect(sim.world.c.Battalion.files[b]).toBe(5);
    // Geçit: duvar ucu z=31.5, harita kenarı z=39 → ~7.5 m.
    sim.world.c.Position.x[b] = 0;
    sim.world.c.Position.z[b] = F(35);
    sim.step();
    expect(sim.world.c.Battalion.files[b]).toBeLessThan(5);
  });

  it('gruplu emir: taburlar hedefte yan yana dizilir', () => {
    const sim = new Simulation(8, arena());
    sim.schedule(
      stamp(0, 0, 0, {
        type: 'spawnBattalion',
        team: 0,
        unitType: UnitTypeId.TowerGuard,
        x: F(20),
        z: F(-25),
        count: 3,
        facing: 49152,
      }),
    );
    sim.step();
    const bs = battalions(sim);
    expect(bs.length).toBe(3);
    sim.schedule(stamp(sim.tick, 0, 1, { type: 'move', units: bs, x: F(20), z: F(5), spacing: F(1) }));
    for (let t = 0; t < 500; t++) sim.step();
    const xs = bs.map((b) => (sim.world.c.Position.x[b] as number) / 65536).sort((a, c) => a - c);
    // Dik hat: z ekseninde ilerlediler → x'te aralıklı, z'de hedefte.
    expect((xs[2] as number) - (xs[0] as number)).toBeGreaterThan(10);
    for (const b of bs) expect(Math.abs((sim.world.c.Position.z[b] as number) / 65536 - 5)).toBeLessThan(1.5);
  });

  it('askere verilen emir kendi taburuna uygulanır; düşman taburu yok sayılır', () => {
    const sim = new Simulation(2, arena());
    sim.schedule(
      stamp(0, 0, 0, {
        type: 'spawnBattalion',
        team: 0,
        unitType: 0,
        x: F(-20),
        z: F(-20),
        count: 1,
        facing: 0,
      }),
    );
    sim.schedule(
      stamp(0, 1, 0, {
        type: 'spawnBattalion',
        team: 1,
        unitType: 1,
        x: F(20),
        z: F(20),
        count: 1,
        facing: 0,
      }),
    );
    sim.step();
    const [mine, theirs] = battalions(sim);
    const soldier = soldiersOf(sim, mine as number)[3] as number;
    sim.schedule(
      stamp(sim.tick, 0, 1, {
        type: 'move',
        units: [soldier, theirs as number],
        x: F(-20),
        z: F(10),
        spacing: F(1),
      }),
    );
    sim.step();
    expect(sim.world.c.Battalion.active[mine as number]).toBe(1);
    expect(sim.world.c.Battalion.active[theirs as number]).toBe(0);
  });

  it('deterministik: aynı komutlarla aynı hash', () => {
    const run = () => {
      const sim = new Simulation(42, arena());
      sim.schedule(
        stamp(0, 0, 0, {
          type: 'spawnBattalion',
          team: 0,
          unitType: 0,
          x: F(-25),
          z: F(-25),
          count: 3,
          facing: 0,
        }),
      );
      sim.schedule(
        stamp(0, 1, 0, {
          type: 'spawnBattalion',
          team: 1,
          unitType: 1,
          x: F(25),
          z: F(-25),
          count: 3,
          facing: 32768,
        }),
      );
      sim.step();
      const all = battalions(sim);
      sim.schedule(stamp(2, 0, 1, { type: 'move', units: all, x: F(25), z: F(25), spacing: F(1) }));
      sim.schedule(stamp(2, 1, 1, { type: 'move', units: all, x: F(-25), z: F(25), spacing: F(1) }));
      const hashes: number[] = [];
      for (let t = 0; t < 400; t++) {
        sim.step();
        if (t % 50 === 0) hashes.push(sim.hash());
      }
      return hashes;
    };
    expect(run()).toEqual(run());
  });
});

describe("Helm's Deep rotaları (regresyon)", () => {
  it('her spawn noktasından çıkan taburlar rota hedefine varır ve yerleşir; kimse kapalı hücreye girmez', async () => {
    const { HELMS_DEEP } = await import('@bulwark/shared');
    const grid = buildNavGrid(HELMS_DEEP);
    const sim = new Simulation(11, grid);
    const targets = new Map<number, [number, number]>();
    HELMS_DEEP.spawns.forEach((s, i) => {
      sim.schedule(
        stamp(0, 1, i, {
          type: 'spawnBattalion',
          team: 1,
          unitType: UnitTypeId.OrcWarrior,
          x: F(s.pos[0]),
          z: F(s.pos[1] - 10),
          count: 3,
          facing: 49152,
        }),
      );
    });
    sim.step();
    const all = battalions(sim);
    // Spawn sırasıyla 3'er tabur → kendi koridorunun hedefine.
    HELMS_DEEP.spawns.forEach((s, i) => {
      const lane = HELMS_DEEP.lanes.find((l) => l.id === s.lane);
      const t = lane?.points[lane.points.length - 1] as [number, number];
      const group = all.slice(i * 3, i * 3 + 3);
      for (const b of group) targets.set(b, t);
      sim.schedule(
        stamp(sim.tick, 1, 10 + i, { type: 'move', units: group, x: F(t[0]), z: F(t[1]), spacing: F(1) }),
      );
    });
    const { Position, Battalion } = sim.world.c;
    const soldiers = [...query(sim.world, [sim.world.c.Soldier])];
    for (let t = 0; t < 2400; t++) {
      sim.step();
      if (t % 20 === 0)
        for (const s of soldiers)
          expect(isBlockedAt(grid, Position.x[s] as number, Position.z[s] as number)).toBe(false);
    }
    for (const b of all) {
      const [tx, tz] = targets.get(b) as [number, number];
      const d = Math.hypot((Position.x[b] as number) / 65536 - tx, (Position.z[b] as number) / 65536 - tz);
      expect(Battalion.active[b], `tabur ${b} hâlâ yürüyor`).toBe(0);
      expect(d, `tabur ${b} hedefe uzak`).toBeLessThan(18);
    }
  }, 60_000);
});
