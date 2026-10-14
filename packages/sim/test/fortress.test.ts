import {
  FORTRESS_UPGRADES,
  FortressUpgrade,
  fxFromFloat,
  HELMS_DEEP,
  type MapDef,
  MatchState,
  type StampedCommand,
  UnitTypeId,
  type Vec2,
} from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { blockedFor, buildNavGrid, cellAt, Simulation } from '../src';

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
  waves: [
    {
      name: 'uzak',
      groups: [{ atSec: 9999, spawn: 'S_main', unitType: UnitTypeId.OrcWarrior, battalions: 1 }],
    },
  ],
};
const gateIdx = (id: string) => HELMS_DEEP.gates.findIndex((g) => g.id === id);

describe('kale', () => {
  it('kale yapısı kurulur; kale düşerse yenilgi, kapı düşmesi yenilgi değildir', () => {
    const sim = new Simulation(1, buildNavGrid(QUIET), QUIET);
    const S = sim.world.c.Structure;
    const f = sim.world.match.fortress;
    expect(f).not.toBe(0);
    expect(S.hp[f]).toBe(HELMS_DEEP.citadel.hp);
    S.hp[sim.world.match.gates[0] as number] = 0;
    for (let t = 0; t < 5; t++) sim.step();
    expect(sim.world.match.state).toBe(MatchState.Playing);
    S.hp[f] = 0;
    sim.step();
    expect(sim.world.match.state).toBe(MatchState.Defeat);
  });

  it('kapı kırılınca gedik yalnızca saldıranın kapalı hücrelerini açar', () => {
    const sim = new Simulation(1, buildNavGrid(QUIET), QUIET);
    const grid = sim.world.nav;
    const cell = (p: Vec2) => cellAt(grid, F(p[0]), F(p[1]));
    const gi = gateIdx('culvert');
    const gate = HELMS_DEEP.gates[gi]?.pos as Vec2;
    expect(blockedFor(grid, cell(gate), 1)).toBe(true);
    const wallBefore = grid.blocked[cell([40, -24])];
    sim.world.c.Structure.hp[sim.world.match.gates[gi] as number] = 0;
    sim.step();
    expect(blockedFor(grid, cell(gate), 1)).toBe(false);
    expect(grid.blocked[cell([40, -24])]).toBe(wallBefore); // sur sağlam
    expect(sim.world.match.breached & (1 << gi)).not.toBe(0);
  });

  it('menfez düşünce düşman arka kapıya, o da düşünce kaleye yönelir', () => {
    const sim = new Simulation(2, buildNavGrid(QUIET), QUIET);
    const S = sim.world.c.Structure;
    const m = sim.world.match;
    const lane = HELMS_DEEP.lanes.findIndex((l) => l.id === 'wall_west');
    sim.schedule(
      stamp(0, {
        type: 'spawnBattalion',
        team: 1,
        unitType: UnitTypeId.OrcWarrior,
        x: F(15),
        z: F(-10),
        count: 1,
        facing: 0,
      }),
    );
    sim.step();
    const b = [...query(sim.world, [sim.world.c.Battalion])].find(
      (x) => sim.world.c.Team.id[x] === 1,
    ) as number;
    sim.world.c.Battalion.lane[b] = lane + 1;
    for (let t = 0; t < 25; t++) sim.step();
    expect(sim.world.c.Battalion.targetStructure[b]).toBe(m.gates[gateIdx('culvert')]);
    S.hp[m.gates[gateIdx('culvert')] as number] = 0;
    for (let t = 0; t < 25; t++) sim.step();
    expect(sim.world.c.Battalion.targetStructure[b]).toBe(m.gates[gateIdx('hornburg_postern')]);
    S.hp[m.gates[gateIdx('hornburg_postern')] as number] = 0;
    for (let t = 0; t < 25; t++) sim.step();
    expect(sim.world.c.Battalion.targetStructure[b]).toBe(m.fortress);
    // Sonunda kaleye ulaşıp vurur.
    const hp0 = S.hp[m.fortress] as number;
    for (let t = 0; t < 120 * 20 && (S.hp[m.fortress] as number) === hp0; t++) sim.step();
    expect(S.hp[m.fortress] as number).toBeLessThan(hp0);
  });

  it('kale yükseltmeleri: sıralı araştırma, Taş Takviye canı artırır, ok mazgalı ateş eder', () => {
    const sim = new Simulation(3, buildNavGrid(QUIET), QUIET);
    const m = sim.world.match;
    const S = sim.world.c.Structure;
    m.gold[0] = 10_000;
    sim.schedule(stamp(0, { type: 'fortressUpgrade', upgrade: FortressUpgrade.StoneWalls }));
    sim.schedule(stamp(0, { type: 'fortressUpgrade', upgrade: FortressUpgrade.ArrowSlits })); // meşgul
    sim.step();
    expect(m.fortResearch[0]).toBe(FortressUpgrade.StoneWalls);
    for (let t = 0; t < (FORTRESS_UPGRADES[0]?.time ?? 0) * 20 + 2; t++) sim.step();
    expect(m.fortressUp[0]).toBe(1);
    expect(S.max[m.fortress]).toBe((HELMS_DEEP.citadel.hp * 3) >> 1);
    sim.schedule(stamp(sim.world.tick, { type: 'fortressUpgrade', upgrade: FortressUpgrade.ArrowSlits }));
    for (let t = 0; t < (FORTRESS_UPGRADES[1]?.time ?? 0) * 20 + 2; t++) sim.step();
    expect((m.fortressUp[0] as number) & (1 << FortressUpgrade.ArrowSlits)).not.toBe(0);
    const [dx, dz] = HELMS_DEEP.citadel.door as Vec2;
    sim.schedule(
      stamp(sim.world.tick, {
        type: 'spawnBattalion',
        team: 1,
        unitType: UnitTypeId.OrcWarrior,
        x: F(dx + 4),
        z: F(dz + 4),
        count: 1,
        facing: 0,
      }),
    );
    let fired = false;
    for (let t = 0; t < 60 && !fired; t++) {
      sim.step();
      fired = query(sim.world, [sim.world.c.Projectile]).length > 0;
    }
    expect(fired).toBe(true);
  });

  it('kahraman kalenin kapısından çıkar', () => {
    const sim = new Simulation(4, buildNavGrid(QUIET), QUIET);
    sim.world.match.gold[0] = 5000;
    sim.schedule(stamp(0, { type: 'summonHero', unitType: UnitTypeId.Aragorn }));
    sim.step();
    const h = sim.world.match.heroes[0] as number;
    const [dx, dz] = HELMS_DEEP.citadel.door as Vec2;
    expect(Math.abs((sim.world.c.Position.x[h] as number) / 65536 - dx)).toBeLessThan(3);
    expect(Math.abs((sim.world.c.Position.z[h] as number) / 65536 - dz)).toBeLessThan(3);
  });
});

