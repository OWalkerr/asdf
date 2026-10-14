import {
  fxFromFloat,
  HELMS_DEEP,
  HERO,
  type MapDef,
  RANK_XP,
  SPELL_DEFS,
  type StampedCommand,
  UnitTypeId,
} from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, createOpenGrid, Simulation } from '../src';
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
  waves: [
    {
      name: 'uzak',
      groups: [{ atSec: 9999, spawn: 'S_main', unitType: UnitTypeId.OrcWarrior, battalions: 1 }],
    },
  ],
};
const newSim = (seed = 3) => new Simulation(seed, buildNavGrid(QUIET), QUIET);
const battalionsOf = (sim: Simulation, team: number, type?: number) =>
  [...query(sim.world, [sim.world.c.Battalion])].filter(
    (b) =>
      sim.world.c.Team.id[b] === team && (type === undefined || sim.world.c.Battalion.unitType[b] === type),
  );
const spawn = (sim: Simulation, team: number, unitType: number, x: number, z: number) =>
  sim.schedule(
    stamp(sim.world.tick, {
      type: 'spawnBattalion',
      team,
      unitType,
      x: F(x),
      z: F(z),
      count: 1,
      facing: team ? 32768 : 0,
    }),
  );

describe('tabur rütbesi', () => {
  it('XP eşiklerinde rütbe atlar (en fazla 5)', () => {
    const sim = newSim();
    spawn(sim, 0, UnitTypeId.GondorSoldier, 0, 40);
    sim.step();
    const b = battalionsOf(sim, 0)[0] as number;
    expect(sim.world.c.Battalion.rank[b]).toBe(1);
    awardXp(sim.world, b, RANK_XP[2] as number);
    expect(sim.world.c.Battalion.rank[b]).toBe(2);
    awardXp(sim.world, b, 10_000);
    expect(sim.world.c.Battalion.rank[b]).toBe(5);
  });

  it('öldüren tabur XP kazanır, düşman ölümleri Güç Puanı verir', () => {
    const sim = new Simulation(5, createOpenGrid(200), QUIET);
    // QUIET harita ile açık ızgara: savaş kapılardan bağımsız.
    spawn(sim, 0, UnitTypeId.UrukHai, -6, 0);
    spawn(sim, 1, UnitTypeId.OrcWarrior, 6, 0);
    sim.step();
    const pp0 = sim.world.match.pp[0] as number;
    const b = battalionsOf(sim, 0)[0] as number;
    for (let t = 0; t < 1500 && battalionsOf(sim, 1).length > 0; t++) sim.step();
    expect(battalionsOf(sim, 1).length).toBe(0);
    // 20 ork × asker başı değer 5 = en fazla 100 XP (son vuruşları başka tabur almadıysa).
    expect(sim.world.c.Battalion.xp[b]).toBeGreaterThan(0);
    expect(sim.world.c.Battalion.xp[b]).toBeLessThanOrEqual(100);
    expect(sim.world.match.pp[0] as number).toBeGreaterThan(pp0);
  });
});

describe('kahraman', () => {
  it('altınla çağrılır, tek olur; ölünce bekleme süresinden sonra yeniden çağrılabilir', () => {
    const sim = newSim();
    sim.world.match.gold[0] = 5000;
    sim.schedule(stamp(0, { type: 'summonHero', unitType: UnitTypeId.Aragorn }));
    sim.schedule(stamp(0, { type: 'summonHero', unitType: UnitTypeId.Aragorn })); // ikinci: reddedilir
    sim.schedule(stamp(0, { type: 'summonHero', unitType: UnitTypeId.GondorSoldier })); // kahraman değil
    sim.step();
    const heroes = battalionsOf(sim, 0, UnitTypeId.Aragorn);
    expect(heroes.length).toBe(1);
    expect(sim.world.match.hero[0]).toBe(heroes[0]);
    expect(sim.world.match.gold[0]).toBe(5000 - 1200 + 1);
    // Öldür.
    const H = sim.world.c.Health;
    for (const e of query(sim.world, [H])) if (sim.world.c.Soldier.battalion[e] === heroes[0]) H.hp[e] = 0;
    sim.step();
    expect(sim.world.match.hero[0]).toBe(0);
    sim.schedule(stamp(sim.world.tick, { type: 'summonHero', unitType: UnitTypeId.Aragorn })); // bekleme
    sim.step();
    expect(sim.world.match.hero[0]).toBe(0);
    for (let t = 0; t < HERO.reviveTime * 20; t++) sim.step();
    sim.schedule(stamp(sim.world.tick, { type: 'summonHero', unitType: UnitTypeId.Aragorn }));
    sim.step();
    expect(sim.world.match.hero[0]).not.toBe(0);
  });

  it('liderlik aurası yakındaki dost taburu işaretler; Athelas rütbe 3 ister ve iyileştirir', () => {
    const sim = newSim();
    sim.world.match.gold[0] = 5000;
    sim.schedule(stamp(0, { type: 'summonHero', unitType: UnitTypeId.Aragorn }));
    sim.step();
    const hero = sim.world.match.hero[0] as number;
    const P = sim.world.c.Position;
    const hx = (P.x[hero] as number) / 65536;
    const hz = (P.z[hero] as number) / 65536;
    spawn(sim, 0, UnitTypeId.GondorSoldier, hx + 6, hz);
    for (let t = 0; t < 10; t++) sim.step();
    const ally = battalionsOf(sim, 0, UnitTypeId.GondorSoldier)[0] as number;
    expect(sim.world.c.Battalion.aura[ally]).toBe(1);
    // Hasarlı müttefik; Athelas rütbe 1'de reddedilir.
    const H = sim.world.c.Health;
    const members = [...query(sim.world, [H])].filter((e) => sim.world.c.Soldier.battalion[e] === ally);
    for (const e of members) H.hp[e] = 10;
    sim.schedule(stamp(sim.world.tick, { type: 'ability', unit: hero, ability: 1 }));
    sim.step();
    expect(H.hp[members[0] as number]).toBe(10);
    awardXp(sim.world, hero, RANK_XP[3] as number);
    sim.schedule(stamp(sim.world.tick, { type: 'ability', unit: hero, ability: 1 }));
    sim.step();
    expect(H.hp[members[0] as number]).toBe(60);
    // Bekleme süresi: hemen tekrar kullanılamaz.
    for (const e of members) H.hp[e] = 10;
    sim.schedule(stamp(sim.world.tick, { type: 'ability', unit: hero, ability: 1 }));
    sim.step();
    expect(H.hp[members[0] as number]).toBe(10);
  });
});

