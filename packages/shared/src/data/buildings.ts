import type { DamageType } from './units';
import { UnitTypeId } from './units';

/**
 * İnşa edilebilir yapılar (GDD §4, §7.1, §7.5). Slot türüne göre izinli; maliyet altın,
 * süreler saniye. Okçu kulesi menzildeki düşman taburlarına ok atar; kışla tabur yetiştirir.
 */
export type BuildingKind = 'arrow_tower' | 'barracks' | 'forge';

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
  /** Araştırılabilen yükseltmeler (UPGRADE_DEFS indeksleri; yalnızca forge). */
  researches?: readonly number[];
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
  forge: {
    kind: 'forge',
    name: 'Demirhane',
    cost: 500,
    buildTime: 15,
    hp: 2500,
    researches: [0, 1, 2],
  },
};

/**
 * Takım çapında yükseltmeler (GDD §5.2, §7.5 Forge). Bit = 1 << indeks.
 * - Dövme Kılıçlar: yakın dövüş hasarı +%25.
 * - Ağır Zırh: birliklerin aldığı hasar −%25.
 * - Ateşli Oklar: okçu ve kule okları 'fire' hasar tipine geçer (zırhlı Uruk ve koçbaşına karşı).
 */
export interface UpgradeDef {
  key: 'forged_blades' | 'heavy_armor' | 'fire_arrows';
  name: string;
  cost: number;
  researchTime: number;
  desc: string;
}

export const UPGRADE_DEFS: readonly UpgradeDef[] = [
  {
    key: 'forged_blades',
    name: 'Dövme Kılıçlar',
    cost: 600,
    researchTime: 30,
    desc: 'Yakın dövüş hasarı +%25.',
  },
  {
    key: 'heavy_armor',
    name: 'Ağır Zırh',
    cost: 600,
    researchTime: 30,
    desc: 'Birlikler %25 daha az hasar alır.',
  },
  {
    key: 'fire_arrows',
    name: 'Ateşli Oklar',
    cost: 500,
    researchTime: 25,
    desc: 'Okçu ve kule okları ateş hasarı verir: Uruk zırhını ve koçbaşını deler.',
  },
];

export const Upgrade = { ForgedBlades: 0, HeavyArmor: 1, FireArrows: 2 } as const;

/** Snapshot ve komutlarda yapı türü indeksi. */
export const BUILDING_KINDS: readonly BuildingKind[] = ['arrow_tower', 'barracks', 'forge'];

/** Slot türü → inşa edilebilecek yapılar. */
export const SLOT_BUILDS: Readonly<Record<string, readonly BuildingKind[]>> = {
  wall_socket: ['arrow_tower'],
  tower: ['arrow_tower'],
  building: ['barracks', 'forge'],
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
  /** Kapı onarımı: maliyet, süre (s), onarılan oran (%). */
  repairCost: 300,
  repairTime: 10,
  repairPercent: 25,
} as const;

/**
 * Zorluk seviyeleri (GDD §4.4). Düşman canı ve dalga büyüklüğü yüzde; başlangıç altını.
 * Sim'e maç başında verilir (deterministik: tüm istemciler aynı değeri kullanır).
 */
export interface DifficultyDef {
  key: 'easy' | 'normal' | 'hard';
  name: string;
  enemyHpPercent: number;
  waveSizePercent: number;
  startGold: number;
  desc: string;
}

export const DIFFICULTIES: readonly DifficultyDef[] = [
  {
    key: 'easy',
    name: 'Kolay',
    enemyHpPercent: 75,
    waveSizePercent: 80,
    startGold: 1000,
    desc: 'Daha az ve daha zayıf düşman, bol altın.',
  },
  {
    key: 'normal',
    name: 'Normal',
    enemyHpPercent: 100,
    waveSizePercent: 100,
    startGold: 700,
    desc: 'Dengeli kuşatma.',
  },
  {
    key: 'hard',
    name: 'Zor',
    enemyHpPercent: 150,
    waveSizePercent: 150,
    startGold: 500,
    desc: 'Isengard tüm gücüyle gelir.',
  },
];
export const DEFAULT_DIFFICULTY = 1;
