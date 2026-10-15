import {
  BUILD_RADIUS,
  BUILDING_DEFS,
  BUILDING_KINDS,
  fxFromFloat,
  MAP_DEFS,
  type MapDef,
  type StampedCommand,
  UnitTypeId,
} from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, placementError, Simulation } from '../src';
import { structureFootprints } from '../src/systems/workers';

const F = fxFromFloat;
let seq = 0;
const stamp = (tick: number, cmd: StampedCommand['cmd']): StampedCommand => ({
  tick,
  player: 0,
  seq: seq++,
  cmd,
});
const FD = MAP_DEFS.stoneshield as MapDef;
const QUIET: MapDef = {
  ...FD,
  waves: [
    { name: 'uzak', groups: [{ atSec: 9999, spawn: FD.spawns[0]?.id ?? '', unitType: 1, battalions: 1 }] },
  ],
};
const TOWER = BUILDING_KINDS.indexOf('arrow_tower');

/** Kaleye yakın, geçerli ilk yerleşim noktası (spiral tarama). */
const findSpot = (sim: Simulation, r: number): [number, number] => {
  const c = QUIET.citadel.pos;
  for (let d = 18; d < 120; d += 3)
    for (let a = 0; a < 24; a++) {
      const x = Math.round(c[0] + Math.cos((a / 24) * Math.PI * 2) * d);
      const z = Math.round(c[1] + Math.sin((a / 24) * Math.PI * 2) * d);
      if (placementError(QUIET, sim.world.nav, x, z, r, structureFootprints(sim.world)) === null)
        return [x, z];
    }
  throw new Error('yer yok');
};

const setup = () => {
  const sim = new Simulation(5, buildNavGrid(QUIET), QUIET);
  const door = QUIET.citadel.door ?? [QUIET.citadel.pos[0], QUIET.citadel.pos[1] + QUIET.citadel.radius + 4];
  sim.schedule(
    stamp(0, {
      type: 'spawnBattalion',
      team: 0,
      unitType: UnitTypeId.Worker,
      x: F(door[0]),
      z: F(door[1]),
      count: 2,
      facing: 16384,
    }),
  );
  sim.step();
  const workers = [...query(sim.world, [sim.world.c.Battalion])].filter(
    (b) => sim.world.c.Battalion.unitType[b] === UnitTypeId.Worker,
  );
  return { sim, workers };
};

describe('işçiler ve serbest inşa', () => {
  it('işçi uygun yere kule kurar; inşaat yalnızca işçi başındayken ilerler', () => {
    const { sim, workers } = setup();
    expect(workers.length).toBe(2);
    const w = workers[0] as number;
    const [x, z] = findSpot(sim, BUILD_RADIUS.arrow_tower);
    sim.world.match.gold[0] = 5000;
    sim.schedule(stamp(sim.world.tick, { type: 'construct', worker: w, kind: TOWER, x: F(x), z: F(z) }));
    sim.step();
    const S = sim.world.c.Structure;
    const tower = [...query(sim.world, [S])].find((e) => S.kind[e] === TOWER + 1) as number;
    expect(tower).toBeDefined();
    expect(sim.world.match.gold[0]).toBe(5000 - BUILDING_DEFS.arrow_tower.cost);
    expect(S.needsWorker[tower]).toBe(1);
    expect(S.slot[tower]).toBeGreaterThanOrEqual(QUIET.slots.length);
    const total = S.buildLeft[tower] as number;
    // İşçi yürüyüp başına varınca ilerler ve biter.
    for (let t = 0; t < 3000 && (S.buildLeft[tower] as number) > 0; t++) sim.step();
    expect(S.buildLeft[tower]).toBe(0);
    expect(S.needsWorker[tower]).toBe(0);
    expect(sim.world.tick).toBeGreaterThan(total);
  });

  it('yol, kale ve başka yapıyla çakışan yerleşim reddedilir', () => {
    const { sim, workers } = setup();
    const w = workers[0] as number;
    sim.world.match.gold[0] = 5000;
    const lane = QUIET.lanes[0]?.points[1] ?? [0, 0];
    sim.schedule(
      stamp(sim.world.tick, { type: 'construct', worker: w, kind: TOWER, x: F(lane[0]), z: F(lane[1]) }),
    );
    const c = QUIET.citadel.pos;
    sim.schedule(
      stamp(sim.world.tick, { type: 'construct', worker: w, kind: TOWER, x: F(c[0]), z: F(c[1]) }),
    );
    sim.step();
    expect(sim.world.match.gold[0]).toBe(5000);
    const [x, z] = findSpot(sim, BUILD_RADIUS.arrow_tower);
    sim.schedule(stamp(sim.world.tick, { type: 'construct', worker: w, kind: TOWER, x: F(x), z: F(z) }));
    sim.schedule(stamp(sim.world.tick, { type: 'construct', worker: w, kind: TOWER, x: F(x + 1), z: F(z) }));
    sim.step();
    expect(sim.world.match.gold[0]).toBe(5000 - BUILDING_DEFS.arrow_tower.cost);
  });

  it('satılan serbest yapının tabanı nav’a geri açılır', () => {
    const { sim, workers } = setup();
    const [x, z] = findSpot(sim, BUILD_RADIUS.farm);
    sim.world.match.gold[0] = 5000;
    const before = Uint8Array.from(sim.world.nav.blocked);
    sim.schedule(
      stamp(sim.world.tick, {
        type: 'construct',
        worker: workers[0] as number,
        kind: BUILDING_KINDS.indexOf('farm'),
        x: F(x),
        z: F(z),
      }),
    );
    sim.step();
    const S = sim.world.c.Structure;
    const farm = [...query(sim.world, [S])].find(
      (e) => (S.slot[e] as number) >= QUIET.slots.length,
    ) as number;
    expect(sim.world.nav.blocked).not.toEqual(before);
    sim.schedule(stamp(sim.world.tick, { type: 'sellBuilding', building: farm }));
    sim.step();
    expect(sim.world.nav.blocked).toEqual(before);
  });

  it('kaleden işçi yetiştirilir; bekleme süresi var', () => {
    const { sim } = setup();
    sim.world.match.gold[0] = 5000;
    const count = () =>
      [...query(sim.world, [sim.world.c.Battalion])].filter(
        (b) => sim.world.c.Battalion.unitType[b] === UnitTypeId.Worker,
      ).length;
    sim.schedule(stamp(sim.world.tick, { type: 'trainWorker' }));
    sim.schedule(stamp(sim.world.tick, { type: 'trainWorker' }));
    sim.step();
    expect(count()).toBe(3);
    for (let t = 0; t < 8 * 20 + 1; t++) sim.step();
    sim.schedule(stamp(sim.world.tick, { type: 'trainWorker' }));
    sim.step();
    expect(count()).toBe(4);
  });
});
