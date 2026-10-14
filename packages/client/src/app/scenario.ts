import {
  fxFromFloat,
  type MapDef,
  SNAP_UNIT_INTS,
  type SnapshotFrame,
  UnitTypeId,
  unpackTeam,
  type Vec2,
} from '@bulwark/shared';
import type { SimHost } from '../sim-host/SimHost';

/**
 * Phase 1 test senaryosu: savunan Gondor taburları ve rotalar boyunca gelen Isengard/Mordor
 * taburları. Adım 8'de dalga sistemi (WaveSpawnSystem) bunun yerini alacak.
 */
export const PLAYER = 0;
export const ENEMY_PLAYER = 1;

/** uint16 açılar: 0 = +X (doğu), 16384 = +Z (güney), 49152 = −Z (kuzey). */
const FACE_SOUTH = 16384;
const FACE_NORTH = 49152;

/** Karede görülen, verilen takıma ait tabur eid'leri. */
export const battalionsOfTeam = (frame: SnapshotFrame, team: number): Set<number> => {
  const out = new Set<number>();
  for (let i = 0; i < frame.count; i++) {
    const o = i * SNAP_UNIT_INTS;
    const b = frame.units[o + 5] as number;
    if (b !== 0 && unpackTeam(frame.units[o + 3] as number) === team) out.add(b);
  }
  return out;
};

export class Scenario {
  private pendingEnemyTargets: Vec2[] = [];
  private orderedEnemies = new Set<number>();
  private waveIndex = 0;

  constructor(
    private readonly sim: SimHost,
    private readonly def: MapDef | undefined,
  ) {
    sim.onFrame((frame) => this.onFrame(frame));
  }

  private spawn(
    team: number,
    unitType: number,
    x: number,
    z: number,
    count: number,
    facing: number,
    player: number,
  ) {
    this.sim.send(
      { type: 'spawnBattalion', team, unitType, x: fxFromFloat(x), z: fxFromFloat(z), count, facing },
      player,
    );
  }

  start(): void {
    if (!this.def) {
      this.spawn(0, UnitTypeId.GondorSoldier, 0, 40, 2, FACE_SOUTH, PLAYER);
      this.spawn(0, UnitTypeId.TowerGuard, 0, 52, 2, FACE_SOUTH, PLAYER);
      return;
    }
    // Deeping Wall arkasında Gondor askerleri + Tower Guard'lar, Hornburg avlusunda bir tabur.
    const wallZ = this.def.walls[0]?.points[0]?.[1] ?? 0;
    this.spawn(0, UnitTypeId.GondorSoldier, 0, wallZ - 16, 2, FACE_SOUTH, PLAYER);
    this.spawn(0, UnitTypeId.TowerGuard, 45, wallZ - 16, 2, FACE_SOUTH, PLAYER);
    const plateau = this.def.terrain.plateaus[0];
    if (plateau)
      this.spawn(
        0,
        UnitTypeId.GondorSoldier,
        plateau.center[0] + 3,
        plateau.center[1] + 3,
        1,
        FACE_SOUTH,
        PLAYER,
      );
    this.sendWave(3);
  }

  /** Sıradaki spawn noktasından `battalions` adet düşman taburu çıkarır (Orc / Uruk-hai dönüşümlü). */
  sendWave(battalions: number): void {
    if (!this.def) return;
    const unitType = this.waveIndex % 2 === 0 ? UnitTypeId.OrcWarrior : UnitTypeId.UrukHai;
    const spawn = this.def.spawns[this.waveIndex++ % this.def.spawns.length];
    if (!spawn) return;
    const lane = this.def.lanes.find((l) => l.id === spawn.lane);
    const target = lane?.points[lane.points.length - 1] ?? this.def.citadel.pos;
    this.spawn(1, unitType, spawn.pos[0], spawn.pos[1] - 10, battalions, FACE_NORTH, ENEMY_PLAYER);
    this.pendingEnemyTargets.push(target);
  }

  /** Seçili taburlara hareket emri. */
  order(battalions: Iterable<number>, x: number, z: number): void {
    const units = [...battalions];
    if (units.length === 0) return;
    this.sim.send(
      { type: 'move', units, x: fxFromFloat(x), z: fxFromFloat(z), spacing: fxFromFloat(1.5) },
      PLAYER,
    );
  }

  private onFrame(frame: SnapshotFrame): void {
    if (this.pendingEnemyTargets.length === 0) return;
    const fresh = [...battalionsOfTeam(frame, 1)].filter((b) => !this.orderedEnemies.has(b));
    if (fresh.length === 0) return;
    const target = this.pendingEnemyTargets.shift() as Vec2;
    for (const b of fresh) this.orderedEnemies.add(b);
    this.sim.send(
      {
        type: 'move',
        units: fresh,
        x: fxFromFloat(target[0]),
        z: fxFromFloat(target[1]),
        spacing: fxFromFloat(1.5),
      },
      ENEMY_PLAYER,
    );
  }
}
