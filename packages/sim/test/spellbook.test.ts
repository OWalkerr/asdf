import {
  BANNER,
  FACTIONS,
  fxFromFloat,
  GEAR_DEFS,
  HELMS_DEEP,
  HERO_XP,
  MAX_HERO_LEVEL,
  type MapDef,
  SPELL_DEFS,
  type StampedCommand,
  Stance,
  UnitTypeId,
} from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { createOpenGrid, Simulation } from '../src';
import { attackPercent, awardXp, defensePercent } from '../src/systems/heroes';
import { SpellEffect } from '../src/world';

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
const idx = (key: string) => SPELL_DEFS.findIndex((s) => s.key === key);
const setup = (seed: number) => {
  const sim = new Simulation(seed, createOpenGrid(200), QUIET);
  return sim;
};
const spawn = (sim: Simulation, team: number, unitType: number, x: number, z: number) =>
  sim.schedule(
    stamp(sim.world.tick, { type: 'spawnBattalion', team, unitType, x: F(x), z: F(z), count: 1, facing: 0 }),
  );
const teamHp = (sim: Simulation, team: number) => {
  const H = sim.world.c.Health;
  return [...query(sim.world, [H, sim.world.c.Soldier])]
    .filter((e) => sim.world.c.Team.id[e] === team && sim.world.c.Dead.at[e] === 0)
    .reduce((a, e) => a + Math.max(0, H.hp[e] as number), 0);
};
const battalions = (sim: Simulation, team: number) =>
  [...query(sim.world, [sim.world.c.Battalion])].filter((b) => sim.world.c.Team.id[b] === team);

describe('genişletilmiş büyü kitabı', () => {
  it('12 güç, 4 kademe; snapshot hepsini taşır', () => {
    expect(SPELL_DEFS.length).toBe(12);
    expect(new Set(SPELL_DEFS.map((s) => s.tier))).toEqual(new Set([1, 2, 3, 4]));
  });

  it('Tom Bombadil ve Ent Toplantısı ölümsüz Tom ile üç Ent çağırır', () => {
    const sim = setup(23);
    sim.world.match.spells[0] = (1 << idx('tom_bombadil')) | (1 << idx('ent_moot'));
    sim.schedule(stamp(sim.world.tick, { type: 'castSpell', spell: idx('tom_bombadil'), x: 0, z: F(10) }));
    sim.schedule(stamp(sim.world.tick, { type: 'castSpell', spell: idx('ent_moot'), x: F(10), z: F(10) }));
    sim.step();
    const types = battalions(sim, 0).map((b) => sim.world.c.Battalion.unitType[b]);
    expect(types.filter((t) => t === UnitTypeId.TomBombadil).length).toBe(1);
    expect(types.filter((t) => t === UnitTypeId.Ent).length).toBe(3);
  });

  it('Güneş Parlaması hasar verir ve düşmanı zayıflatır', () => {
    const sim = setup(21);
    spawn(sim, 1, UnitTypeId.UrukHai, 0, 20);
    sim.step();
    const before = teamHp(sim, 1);
    const SF = idx('sun_flare');
    sim.world.match.spells[0] = 1 << SF;
    sim.schedule(stamp(sim.world.tick, { type: 'castSpell', spell: SF, x: 0, z: F(20) }));
    sim.step();
    expect(teamHp(sim, 1)).toBeLessThan(before);
    const b = battalions(sim, 1)[0] as number;
    expect(sim.world.c.Battalion.weakUntil[b]).toBeGreaterThan(sim.world.tick);
    expect(attackPercent(sim.world, b, 1, true)).toBe(60);
    const s = [...query(sim.world, [sim.world.c.Soldier])].find(
      (e) => sim.world.c.Soldier.battalion[e] === b,
    ) as number;
    expect(defensePercent(sim.world, s)).toBe(125);
  });

  it('Deprem askerleri ve düşman yapılarını sarsar', () => {
    const sim = setup(22);
    spawn(sim, 1, UnitTypeId.OrcWarrior, 0, 20);
    sim.step();
    const before = teamHp(sim, 1);
    const Q = idx('earthquake');
    sim.world.match.spells[0] = 1 << Q;
    sim.schedule(stamp(sim.world.tick, { type: 'castSpell', spell: Q, x: 0, z: F(20) }));
    for (let t = 0; t < 100; t++) sim.step();
    expect(teamHp(sim, 1)).toBeLessThan(before * 0.6);
    expect(sim.world.match.volleys.length).toBe(0);
  });

  it('Kartallar üç dalışla taburu ezer', () => {
    const sim = setup(23);
    spawn(sim, 1, UnitTypeId.UrukHai, 0, 20);
    sim.step();
    const before = teamHp(sim, 1);
    const E = idx('eagles');
    sim.world.match.spells[0] = 1 << E;
    sim.schedule(stamp(sim.world.tick, { type: 'castSpell', spell: E, x: 0, z: F(20) }));
    for (let t = 0; t < 100; t++) sim.step();
    expect(teamHp(sim, 1)).toBeLessThan(before * 0.5);
  });

  it('Sel dalgası hasar verir ve düşmanı dışa sürükler', () => {
    const sim = setup(24);
    spawn(sim, 1, UnitTypeId.OrcWarrior, 0, 24);
    sim.step();
    const P = sim.world.c.Position;
    const soldiers = () =>
      [...query(sim.world, [sim.world.c.Soldier])].filter((e) => sim.world.c.Team.id[e] === 1);
    const dist = () =>
      soldiers().reduce(
        (a, e) => a + Math.hypot((P.x[e] as number) / 65536, (P.z[e] as number) / 65536 - 20),
        0,
      );
    const d0 = dist();
    const before = teamHp(sim, 1);
    const FL = idx('flood');
    sim.world.match.spells[0] = 1 << FL;
    sim.schedule(stamp(sim.world.tick, { type: 'castSpell', spell: FL, x: 0, z: F(20) }));
    for (let t = 0; t < 4; t++) sim.step();
    for (let t = 0; t < 60; t++) sim.step();
    expect(teamHp(sim, 1)).toBeLessThan(before);
    expect(dist()).toBeGreaterThan(d0 * 0.9);
  });
});

