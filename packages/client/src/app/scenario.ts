import { fxFromFloat, type MapDef, UnitTypeId } from '@bulwark/shared';
import type { SimHost } from '../sim-host/SimHost';

/**
 * Oyuncu tarafı kurulum ve emirler. Düşman dalgaları artık simülasyonda (WaveSpawnSystem,
 * harita verisindeki dalga programı); burada yalnızca savunucular yerleştirilir ve oyuncu
 * emirleri komuta çevrilir.
 */
export const PLAYER = 0;

/** uint16 açılar: 0 = +X (doğu), 16384 = +Z (güney). */
const FACE_SOUTH = 16384;

export class Scenario {
  constructor(
    private readonly sim: SimHost,
    private readonly def: MapDef | undefined,
  ) {}

  private spawn(unitType: number, x: number, z: number, count: number) {
    this.sim.send(
      {
        type: 'spawnBattalion',
        team: 0,
        unitType,
        x: fxFromFloat(x),
        z: fxFromFloat(z),
        count,
        facing: FACE_SOUTH,
      },
      PLAYER,
    );
  }

  /** Başlangıç savunması (GDD §10.1): sur arkasında okçular + piyade, Hornburg'da garnizon. */
  start(): void {
    if (!this.def) {
      this.spawn(UnitTypeId.GondorSoldier, 0, 40, 2);
      this.spawn(UnitTypeId.GondorArcher, 0, 52, 2);
      return;
    }
    const wallZ = this.def.walls[0]?.points[0]?.[1] ?? 0;
    // Okçular surun hemen arkasında (menfez önünü ve sur önünü menzilde tutar).
    this.spawn(UnitTypeId.GondorArcher, 20, wallZ - 9, 2);
    // Piyade ikinci hatta: menfezden çıkış (sortie) için hazır.
    this.spawn(UnitTypeId.GondorSoldier, 2, wallZ - 22, 2);
    this.spawn(UnitTypeId.TowerGuard, 46, wallZ - 22, 2);
    const plateau = this.def.terrain.plateaus[0];
    if (plateau) {
      const [px, pz] = plateau.center;
      this.spawn(UnitTypeId.GondorArcher, px + 6, pz + 6, 1);
      this.spawn(UnitTypeId.GondorSoldier, px - 4, pz - 2, 2);
    }
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

  /** Seçili taburlarla düşman taburuna saldır. */
  attack(battalions: Iterable<number>, target: number): void {
    const units = [...battalions];
    if (units.length === 0 || target <= 0) return;
    this.sim.send({ type: 'attack', units, target }, PLAYER);
  }
}