describe('Tower Defense', () => {
  // 120 m düz koridor: batıdan doğuya, çıkış doğuda.
  const TD: MapDef = {
    id: 'td_test',
    name: 'TD test',
    mode: 'TD',
    size: 160,
    seed: 1,
    lives: 5,
    camera: { home: [0, 0], yaw: 0, distance: 100 },
    citadel: { id: 'base', pos: [70, 0], radius: 6, hp: 1000, door: [60, 0] },
    gates: [],
    walls: [],
    slots: [{ id: 'T1', kind: 'tower', pos: [0, 8], elevation: 0, allowed: [] }],
    spawns: [{ id: 'S', pos: [-70, 0], lane: 'road' }],
    lanes: [
      {
        id: 'road',
        points: [
          [-70, 0],
          [66, 0],
        ],
        target: 'exit',
      },
    ],
    terrain: { plateaus: [], ramps: [] },
    nav: {
      cellSize: 2,
      ops: [{ op: 'open', shape: { type: 'capsule', a: [-76, 0], b: [76, 0], halfWidth: 5 } }],
    },
    waves: [
      { name: 'w', groups: [{ atSec: 1, spawn: 'S', unitType: UnitTypeId.OrcWarrior, battalions: 2 }] },
    ],
  };

  it('çıkışa ulaşan tabur can götürür; canlar bitince yenilgi', () => {
    const sim = new Simulation(5, buildNavGrid(TD), TD);
    expect(sim.world.match.lives).toBe(5);
    for (let t = 0; t < 60 * 20 && sim.world.match.lives === 5; t++) sim.step();
    expect(sim.world.match.lives).toBeLessThan(5);
    sim.world.match.lives = 0;
    sim.step();
    expect(sim.world.match.state).toBe(MatchState.Defeat);
  });

  it('mancınık kulesi alan hasarıyla birden çok düşmana vurur', () => {
    const sim = new Simulation(6, buildNavGrid(TD), TD);
    sim.world.match.gold[0] = 5000;
    sim.schedule(stamp(0, { type: 'build', slot: 0, kind: 3 }));
    sim.step();
    const tower = sim.world.match.slots[0] as number;
    while ((sim.world.c.Structure.buildLeft[tower] as number) > 0) sim.step();
    const H = sim.world.c.Health;
    let stone = false;
    let maxHurt = 0;
    for (let t = 0; t < 50 * 20; t++) {
      sim.step();
      for (const p of query(sim.world, [sim.world.c.Projectile]))
        if (sim.world.c.Projectile.kind[p] === 1) stone = true;
      const hurt = [...query(sim.world, [H])].filter(
        (e) => sim.world.c.Team.id[e] === 1 && (H.hp[e] as number) < (H.max[e] as number),
      ).length;
      maxHurt = Math.max(maxHurt, hurt);
    }
    expect(stone).toBe(true);
    expect(maxHurt).toBeGreaterThan(3);
  });
});