describe('tabur duruşları ve sancaktar', () => {
  it('duruş verilen/alınan hasarı değiştirir', () => {
    const sim = setup(25);
    spawn(sim, 0, UnitTypeId.GondorSoldier, 0, 0);
    sim.step();
    const b = battalions(sim, 0)[0] as number;
    const s = [...query(sim.world, [sim.world.c.Soldier])].find(
      (e) => sim.world.c.Soldier.battalion[e] === b,
    ) as number;
    expect(attackPercent(sim.world, b, 0, false)).toBe(100);
    sim.schedule(stamp(sim.world.tick, { type: 'stance', units: [b], stance: Stance.Aggressive }));
    sim.step();
    expect(attackPercent(sim.world, b, 0, false)).toBe(125);
    expect(defensePercent(sim.world, s)).toBe(125);
    sim.schedule(stamp(sim.world.tick, { type: 'stance', units: [b], stance: Stance.Hold }));
    sim.step();
    expect(attackPercent(sim.world, b, 0, false)).toBe(85);
    expect(defensePercent(sim.world, s)).toBe(65);
    sim.schedule(stamp(sim.world.tick, { type: 'stance', units: [b], stance: 9 }));
    sim.step();
    expect(sim.world.c.Battalion.stance[b]).toBe(Stance.Hold);
  });

  it('sancaktar altınla alınır, sakin askerleri iyileştirir', () => {
    const sim = setup(26);
    spawn(sim, 0, UnitTypeId.GondorSoldier, 0, 0);
    sim.step();
    const b = battalions(sim, 0)[0] as number;
    sim.world.match.gold[0] = BANNER.cost + 10;
    sim.schedule(stamp(sim.world.tick, { type: 'buyBanner', units: [b] }));
    sim.step();
    expect(sim.world.c.Battalion.banner[b]).toBe(1);
    expect(sim.world.match.gold[0]).toBe(10);
    // İkinci kez alınmaz.
    sim.schedule(stamp(sim.world.tick, { type: 'buyBanner', units: [b] }));
    sim.step();
    expect(sim.world.match.gold[0]).toBe(10);
    const H = sim.world.c.Health;
    const mine = [...query(sim.world, [sim.world.c.Soldier])].filter(
      (e) => sim.world.c.Soldier.battalion[e] === b,
    );
    for (const e of mine) H.hp[e] = ((H.max[e] as number) / 2) | 0;
    const before = teamHp(sim, 0);
    for (let t = 0; t < 100; t++) sim.step();
    expect(teamHp(sim, 0)).toBeGreaterThan(before);
  });
});

