import { factionDef, fxFromFloat, type MapDef, UnitTypeId } from '@bulwark/shared';
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
    private readonly faction = 0,
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

  /** Başlangıç garnizonu (harita verisi; GDD §10): her giriş = konumda yan yana tabur(lar). */
  start(): void {
    if (!this.def) {
      this.spawn(UnitTypeId.GondorSoldier, 0, 40, 2);
      this.spawn(UnitTypeId.GondorArcher, 0, 52, 2);
      return;
    }
    // Garnizon Gondor birimleriyle tanımlı; taraf karşılığına çevrilir (Rohan: mızrakçı, okçu).
    const map = factionDef(this.faction).garrison;
    for (const g of this.def.garrison ?? [])
      this.spawn(map[g.unitType] ?? g.unitType, g.pos[0], g.pos[1], g.count);
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

  /** Slota yapı kur (kind: BUILDING_KINDS indeksi). */
  build(slot: number, kind: number): void {
    this.sim.send({ type: 'build', slot, kind }, PLAYER);
  }

  /** Kışlada birim yetiştir. */
  train(building: number, unitType: number): void {
    this.sim.send({ type: 'train', building, unitType }, PLAYER);
  }

  /** Demirhanede yükseltme araştır. */
  research(building: number, upgrade: number): void {
    this.sim.send({ type: 'research', building, upgrade }, PLAYER);
  }

  /** Bina seviyesini yükselt. */
  upgradeBuilding(building: number): void {
    this.sim.send({ type: 'upgradeBuilding', building }, PLAYER);
  }

  /** Binayı sat (%50 iade). */
  sellBuilding(building: number): void {
    this.sim.send({ type: 'sellBuilding', building }, PLAYER);
  }

  /** Kapıyı onar (kapı indeksi). */
  repair(gate: number): void {
    this.sim.send({ type: 'repair', gate }, PLAYER);
  }

  summonHero(unitType: number): void {
    this.sim.send({ type: 'summonHero', unitType }, PLAYER);
  }

  ability(unit: number, ability: number): void {
    this.sim.send({ type: 'ability', unit, ability }, PLAYER);
  }

  unlockSpell(spell: number): void {
    this.sim.send({ type: 'unlockSpell', spell }, PLAYER);
  }

  castSpell(spell: number, x: number, z: number): void {
    this.sim.send({ type: 'castSpell', spell, x: fxFromFloat(x), z: fxFromFloat(z) }, PLAYER);
  }

  /** Kale yükseltmesi. */
  fortressUpgrade(upgrade: number): void {
    this.sim.send({ type: 'fortressUpgrade', upgrade }, PLAYER);
  }

  /** Seçili taburların duruşu (Stance). */
  stance(battalions: Iterable<number>, stance: number): void {
    const units = [...battalions];
    if (units.length > 0) this.sim.send({ type: 'stance', units, stance }, PLAYER);
  }

  /** Seçili taburlara sancaktar al. */
  buyBanner(battalions: Iterable<number>): void {
    const units = [...battalions];
    if (units.length > 0) this.sim.send({ type: 'buyBanner', units }, PLAYER);
  }

  /** Taburlara demirhane donanımı al. */
  buyGear(battalions: Iterable<number>, upgrade: number): void {
    const units = [...battalions];
    if (units.length > 0) this.sim.send({ type: 'buyGear', units, upgrade }, PLAYER);
  }

  /** Seçili taburları durdur. */
  stop(battalions: Iterable<number>): void {
    const units = [...battalions];
    if (units.length > 0) this.sim.send({ type: 'stop', units }, PLAYER);
  }

  /** Seçili taburlarla düşman taburuna saldır. */
  attack(battalions: Iterable<number>, target: number): void {
    const units = [...battalions];
    if (units.length === 0 || target <= 0) return;
    this.sim.send({ type: 'attack', units, target }, PLAYER);
  }
}
