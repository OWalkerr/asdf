import { fxFromFloat, MAP_DEFS, type MapDef, type StampedCommand, UnitTypeId } from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, laneGoal, Simulation } from '../src';
import { sendLadderTeam } from '../src/systems/ladders';

const FD = MAP_DEFS.fortress_defence as MapDef;
const QUIET: MapDef = {
  ...FD,
  garrison: [],
  waves: [
    { name: 'uzak', groups: [{ atSec: 9999, spawn: 'S_n', unitType: UnitTypeId.OrcWarrior, battalions: 1 }] },
  ],
};
let seq = 0;
const send = (sim: Simulation, cmd: StampedCommand['cmd']) =>
  sim.schedule({ tick: sim.world.tick, player: 0, seq: seq++, cmd });
const run = (sim: Simulation, n = 1) => {
  for (let i = 0; i < n; i++) sim.step();
};
const F = fxFromFloat;

/** Kuzey koridorunda merdiven noktasının dışına merdiven takımı koyar ve dayatır. */
const deployLadder = (sim: Simulation) => {
  const spot = sim.world.ladderSpots[0]?.[0];
  if (!spot) throw new Error('nokta yok');
  send(sim, {
    type: 'spawnBattalion',
    team: 1,
    unitType: UnitTypeId.LadderTeam,
    x: F(spot.o[0] + spot.n[0] * 6),
    z: F(spot.o[1] + spot.n[1] * 6),
    count: 1,
    facing: 0,
  });
  run(sim);
  const { Battalion, Team } = sim.world.c;
  const b = [...query(sim.world, [Battalion])].find((e) => Team.id[e] === 1) as number;
  Battalion.lane[b] = 1;
  sendLadderTeam(sim.world, b, 0);
  for (let i = 0; i < 400 && sim.world.match.ladders.length === 0; i++) sim.step();
  return spot;
};

describe('kuşatma merdivenleri', () => {
  it('merdiven takımı sura varınca merdiveni dayar; geçit yalnızca düşmana açılır, ilk kapı atlanır', () => {
    const sim = new Simulation(4, buildNavGrid(QUIET), QUIET);
    const before = laneGoal(sim.world, 0);
    deployLadder(sim);
    const m = sim.world.match;
    expect(m.ladders.length).toBe(1);
    expect(m.laneLadders[0]).toBe(1);
    const l = m.ladders[0] as (typeof m.ladders)[number];
    expect(l.cells.length).toBeGreaterThan(0);
    for (const c of l.cells) {
      expect((sim.world.nav.blocked[c] as number) & 2).toBe(0); // düşmana açık
      expect((sim.world.nav.blocked[c] as number) & 1).toBe(1); // savunucuya kapalı
    }
    const after = laneGoal(sim.world, 0);
    expect(after.structure).not.toBe(before.structure);
    expect(after.structure).toBe(m.fortress);
  });

  it('merdiven yıkılınca hücreler eski haline döner', () => {
    const sim = new Simulation(4, buildNavGrid(QUIET), QUIET);
    deployLadder(sim);
    const m = sim.world.match;
    const l = m.ladders[0] as (typeof m.ladders)[number];
    sim.world.c.Structure.hp[l.eid] = 0;
    run(sim, 6);
    expect(m.ladders.length).toBe(0);
    expect(m.laneLadders[0]).toBe(0);
    for (const c of l.cells) expect(sim.world.nav.blocked[c]).toBe(0x0f);
  });

  it('yakındaki savunucular merdiveni yıkar', () => {
    const sim = new Simulation(4, buildNavGrid(QUIET), QUIET);
    const spot = deployLadder(sim);
    const l = sim.world.match.ladders[0] as (typeof sim.world.match.ladders)[number];
    const hp0 = sim.world.c.Structure.hp[l.eid] as number;
    send(sim, {
      type: 'spawnBattalion',
      team: 0,
      unitType: UnitTypeId.GondorSoldier,
      x: F(spot.i[0] - spot.n[0] * 3),
      z: F(spot.i[1] - spot.n[1] * 3),
      count: 1,
      facing: 0,
    });
    run(sim, 200);
    const now = sim.world.match.ladders.length ? (sim.world.c.Structure.hp[l.eid] as number) : 0;
    expect(now).toBeLessThan(hp0);
  });

  it('düşman taburları merdivenden suru aşıp kaleye ulaşır', () => {
    const sim = new Simulation(4, buildNavGrid(QUIET), QUIET);
    const spot = deployLadder(sim);
    send(sim, {
      type: 'spawnBattalion',
      team: 1,
      unitType: UnitTypeId.UrukHai,
      x: F(spot.o[0] + spot.n[0] * 10),
      z: F(spot.o[1] + spot.n[1] * 10),
      count: 1,
      facing: 0,
    });
    run(sim);
    const { Battalion, Team, Soldier, Position } = sim.world.c;
    const u = [...query(sim.world, [Battalion])].find(
      (e) => Team.id[e] === 1 && Battalion.unitType[e] === UnitTypeId.UrukHai,
    ) as number;
    Battalion.lane[u] = 1;
    const fort = sim.world.match.fortress;
    const hp0 = sim.world.c.Structure.hp[fort] as number;
    run(sim, 20 * 60);
    const inside = [...query(sim.world, [Soldier, Position])].some(
      (s) =>
        Soldier.battalion[s] === u &&
        Math.abs((Position.x[s] as number) / 65536) < 36 &&
        Math.abs((Position.z[s] as number) / 65536) < 36,
    );
    expect(inside || (sim.world.c.Structure.hp[fort] as number) < hp0).toBe(true);
  });

  it('kuşatma kulesi yanaşır: geniş geçit açar, Uruk indirir, kendiliğinden çökmez', () => {
    const sim = new Simulation(4, buildNavGrid(QUIET), QUIET);
    const spot = sim.world.ladderSpots[0]?.[0];
    if (!spot) throw new Error('nokta yok');
    send(sim, {
      type: 'spawnBattalion',
      team: 1,
      unitType: UnitTypeId.SiegeTower,
      x: F(spot.o[0] + spot.n[0] * 8),
      z: F(spot.o[1] + spot.n[1] * 8),
      count: 1,
      facing: 0,
    });
    run(sim);
    const { Battalion, Team, Structure } = sim.world.c;
    const b = [...query(sim.world, [Battalion])].find((e) => Team.id[e] === 1) as number;
    Battalion.lane[b] = 1;
    sendLadderTeam(sim.world, b, 0);
    for (let i = 0; i < 1200 && sim.world.match.ladders.length === 0; i++) sim.step();
    const m = sim.world.match;
    expect(m.ladders.length).toBe(1);
    const l = m.ladders[0] as (typeof m.ladders)[number];
    expect(Structure.kind[l.eid]).toBe(6);
    const uruks = [...query(sim.world, [Battalion])].filter(
      (e) => Team.id[e] === 1 && Battalion.unitType[e] === UnitTypeId.UrukHai,
    );
    expect(uruks.length).toBe(1);
    expect(Battalion.lane[uruks[0] as number]).toBe(1);
    // Merdivenden geniş geçit ve 90 sn sonra hâlâ ayakta.
    expect(l.cells.length).toBeGreaterThan(6);
    run(sim, 20 * 95);
    expect(m.ladders.some((x) => x.eid === l.eid)).toBe(true);
  });
});