describe('Spellbook', () => {
  const HEAL = SPELL_DEFS.findIndex((s) => s.key === 'heal');
  const RALLY = SPELL_DEFS.findIndex((s) => s.key === 'rally');
  const VOLLEY = SPELL_DEFS.findIndex((s) => s.key === 'arrow_volley');

  it('PP ile açılır; kademe kuralı ve yetersiz PP reddedilir', () => {
    const sim = newSim();
    sim.world.match.pp[0] = 120; // 12 PP
    sim.schedule(stamp(0, { type: 'unlockSpell', spell: VOLLEY })); // 1. kademe yok: reddedilir
    sim.step();
    expect(sim.world.match.spells[0]).toBe(0);
    sim.schedule(stamp(1, { type: 'unlockSpell', spell: HEAL }));
    sim.schedule(stamp(1, { type: 'unlockSpell', spell: VOLLEY })); // 7 PP kaldı: yetmez (10)
    sim.step();
    expect(sim.world.match.spells[0]).toBe(1 << HEAL);
    expect(sim.world.match.pp[0]).toBe(70);
  });

  it('Toplanma Çağrısı süreli; açılmamış veya beklemedeki büyü kullanılamaz', () => {
    const sim = newSim();
    sim.schedule(stamp(0, { type: 'castSpell', spell: RALLY, x: 0, z: 0 }));
    sim.step();
    expect(sim.world.match.rallyUntil[0]).toBe(0);
    sim.world.match.spells[0] = 1 << RALLY;
    sim.schedule(stamp(1, { type: 'castSpell', spell: RALLY, x: 0, z: 0 }));
    sim.step();
    const until = sim.world.match.rallyUntil[0] as number;
    expect(until).toBeGreaterThan(sim.world.tick);
    sim.schedule(stamp(2, { type: 'castSpell', spell: RALLY, x: 0, z: 0 }));
    sim.step();
    expect(sim.world.match.rallyUntil[0]).toBe(until);
  });

  it('Ok Yağmuru alandaki düşmanlara üç dalga ok atar ve öldürür', () => {
    const sim = new Simulation(9, createOpenGrid(200), QUIET);
    spawn(sim, 1, UnitTypeId.OrcWarrior, 0, 20);
    sim.step();
    sim.world.match.spells[0] = 1 << VOLLEY;
    const alive = () =>
      [...query(sim.world, [sim.world.c.Health])].filter(
        (e) => sim.world.c.Team.id[e] === 1 && sim.world.c.Dead.at[e] === 0,
      ).length;
    const before = alive();
    sim.schedule(stamp(sim.world.tick, { type: 'castSpell', spell: VOLLEY, x: 0, z: F(20) }));
    let arrows = 0;
    for (let t = 0; t < 200; t++) {
      sim.step();
      arrows = Math.max(arrows, query(sim.world, [sim.world.c.Projectile]).length);
    }
    expect(arrows).toBeGreaterThanOrEqual(20);
    expect(alive()).toBeLessThan(before);
    expect(sim.world.match.volleys.length).toBe(0);
  });

  it('kahraman + büyüler deterministik', () => {
    const run = () => {
      const sim = new Simulation(13, buildNavGrid(HELMS_DEEP), HELMS_DEEP);
      sim.world.match.gold[0] = 3000;
      sim.world.match.spells[0] = 7;
      sim.schedule(stamp(0, { type: 'summonHero', unitType: UnitTypeId.Aragorn }));
      sim.schedule(stamp(600, { type: 'castSpell', spell: VOLLEY, x: F(12), z: F(60) }));
      sim.schedule(stamp(610, { type: 'castSpell', spell: RALLY, x: 0, z: 0 }));
      for (let t = 0; t < 900; t++) sim.step();
      return sim.hash();
    };
    expect(run()).toBe(run());
  });
});
