import { HELMS_DEEP, heroRoster, type StampedCommand, UnitTypeId } from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, Simulation } from '../src';

const stamp = (tick: number, cmd: StampedCommand['cmd']): StampedCommand => ({
  tick,
  player: 0,
  seq: 0,
  cmd,
});

describe('Kahraman Yarat', () => {
  it('seçilen sınıf 3. kahramanın yerini alır ve çağrılabilir', () => {
    expect(heroRoster(0, 1)[2]?.unitType).toBe(UnitTypeId.CahArcher);
    expect(heroRoster(0)[2]?.unitType).toBe(UnitTypeId.Legolas);
    const sim = new Simulation(4, buildNavGrid(HELMS_DEEP), HELMS_DEEP, 1, 0, 1);
    sim.world.match.gold[0] = 10_000;
    sim.schedule(stamp(0, { type: 'summonHero', unitType: UnitTypeId.CahArcher }));
    sim.schedule(stamp(0, { type: 'summonHero', unitType: UnitTypeId.Legolas })); // kadroda değil
    sim.step();
    const { Battalion, Team } = sim.world.c;
    const types = [...query(sim.world, [Battalion])]
      .filter((b) => Team.id[b] === 0)
      .map((b) => Battalion.unitType[b]);
    expect(types).toContain(UnitTypeId.CahArcher);
    expect(types).not.toContain(UnitTypeId.Legolas);
  });
});
