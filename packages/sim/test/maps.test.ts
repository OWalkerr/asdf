import { fxFromFloat, MAP_DEFS, type MapDef, MatchState, type Vec2, validateMap } from '@bulwark/shared';
import { describe, expect, it } from 'vitest';
import { blockedFor, buildNavGrid, COST_INF, cellAt, FlowFieldCache, Simulation } from '../src';

const at = (p: Vec2) => [fxFromFloat(p[0]), fxFromFloat(p[1])] as const;

describe.each(Object.values(MAP_DEFS).map((m) => [m.id, m] as [string, MapDef]))('harita %s', (_id, map) => {
  const grid = buildNavGrid(map);
  const cell = (p: Vec2) => cellAt(grid, ...at(p));

  it('veri tutarlı', () => {
    expect(validateMap(map)).toEqual([]);
  });

  it('spawn noktaları ve kale kapısı önü açık', () => {
    for (const s of map.spawns) expect(blockedFor(grid, cell(s.pos), 1), s.id).toBe(false);
    if (map.citadel.door) expect(blockedFor(grid, cell(map.citadel.door), 0)).toBe(false);
  });

  it('her koridorun ilk hedefi kendi spawn noktasından ulaşılabilir', () => {
    const cache = new FlowFieldCache(grid);
    for (const s of map.spawns) {
      const lane = map.lanes.find((l) => l.id === s.lane);
      const end = lane?.points[lane.points.length - 1] as Vec2;
      const f = cache.get(...at(end), 1);
      expect(f, `${s.id} alan`).not.toBeNull();
      expect(f?.cost[cell(s.pos)], `${s.id} → ${lane?.id}`).toBeLessThan(COST_INF);
    }
  });

  if (map.mode === 'FD') {
    it('kapılar sağlamken kale kapısına yol yok; zincir kırılınca var', () => {
      const door = map.citadel.door as Vec2;
      const before = new FlowFieldCache(grid).get(...at(door), 1);
      for (const s of map.spawns) expect(before?.cost[cell(s.pos)], `${s.id} önce`).toBe(COST_INF);
      // Tüm kapılar kırılır (gedik): sim içinde.
      const sim = new Simulation(1, buildNavGrid(map), map);
      for (const g of sim.world.match.gates) sim.world.c.Structure.hp[g] = 0;
      sim.step();
      const after = new FlowFieldCache(sim.world.nav).get(...at(door), 1);
      for (const s of map.spawns)
        expect(after?.cost[cellAt(sim.world.nav, ...at(s.pos))], `${s.id} sonra`).toBeLessThan(COST_INF);
    });
  }

  it('maç kurulur ve ilk dalga çıkar', () => {
    const sim = new Simulation(2, grid, map);
    const first = Math.min(...map.waves.flatMap((w) => w.groups.map((g) => g.atSec)));
    for (let t = 0; t < (first + 2) * 20; t++) sim.step();
    expect(sim.world.match.state).toBe(MatchState.Playing);
    expect(sim.world.match.waveIndex).toBe(1);
    expect(sim.world.match.enemiesAlive).toBeGreaterThan(0);
  });
});