describe('kahraman seviyeleri (1–10) ve 4 yetenek', () => {
  const heroSim = (unitType: number, faction = 0) => {
    const sim = new Simulation(31, createOpenGrid(200), QUIET, 1, faction);
    sim.world.match.gold[0] = 99999;
    sim.schedule(stamp(0, { type: 'summonHero', unitType }));
    sim.step();
    const hero = [...sim.world.match.heroes].find((h) => h !== 0) ?? 0;
    return { sim, hero };
  };

  it('kahraman 10. seviyeye çıkar, 5 rütbe sınırına takılmaz', () => {
    const { sim, hero } = heroSim(UnitTypeId.Aragorn);
    expect(hero).not.toBe(0);
    expect(sim.world.c.Battalion.rank[hero]).toBe(1);
    awardXp(sim.world, hero, HERO_XP[6] as number);
    expect(sim.world.c.Battalion.rank[hero]).toBe(6);
    awardXp(sim.world, hero, 99999);
    expect(sim.world.c.Battalion.rank[hero]).toBe(MAX_HERO_LEVEL);
    expect(attackPercent(sim.world, hero, 0, true)).toBe(190);
  });

  it('kahraman zamanla pasif deneyim kazanır', () => {
    const { sim, hero } = heroSim(UnitTypeId.Aragorn);
    const xp0 = sim.world.c.Battalion.xp[hero] as number;
    for (let t = 0; t < 100; t++) sim.step();
    expect(sim.world.c.Battalion.xp[hero]).toBeGreaterThan(xp0);
  });

  it('10. seviye yeteneği kilitliyken reddedilir, açılınca Yeminbozanları çağırır', () => {
    const { sim, hero } = heroSim(UnitTypeId.Aragorn);
    sim.schedule(stamp(sim.world.tick, { type: 'ability', unit: hero, ability: 3 }));
    sim.step();
    const dead = () =>
      battalions(sim, 0).filter((b) => sim.world.c.Battalion.unitType[b] === UnitTypeId.DeadArmy);
    expect(dead().length).toBe(0);
    awardXp(sim.world, hero, 99999);
    sim.schedule(stamp(sim.world.tick, { type: 'ability', unit: hero, ability: 3 }));
    sim.step();
    expect(dead().length).toBe(2);
    // Bekleme süresi: hemen tekrar kullanılamaz.
    sim.schedule(stamp(sim.world.tick, { type: 'ability', unit: hero, ability: 3 }));
    sim.step();
    expect(dead().length).toBe(2);
  });

  it('Gandalf 10: Kartalları Çağır kartal dalışlarını başlatır', () => {
    const { sim, hero } = heroSim(UnitTypeId.Gandalf);
    awardXp(sim.world, hero, 99999);
    sim.schedule(stamp(sim.world.tick, { type: 'ability', unit: hero, ability: 3 }));
    sim.step();
    expect(sim.world.match.volleys.some((v) => v.kind === SpellEffect.Eagles)).toBe(true);
  });

  it('her kahramanın 4 yeteneği var: 1, 3, 6, 10. seviyede açılır', () => {
    for (const f of FACTIONS)
      for (const h of f.heroes) expect(h.abilities.map((a) => a.rank)).toEqual([1, 3, 6, 10]);
  });
});

describe('tabur başına donanım ve birleşik ordu', () => {
  it('donanım araştırma olmadan alınamaz; kurallara göre tabur başına satılır', () => {
    const sim = setup(41);
    spawn(sim, 0, UnitTypeId.GondorSoldier, 0, 0);
    spawn(sim, 0, UnitTypeId.GondorArcher, 30, 0);
    sim.step();
    const [sold, arch] = battalions(sim, 0).sort(
      (a, b) => (sim.world.c.Battalion.unitType[a] as number) - (sim.world.c.Battalion.unitType[b] as number),
    ) as [number, number];
    const G = sim.world.c.Battalion.gear;
    sim.world.match.gold[0] = 1000;
    sim.schedule(stamp(sim.world.tick, { type: 'buyGear', units: [sold, arch], upgrade: 0 }));
    sim.step();
    expect(G[sold]).toBe(0);
    expect(sim.world.match.gold[0]).toBe(1000);
    sim.world.match.upgrades[0] = 0b111;
    // Dövme Kılıç yalnızca yakın dövüşe, Ateşli Ok yalnızca okçuya.
    sim.schedule(stamp(sim.world.tick, { type: 'buyGear', units: [sold, arch], upgrade: 0 }));
    sim.schedule(stamp(sim.world.tick, { type: 'buyGear', units: [sold, arch], upgrade: 2 }));
    sim.schedule(stamp(sim.world.tick, { type: 'buyGear', units: [sold, arch], upgrade: 1 }));
    sim.step();
    expect(G[sold]).toBe(0b011);
    expect(G[arch]).toBe(0b110);
    expect(sim.world.match.gold[0]).toBe(
      1000 - GEAR_DEFS[0]!.cost - GEAR_DEFS[2]!.cost - 2 * GEAR_DEFS[1]!.cost,
    );
    expect(attackPercent(sim.world, sold, 0, true)).toBe(125);
  });

  it('yakın dövüş + okçu taburu yan yana birleşik ordu bonusu alır', () => {
    const sim = setup(42);
    spawn(sim, 0, UnitTypeId.GondorSoldier, 0, 0);
    spawn(sim, 0, UnitTypeId.GondorArcher, 10, 0);
    spawn(sim, 0, UnitTypeId.GondorSoldier, 120, 0);
    for (let t = 0; t < 6; t++) sim.step();
    const H = sim.world.c.Battalion.horde;
    const bs = battalions(sim, 0);
    const near = bs.filter((b) => (sim.world.c.Position.x[b] as number) < F(60));
    const far = bs.filter((b) => (sim.world.c.Position.x[b] as number) >= F(60));
    expect(near.every((b) => H[b] === 1)).toBe(true);
    expect(far.every((b) => H[b] === 0)).toBe(true);
    const arch = near.find((b) => sim.world.c.Battalion.unitType[b] === UnitTypeId.GondorArcher) as number;
    expect(attackPercent(sim.world, arch, 0, false)).toBe(115);
  });
});
