import type { DamageType } from './units';
import { UnitTypeId } from './units';

/**
 * İnşa edilebilir yapılar (GDD §4, §7.1, §7.5). Slot türüne göre izinli; maliyet altın,
 * süreler saniye. Okçu kulesi menzildeki düşman taburlarına ok atar; kışla tabur yetiştirir.
 */
export type BuildingKind = 'arrow_tower' | 'barracks';

export interface BuildingDef {
  kind: BuildingKind;
  name: string;
  cost: number;
  buildTime: number;
  hp: number;
  /** Kule saldırısı (yalnızca arrow_tower). */
  attack?: { damage: number; damageType: DamageType; interval: number; range: number; volley: number };
  /** Yetiştirilebilen birimler (yalnızca barracks). */
  trains?: readonly number[];
}

export const BUILDING_DEFS: Readonly<Record<BuildingKind, BuildingDef>> = {
  arrow_tower: {
    kind: 'arrow_tower',
    name: 'Okçu Kulesi',
    cost: 250,
    buildTime: 12,
    hp: 1500,
    attack: { damage: 16, damageType: 'pierce', interval: 1.2, range: 36, volley: 3 },
  },
  barracks: {
    kind: 'barracks',
    name: 'Kışla',
    cost: 400,
    buildTime: 18,
    hp: 2500,
    trains: [UnitTypeId.GondorSoldier, UnitTypeId.GondorArcher, UnitTypeId.TowerGuard],
  },
};

/** Snapshot ve komutlarda yapı türü indeksi. */
export const BUILDING_KINDS: readonly BuildingKind[] = ['arrow_tower', 'barracks'];

/** Slot türü → inşa edilebilecek yapılar. */
export const SLOT_BUILDS: Readonly<Record<string, readonly BuildingKind[]>> = {
  wall_socket: ['arrow_tower'],
  tower: ['arrow_tower'],
  building: ['barracks'],
};

/** Ekonomi (GDD §5.1). */
export const ECONOMY = {
  startGold: 700,
  /** Saniyede pasif gelir. */
  income: 5,
  /** Öldürülen düşman başına ödül = birim tabur maliyeti / tabur boyu × oran. */
  bountyRate: 0.35,
  /** Kışla kuyruğu en fazla. */
  queueMax: 5,
} as const;
