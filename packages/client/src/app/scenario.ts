import {
  fxFromFloat,
  type MapDef,
  SNAP_UNIT_INTS,
  type SnapshotFrame,
  unpackTeam,
  type Vec2,
} from '@bulwark/shared';
import type { SimHost } from '../sim-host/SimHost';

/**
 * Phase 1 test senaryosu (Adım 5): sim hattını uçtan uca doğrulamak için
 * savunan taburları ve güneyden yürüyen bir düşman ordusu oluşturur.
 * Adım 8'de dalga sistemi (WaveSpawnSystem) ve gerçek birim tanımları bunun yerini alacak.
 */
export const PLAYER = 0;
export const ENEMY_PLAYER = 1;

export const unitsOfTeam = (frame: SnapshotFrame, team: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < frame.count; i++) {
    const o = i * SNAP_UNIT_INTS;
    if (unpackTeam(frame.units[o + 3] as number) === team) out.push(frame.units[o] as number);
  }
  return out;
};

export class Scenario {
  /** Spawn edilip henüz emir verilmemiş düşmanlar için bekleyen hedefler. */
  private pendingEnemyTargets: Vec2[] = [];
  private orderedEnemies = new Set<number>();
  private waveIndex = 0;

  constructor(
    private readonly sim: SimHost,
    private readonly def: MapDef | undefined,
  ) {
    sim.onFrame((frame) => this.onFrame(frame));
  }

  start(): void {
    const at = (x: number, z: number) => ({ x: fxFromFloat(x), z: fxFromFloat(z) });
    if (!this.def) {
      this.sim.send(
        { type: 'spawn', team: 0, unitType: 0, ...at(0, 40), count: 64, spacing: fxFromFloat(1.6) },
        PLAYER,
      );
      return;
    }
    // Savunucular: Deeping Wall arkasında iki tabur, Hornburg avlusunda bir tabur.
    const wallZ = this.def.walls[0]?.points[0]?.[1] ?? 0;
    for (const x of [-2, 40]) {
      this.sim.send(
        { type: 'spawn', team: 0, unitType: 0, ...at(x, wallZ - 14), count: 60, spacing: fxFromFloat(1.6) },
        PLAYER,
      );
    }
    const plateau = this.def.terrain.plateaus[0];
    if (plateau) {
      const [px, pz] = plateau.center;
      this.sim.send(
        { type: 'spawn', team: 0, unitType: 0, ...at(px + 4, pz + 4), count: 36, spacing: fxFromFloat(1.6) },
        PLAYER,
      );
    }
    this.sendWave(240);
  }

  /** Spawn noktalarından sırayla bir düşman grubu çıkarır ve koridor sonuna yürütür. */
  sendWave(count: number): void {
    if (!this.def) return;
    const spawn = this.def.spawns[this.waveIndex++ % this.def.spawns.length];
    if (!spawn) return;
    const lane = this.def.lanes.find((l) => l.id === spawn.lane);
    const target = lane?.points[lane.points.length - 1] ?? this.def.citadel.pos;
    this.sim.send(
      {
        type: 'spawn',
        team: 1,
        unitType: 1,
        x: fxFromFloat(spawn.pos[0]),
        z: fxFromFloat(spawn.pos[1] - 12),
        count,
        spacing: fxFromFloat(1.5),
      },
      ENEMY_PLAYER,
    );
    this.pendingEnemyTargets.push(target);
  }

  /** Sağ tık: oyuncunun tüm birimlerini hedefe yürüt (Adım 7'de seçim + tabur emirleri gelecek). */
  moveAll(x: number, z: number): void {
    const units = unitsOfTeam(this.sim.frame, 0);
    if (units.length === 0) return;
    this.sim.send(
      { type: 'move', units, x: fxFromFloat(x), z: fxFromFloat(z), spacing: fxFromFloat(1.6) },
      PLAYER,
    );
  }

  private onFrame(frame: SnapshotFrame): void {
    if (this.pendingEnemyTargets.length === 0) return;
    const fresh = unitsOfTeam(frame, 1).filter((e) => !this.orderedEnemies.has(e));
    if (fresh.length === 0) return;
    const target = this.pendingEnemyTargets.shift() as Vec2;
    for (const e of fresh) this.orderedEnemies.add(e);
    this.sim.send(
      {
        type: 'move',
        units: fresh,
        x: fxFromFloat(target[0]),
        z: fxFromFloat(target[1] + 8),
        spacing: fxFromFloat(1.5),
      },
      ENEMY_PLAYER,
    );
  }
}
