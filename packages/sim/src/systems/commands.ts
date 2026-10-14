import { FX_ONE, type Fx, fxFromInt, fxMul, type StampedCommand } from '@bulwark/shared';
import { addComponent, addEntity, entityExists } from 'bitecs';
import type { SimWorld } from '../world';

/** Oyuncu → takım eşlemesi (Phase 1: oyuncu N = takım N). Co-op'ta lobi belirleyecek. */
const teamOf = (player: number): number => player;

/** Birim tipi başına temel değerler (Phase 1 placeholder; data/units Adım 8'de gelecek). */
const UNIT_SPEED: Record<number, Fx> = { 0: fxFromInt(4) + (FX_ONE >> 1), 1: fxFromInt(5) };
const UNIT_HP: Record<number, number> = { 0: 100, 1: 60 };

export const spawnUnit = (world: SimWorld, team: number, unitType: number, x: Fx, z: Fx): number => {
  const { Position, Velocity, Facing, Team, UnitType, Speed, MoveTarget, Health, Anim } = world.c;
  const eid = addEntity(world);
  for (const comp of [Position, Velocity, Facing, Team, UnitType, Speed, MoveTarget, Health, Anim])
    addComponent(world, eid, comp);
  Position.x[eid] = x;
  Position.z[eid] = z;
  Velocity.x[eid] = 0;
  Velocity.z[eid] = 0;
  // Başlangıçta karşı tarafa bak: takım 0 güneye (+Z), diğerleri kuzeye.
  Facing.angle[eid] = team === 0 ? 16384 : 49152;
  Team.id[eid] = team;
  UnitType.id[eid] = unitType;
  Speed.value[eid] = UNIT_SPEED[unitType] ?? fxFromInt(4);
  MoveTarget.active[eid] = 0;
  const hp = UNIT_HP[unitType] ?? 100;
  Health.hp[eid] = hp;
  Health.max[eid] = hp;
  Anim.state[eid] = 0;
  Anim.startTick[eid] = world.tick;
  return eid;
};

/** Kare ızgara ofseti: i. eleman için (dx, dz), merkezlenmiş. Tamamen tamsayı aritmetiği. */
const gridOffset = (i: number, n: number, spacing: Fx): [Fx, Fx] => {
  let cols = 1;
  while (cols * cols < n) cols++;
  const rows = Math.ceil(n / cols);
  const col = i % cols;
  const row = (i / cols) | 0;
  // (col - (cols-1)/2) · spacing  =  (2·col - (cols-1)) · spacing / 2
  return [
    fxMul(fxFromInt(2 * col - (cols - 1)), spacing) >> 1,
    fxMul(fxFromInt(2 * row - (rows - 1)), spacing) >> 1,
  ];
};

/** Komut listesindeki birimleri doğrular: var olmalı ve oyuncunun takımına ait olmalı; eid'e göre sıralı. */
const ownedUnits = (world: SimWorld, player: number, units: readonly number[]): number[] => {
  const team = teamOf(player);
  const out: number[] = [];
  for (const eid of units) {
    if (Number.isInteger(eid) && eid > 0 && entityExists(world, eid) && world.c.Team.id[eid] === team)
      out.push(eid);
  }
  return out.sort((a, b) => a - b);
};

export const applyCommand = (world: SimWorld, sc: StampedCommand): void => {
  const { cmd } = sc;
  const { MoveTarget, Velocity } = world.c;
  switch (cmd.type) {
    case 'spawn': {
      const n = Math.min(cmd.count, 2000);
      for (let i = 0; i < n; i++) {
        const [dx, dz] = gridOffset(i, n, cmd.spacing);
        spawnUnit(world, cmd.team, cmd.unitType, (cmd.x + dx) | 0, (cmd.z + dz) | 0);
      }
      break;
    }
    case 'move': {
      const units = ownedUnits(world, sc.player, cmd.units);
      units.forEach((eid, i) => {
        const [dx, dz] = gridOffset(i, units.length, cmd.spacing);
        MoveTarget.x[eid] = (cmd.x + dx) | 0;
        MoveTarget.z[eid] = (cmd.z + dz) | 0;
        MoveTarget.active[eid] = 1;
      });
      break;
    }
    case 'stop': {
      for (const eid of ownedUnits(world, sc.player, cmd.units)) {
        MoveTarget.active[eid] = 0;
        Velocity.x[eid] = 0;
        Velocity.z[eid] = 0;
      }
      break;
    }
  }
};
