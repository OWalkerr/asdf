import {
  createFrame,
  createSnapshotView,
  FX_ONE,
  fxFromInt,
  readLatestSnapshot,
  SNAP_UNIT_INTS,
  type StampedCommand,
  unpackTeam,
  unpackUnitType,
} from '@bulwark/shared';
import { query } from 'bitecs';
import { describe, expect, it } from 'vitest';
import { CommandQueue, Simulation } from '../src';

const stamp = (tick: number, player: number, seq: number, cmd: StampedCommand['cmd']): StampedCommand => ({
  tick,
  player,
  seq,
  cmd,
});

const spawn = (team: number, x: number, z: number, count: number) =>
  ({
    type: 'spawn',
    team,
    unitType: team,
    x: fxFromInt(x),
    z: fxFromInt(z),
    count,
    spacing: fxFromInt(2),
  }) as const;

const units = (sim: Simulation, team: number) =>
  [...query(sim.world, [sim.world.c.Team])].filter((e) => sim.world.c.Team.id[e] === team);

describe('CommandQueue', () => {
  it('tick → player → seq sırasıyla ve geldiği sıradan bağımsız verir', () => {
    const q = new CommandQueue();
    const stop = { type: 'stop', units: [] } as const;
    q.push(stamp(2, 1, 0, stop));
    q.push(stamp(1, 1, 5, stop));
    q.push(stamp(1, 0, 9, stop));
    q.push(stamp(1, 1, 2, stop));
    q.push(stamp(5, 0, 0, stop));
    expect(q.take(2).map((c) => [c.tick, c.player, c.seq])).toEqual([
      [1, 0, 9],
      [1, 1, 2],
      [1, 1, 5],
      [2, 1, 0],
    ]);
    expect(q.size).toBe(1);
  });
});

describe('Simulation', () => {
  it('spawn ve move: birimler formasyon hedeflerine varır ve durur', () => {
    const sim = new Simulation(1);
    sim.schedule(stamp(0, 0, 0, spawn(0, 0, 0, 9)));
    sim.step();
    const own = units(sim, 0);
    expect(own.length).toBe(9);
    sim.schedule(
      stamp(sim.tick, 0, 1, {
        type: 'move',
        units: own,
        x: fxFromInt(20),
        z: fxFromInt(10),
        spacing: fxFromInt(2),
      }),
    );
    for (let i = 0; i < 200; i++) sim.step();
    const { Position, MoveTarget, Velocity } = sim.world.c;
    let cx = 0;
    let cz = 0;
    for (const e of own) {
      expect(MoveTarget.active[e]).toBe(0);
      expect(Velocity.x[e]).toBe(0);
      cx += Position.x[e] as number;
      cz += Position.z[e] as number;
    }
    // Formasyon merkezi hedefte.
    expect(Math.round(cx / own.length / FX_ONE)).toBe(20);
    expect(Math.round(cz / own.length / FX_ONE)).toBe(10);
  });

  it('başka takımın birimlerine verilen emir yok sayılır', () => {
    const sim = new Simulation(1);
    sim.schedule(stamp(0, 0, 0, spawn(1, 50, 50, 4)));
    sim.step();
    const enemy = units(sim, 1);
    sim.schedule(stamp(sim.tick, 0, 1, { type: 'move', units: enemy, x: 0, z: 0, spacing: FX_ONE }));
    sim.step();
    for (const e of enemy) expect(sim.world.c.MoveTarget.active[e]).toBe(0);
  });

  it('aynı komut akışı → aynı hash (komutlar farklı sırada kuyruğa girse bile)', () => {
    const run = (reverse: boolean) => {
      const sim = new Simulation(77);
      const cmds = [stamp(0, 0, 0, spawn(0, -30, 0, 200)), stamp(0, 1, 0, spawn(1, 30, 0, 200))];
      for (const c of reverse ? cmds.reverse() : cmds) sim.schedule(c);
      sim.step();
      const moveA = {
        type: 'move',
        units: units(sim, 0),
        x: fxFromInt(25),
        z: fxFromInt(5),
        spacing: fxFromInt(2),
      } as const;
      const moveB = {
        type: 'move',
        units: units(sim, 1),
        x: fxFromInt(-25),
        z: fxFromInt(-5),
        spacing: fxFromInt(2),
      } as const;
      const later = [stamp(3, 1, 1, moveB), stamp(3, 0, 1, moveA)];
      for (const c of reverse ? later.reverse() : later) sim.schedule(c);
      const hashes: number[] = [];
      for (let i = 0; i < 120; i++) {
        sim.step();
        if (i % 20 === 0) hashes.push(sim.hash());
      }
      return hashes;
    };
    expect(run(false)).toEqual(run(true));
  });
});

describe('snapshot (SharedArrayBuffer)', () => {
  it('yazılan birimler okunur; yeni tick yoksa okuma false döner', () => {
    const sim = new Simulation(3);
    sim.schedule(stamp(0, 0, 0, spawn(0, 0, 0, 5)));
    sim.schedule(stamp(0, 1, 0, spawn(1, 10, 0, 3)));
    sim.step();
    const view = createSnapshotView(64, true);
    expect(view.buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(sim.writeSnapshot(view, 1234)).toBe(8);

    const frame = createFrame(64);
    expect(readLatestSnapshot(view, frame)).toBe(true);
    expect(frame.tick).toBe(1);
    expect(frame.count).toBe(8);
    expect(frame.simMicros).toBe(1234);
    const teams = Array.from({ length: frame.count }, (_, i) =>
      unpackTeam(frame.units[i * SNAP_UNIT_INTS + 3] as number),
    );
    expect(teams.filter((t) => t === 1).length).toBe(3);
    expect(unpackUnitType(frame.units[3] as number)).toBe(0);
    expect(readLatestSnapshot(view, frame)).toBe(false);

    sim.step();
    sim.writeSnapshot(view);
    expect(readLatestSnapshot(view, frame)).toBe(true);
    expect(frame.tick).toBe(2);
  });

  it('kapasite aşılırsa kırpar', () => {
    const sim = new Simulation(3);
    sim.schedule(stamp(0, 0, 0, spawn(0, 0, 0, 20)));
    sim.step();
    const view = createSnapshotView(10, false);
    expect(sim.writeSnapshot(view)).toBe(10);
  });
});

describe('komut doğrulama', () => {
  it('bilinmeyen birim tipi / takım içeren spawn yok sayılır', () => {
    const sim = new Simulation(9);
    sim.schedule(
      stamp(0, 0, 0, { type: 'spawn', team: 0, unitType: 99, x: 0, z: 0, count: 5, spacing: FX_ONE }),
    );
    sim.schedule(
      stamp(0, 0, 1, { type: 'spawn', team: 9, unitType: 0, x: 0, z: 0, count: 5, spacing: FX_ONE }),
    );
    expect(() => sim.step()).not.toThrow();
    expect(query(sim.world, [sim.world.c.Position]).length).toBe(0);
  });

  it('birim tablosundan hız ve can alınır', () => {
    const sim = new Simulation(9);
    sim.schedule(
      stamp(0, 0, 0, { type: 'spawn', team: 0, unitType: 2, x: 0, z: 0, count: 1, spacing: FX_ONE }),
    );
    sim.step();
    const [eid] = query(sim.world, [sim.world.c.Position]);
    expect(sim.world.c.Health.max[eid as number]).toBe(140);
    expect(sim.world.c.Speed.value[eid as number]).toBe(4 * FX_ONE);
  });
});
