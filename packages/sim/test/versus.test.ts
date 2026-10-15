import { MAP_DEFS, type MapDef, MatchState, type VersusSetup } from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { buildNavGrid, Simulation } from '../src';

const MAP = MAP_DEFS.vs_fords_of_isen as MapDef;
const setup = (ai0: number, ai1: number, f0 = 0, f1 = 4): VersusSetup => ({
  slots: [
    { team: 0, faction: f0, alliance: -1, ai: ai0, start: 0 },
    { team: 1, faction: f1, alliance: -1, ai: ai1, start: 1 },
  ],
  humans: ai0 < 0 ? [0] : [],
  startGold: 2000,
  cpLimit: 1000,
});
const sim = (s: VersusSetup, seed = 7) =>
  new Simulation(seed, buildNavGrid(MAP), MAP, 1, s.slots[0]?.faction ?? 0, -1, s);

describe('çatışma (VS)', () => {
  it('her yuvaya kale, altın ve işçi; komutlar oyuncunun takımına gider', () => {
    const s = sim(setup(-1, 1));
    const m = s.world.match;
    expect(m.versus).toBe(true);
    expect(m.fortresses[0]).not.toBe(0);
    expect(m.fortresses[1]).not.toBe(0);
    expect(m.gold[1]).toBe(2000);
    expect(m.factions[1]).toBe(4);
    const { Battalion, Team } = s.world.c;
    const workers = [...query(s.world, [Battalion])].filter((b) => Team.id[b] === 1);
    expect(workers.length).toBe(2);
  });

  it('bilgisayar inşa eder, ordu kurar ve saldırır; maç biter', () => {
    const s = sim(setup(3, 0), 11);
    const m = s.world.match;
    let built = false;
    for (let t = 0; t < 20 * 60 * 25 && m.state === MatchState.Playing; t++) {
      s.step();
      if (!built && t % 200 === 0) {
        const { Structure, Team } = s.world.c;
        built = [...query(s.world, [Structure])].some((e) => Team.id[e] === 0 && Structure.kind[e] === 2);
      }
    }
    expect(built).toBe(true);
    expect(m.kills[0] + m.kills[1]).toBeGreaterThan(0);
    expect(m.state).toBe(MatchState.Victory);
    expect(m.teamState[0]).toBe(MatchState.Victory);
    expect(m.teamState[1]).toBe(MatchState.Defeat);
  }, 240_000);
});
