import {
  fxFromFloat,
  HELMS_DEEP,
  type MapDef,
  RANK_XP,
  SPELL_DEFS,
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

describe('Lothlórien tarafı', () => {
  it('kışla elf birimleri yetiştirir; Haldir, Elrond ve Legolas çağrılır', () => {
    const sim = new Simulation(5, buildNavGrid(QUIET), QUIET, 1, 2);
    sim.world.match.gold[0] = 99_999;
    const plot = QUIET.slots.findIndex((s) => s.kind === 'building');
    send(sim, { type: 'build', slot: plot, kind: 1 });
    for (const t of [UnitTypeId.Haldir, UnitTypeId.Elrond, UnitTypeId.Legolas, UnitTypeId.Aragorn])
      send(sim, { type: 'summonHero', unitType: t });
    run(sim);
    const e = sim.world.match.slots[plot] as number;
    sim.world.c.Structure.buildLeft[e] = 0;
    send(sim, { type: 'train', building: e, unitType: UnitTypeId.RohanSpearman });
    send(sim, { type: 'train', building: e, unitType: UnitTypeId.Galadhrim });
    run(sim);
    expect(sim.world.c.Structure.qLen[e]).toBe(1);
    const h = sim.world.match.heroes;
    const types = [0, 1, 2].map((k) => sim.world.c.Battalion.unitType[h[k] as number]);
    expect(types).toEqual([UnitTypeId.Haldir, UnitTypeId.Elrond, UnitTypeId.Legolas]);
    expect(battalionsOf(sim, 0, UnitTypeId.Aragorn).length).toBe(0);
  });
});

describe('Isengard tarafı (kötü)', () => {
  const ISEN = 3;
  const map: MapDef = {
    ...HELMS_DEEP,
    garrison: [],
    waves: [
      {
        name: 'erken',
        groups: [
          { atSec: 1, spawn: 'S_main', unitType: UnitTypeId.OrcWarrior, battalions: 1 },
          { atSec: 1, spawn: 'S_main', unitType: UnitTypeId.UrukHai, battalions: 1 },
        ],
      },
    ],
  };

  it('dalgalar iyi tarafların karşılık birimleriyle gelir', () => {
    const sim = new Simulation(6, buildNavGrid(map), map, 1, ISEN);
    run(sim, 40);
    expect(battalionsOf(sim, 1, UnitTypeId.GondorSoldier).length).toBeGreaterThan(0);
    expect(battalionsOf(sim, 1, UnitTypeId.TowerGuard).length).toBeGreaterThan(0);
    expect(battalionsOf(sim, 1, UnitTypeId.OrcWarrior).length).toBe(0);
  });

  it('Saruman çağrılır; Uruk Takviyesi Uruk-hai çağırır; Balrog tek gelir', () => {
    const sim = new Simulation(7, buildNavGrid(QUIET), QUIET, 1, ISEN);
    sim.world.match.gold[0] = 99_999;
    send(sim, { type: 'summonHero', unitType: UnitTypeId.Saruman });
    run(sim);
    expect(battalionsOf(sim, 0, UnitTypeId.Saruman).length).toBe(1);
    const idx = (k: string) => SPELL_DEFS.findIndex((s) => s.key === k);
    sim.world.match.spells[0] = (1 << idx('elven_allies')) | (1 << idx('army_of_dead'));
    send(sim, { type: 'castSpell', spell: idx('elven_allies'), x: F(10), z: F(-60) });
    send(sim, { type: 'castSpell', spell: idx('army_of_dead'), x: F(-10), z: F(-60) });
    run(sim);
    expect(battalionsOf(sim, 0, UnitTypeId.UrukHai).length).toBe(2);
    expect(battalionsOf(sim, 0, UnitTypeId.Balrog).length).toBe(1);
  });
});

describe('Mordor tarafı (kötü)', () => {
  const MORDOR = 4;
  it('Cadı Kral çağrılır; Gothmog ork takviyesi getirir; Ork Sürüsü üç tabur', () => {
    const sim = new Simulation(9, buildNavGrid(QUIET), QUIET, 1, MORDOR);
    sim.world.match.gold[0] = 99_999;
    send(sim, { type: 'summonHero', unitType: UnitTypeId.WitchKing });
    send(sim, { type: 'summonHero', unitType: UnitTypeId.Gothmog });
    run(sim);
    expect(battalionsOf(sim, 0, UnitTypeId.WitchKing).length).toBe(1);
    const goth = battalionsOf(sim, 0, UnitTypeId.Gothmog)[0] as number;
    awardXp(sim.world, goth, 99_999);
    send(sim, { type: 'ability', unit: goth, ability: 1 });
    const idx = SPELL_DEFS.findIndex((s) => s.key === 'elven_allies');
    sim.world.match.spells[0] = 1 << idx;
    send(sim, { type: 'castSpell', spell: idx, x: F(10), z: F(-60) });
    run(sim);
    expect(battalionsOf(sim, 0, UnitTypeId.OrcWarrior).length).toBe(5);
  });
});
