import {
  COMMAND_POINTS,
  fxFromFloat,
  HELMS_DEEP,
  type MapDef,
  type StampedCommand,
  UnitTypeId,
} from '@bulwark/shared';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, Simulation } from '../src';
import { commandPoints } from '../src/systems/commandPoints';
import { spawnBattalion } from '../src/systems/commands';

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
const PLOT = HELMS_DEEP.slots.findIndex((s) => s.kind === 'building');

describe('komuta puanı', () => {
  it('tavan dolunca kışla yetiştirmeyi reddeder', () => {
    const sim = new Simulation(3, buildNavGrid(QUIET), QUIET);
    sim.world.match.gold[0] = 100_000;
    sim.schedule(stamp(0, { type: 'build', slot: PLOT, kind: 1 }));
    sim.step();
    const barracks = sim.world.match.slots[PLOT] as number;
    while ((sim.world.c.Structure.buildLeft[barracks] as number) > 0) sim.step();
    const base = commandPoints(sim.world, 0);
    expect(base.cap).toBe(COMMAND_POINTS.base);
    // Tavana kadar Gondor taburu (20 puan) doldur.
    while (commandPoints(sim.world, 0).used + 20 <= COMMAND_POINTS.base)
      spawnBattalion(sim.world, 0, UnitTypeId.GondorSoldier, fxFromFloat(0), fxFromFloat(-40), 16384);
    const t = sim.world.tick;
    sim.schedule(stamp(t, { type: 'train', building: barracks, unitType: UnitTypeId.GondorSoldier }));
    sim.step();
    expect(sim.world.c.Structure.qLen[barracks]).toBe(0);
  });
});
