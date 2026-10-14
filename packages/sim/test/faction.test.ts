import {
  fxFromFloat,
  HELMS_DEEP,
  type MapDef,
  RANK_XP,
  type StampedCommand,
  UnitTypeId,
} from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, Simulation } from '../src';
import { awardXp } from '../src/systems/heroes';

const F = fxFromFloat;
let seq = 0;
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
const rohan = () => new Simulation(5, buildNavGrid(QUIET), QUIET, 1, 1);
const send = (sim: Simulation, cmd: StampedCommand['cmd']) =>
  sim.schedule({ tick: sim.world.tick, player: 0, seq: seq++, cmd });
const run = (sim: Simulation, n = 1) => {
  for (let i = 0; i < n; i++) sim.step();
};
const battalionsOf = (sim: Simulation, team: number, type: number) =>
  [...query(sim.world, [sim.world.c.Battalion])].filter(
    (b) => sim.world.c.Team.id[b] === team && sim.world.c.Battalion.unitType[b] === type,
  );

describe('Rohan tarafı', () => {
  it('kışla Rohan birimlerini yetiştirir, Gondor birimlerini reddeder', () => {
    const sim = rohan();
    sim.world.match.gold[0] = 99_999;
    const plot = QUIET.slots.findIndex((s) => s.kind === 'building');
    send(sim, { type: 'build', slot: plot, kind: 1 });
    run(sim);
    const e = sim.world.match.slots[plot] as number;
    sim.world.c.Structure.buildLeft[e] = 0;
    send(sim, { type: 'train', building: e, unitType: UnitTypeId.GondorSoldier });
    send(sim, { type: 'train', building: e, unitType: UnitTypeId.RohanRiders });
    run(sim);
    expect(sim.world.c.Structure.qLen[e]).toBe(1);
    expect(sim.world.c.Structure.queue[e * 8]).toBe(UnitTypeId.RohanRiders);
  });

  it('Théoden ve Éowyn çağrılır, Aragorn çağrılamaz', () => {
    const sim = rohan();
    sim.world.match.gold[0] = 99_999;
    for (const t of [UnitTypeId.Aragorn, UnitTypeId.Theoden, UnitTypeId.Eowyn, UnitTypeId.Gandalf])
      send(sim, { type: 'summonHero', unitType: t });
    run(sim);
    const h = sim.world.match.heroes;
    expect(battalionsOf(sim, 0, UnitTypeId.Aragorn).length).toBe(0);
    expect(sim.world.c.Battalion.unitType[h[0] as number]).toBe(UnitTypeId.Theoden);
    expect(sim.world.c.Battalion.unitType[h[1] as number]).toBe(UnitTypeId.Eowyn);
    expect(sim.world.c.Battalion.unitType[h[2] as number]).toBe(UnitTypeId.Gandalf);
  });

  it("Kralın Şanı ordu güçlendirmesi; Éored süvari çağırır; Éowyn boss'a ağır vurur", () => {
    const sim = rohan();
    sim.world.match.gold[0] = 99_999;
    send(sim, { type: 'summonHero', unitType: UnitTypeId.Theoden });
    send(sim, { type: 'summonHero', unitType: UnitTypeId.Eowyn });
    run(sim);
    const [t, e] = [sim.world.match.heroes[0] as number, sim.world.match.heroes[1] as number];
    awardXp(sim.world, t, RANK_XP[3] as number);
    awardXp(sim.world, e, RANK_XP[3] as number);
    send(sim, { type: 'ability', unit: t, ability: 0 });
    send(sim, { type: 'ability', unit: t, ability: 1 });
    run(sim);
    expect(sim.world.match.rallyUntil[0] as number).toBeGreaterThan(sim.world.tick);
    expect(battalionsOf(sim, 0, UnitTypeId.RohanRiders).length).toBe(1);
    run(sim, 100);
    expect(battalionsOf(sim, 0, UnitTypeId.RohanRiders).length).toBe(1); // 40 sn sürer
    const { Position, Soldier, Health } = sim.world.c;
    send(sim, {
      type: 'spawnBattalion',
      team: 1,
      unitType: UnitTypeId.Lurtz,
      x: (Position.x[e] as number) + F(6),
      z: Position.z[e] as number,
      count: 1,
      facing: 0,
    });
    run(sim);
    const lurtz = [...query(sim.world, [Soldier, Health])].find(
      (s) => sim.world.c.UnitType.id[s] === UnitTypeId.Lurtz,
    ) as number;
    const hp0 = Health.hp[lurtz] as number;
    send(sim, { type: 'ability', unit: e, ability: 1 });
    run(sim);
    expect(hp0 - (Health.hp[lurtz] as number)).toBeGreaterThanOrEqual(400);
  });
});
