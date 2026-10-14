import { fxFromFloat, MAP_DEFS, type StampedCommand, UnitTypeId } from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, Simulation } from '../src';

const TW = MAP_DEFS.tower_wars;
const FORTRESS_DEFENCE = MAP_DEFS.fortress_defence as NonNullable<typeof TW>;
if (!TW) throw new Error('tower_wars yok');
let seq = 0;
const stamp = (tick: number, cmd: StampedCommand['cmd']): StampedCommand => ({
  tick,
  player: 0,
  seq: seq++,
  cmd,
});

describe('Kule Savaşı / Kale Savunması', () => {
  it('Kule Savaşı: 30 dalga, 4 şerit; Kale Savunması: 20 dalga, 4 kapı', () => {
    expect(TW.waves.length).toBe(30);
    expect(TW.lanes.length).toBe(4);
    expect(FORTRESS_DEFENCE.waves.length).toBe(20);
    expect(FORTRESS_DEFENCE.gates.length).toBe(4);
  });

  it('dalga başı altın verilir', () => {
    const sim = new Simulation(3, buildNavGrid(TW), TW);
    const first = Math.round((TW.waves[0]?.groups[0]?.atSec ?? 0) * 20);
    while (sim.world.tick < first) sim.step();
    const g0 = sim.world.match.gold[0] as number;
    sim.step();
    expect((sim.world.match.gold[0] as number) - g0).toBeGreaterThanOrEqual(TW.waveGold?.base ?? 1);
  });

  it('uç bölge: varan tabur kaybolmaz, vurulur ve beklerken can götürür', () => {
    const sim = new Simulation(3, buildNavGrid(TW), TW);
    const end = TW.lanes[0]?.points.at(-1) ?? [0, 0];
    sim.schedule(
      stamp(0, {
        type: 'spawnBattalion',
        team: 1,
        unitType: UnitTypeId.UrukHai,
        x: fxFromFloat(end[0]),
        z: fxFromFloat(end[1]),
        count: 1,
        facing: 0,
      }),
    );
    sim.step();
    const { Battalion, Team, Health, Soldier } = sim.world.c;
    const b = [...query(sim.world, [Battalion])].find((e) => Team.id[e] === 1) as number;
    Battalion.lane[b] = 1;
    const lives0 = sim.world.match.lives;
    const hp = () =>
      [...query(sim.world, [Soldier, Health])]
        .filter((s) => Soldier.battalion[s] === b)
        .reduce((a, s) => a + (Health.hp[s] as number), 0);
    const hp0 = hp();
    for (let i = 0; i < 20 * 11; i++) sim.step();
    expect(sim.world.match.lives).toBeLessThan(lives0);
    expect(sim.world.match.zone).toBeGreaterThanOrEqual(0);
    expect(hp()).toBeLessThan(hp0);
  });
});
