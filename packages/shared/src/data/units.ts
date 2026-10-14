/**
 * Birim tipleri (GDD §7). `id` snapshot'ta 8 bit olarak taşınır ve render tarafında
 * birim tipi başına InstancedMesh seçimi için kullanılır.
 *
 * Sayılar veri tanımıdır (metre, saniye); sim bunları yüklerken fxFromFloat ile
 * Q16.16'ya çevirir — bu dönüşüm (Math.round) tüm motorlarda aynıdır.
 * Phase 1: yalnızca Helm's Deep çekirdek kadrosu; tam tablo Adım 8'de.
 */
export type Faction = 'gondor' | 'rohan' | 'isengard' | 'mordor';
export type ArmorClass = 'light' | 'medium' | 'heavy' | 'cavalry' | 'monster';
/** Saldırı animasyon stili: kılıç savurma veya mızrak dürtme. */
export type AttackStyle = 'slash' | 'thrust';

export interface UnitDef {
  id: number;
  key: string;
  name: string;
  faction: Faction;
  /** Yürüme hızı (m/s). */
  speed: number;
  /** Asker başı can. */
  hp: number;
  armor: ArmorClass;
  attackStyle: AttackStyle;
  /** Tabur başına asker (GDD §6.1). */
  battalionSize: number;
  /** Tercih edilen ön cephe genişliği (asker); dar geçitte otomatik daralır. */
  files: number;
  /** Formasyon aralığı (m). */
  spacing: number;
  /** Yuva sapması (m): Orc sürüleri düzensiz, Uruk/Gondor disiplinli (GDD §3.3). */
  jitter: number;
}

export const UNIT_DEFS: readonly UnitDef[] = [
  {
    id: 0,
    key: 'gondor_soldier',
    name: 'Soldiers of Gondor',
    faction: 'gondor',
    speed: 4.5,
    hp: 100,
    armor: 'medium',
    attackStyle: 'slash',
    battalionSize: 15,
    files: 5,
    spacing: 1.4,
    jitter: 0.05,
  },
  {
    id: 1,
    key: 'orc_warrior',
    name: 'Mordor Orc Warriors',
    faction: 'mordor',
    speed: 5.0,
    hp: 60,
    armor: 'light',
    attackStyle: 'slash',
    battalionSize: 20,
    files: 5,
    spacing: 1.25,
    jitter: 0.35,
  },
  {
    id: 2,
    key: 'tower_guard',
    name: 'Tower Guards',
    faction: 'gondor',
    speed: 4.0,
    hp: 140,
    armor: 'heavy',
    attackStyle: 'thrust',
    battalionSize: 15,
    files: 5,
    spacing: 1.4,
    jitter: 0.05,
  },
  {
    id: 3,
    key: 'uruk_hai',
    name: 'Uruk-hai',
    faction: 'isengard',
    speed: 4.5,
    hp: 160,
    armor: 'heavy',
    attackStyle: 'slash',
    battalionSize: 10,
    files: 5,
    spacing: 1.5,
    jitter: 0.08,
  },
];

export const UnitTypeId = { GondorSoldier: 0, OrcWarrior: 1, TowerGuard: 2, UrukHai: 3 } as const;

export const unitDef = (id: number): UnitDef => {
  const def = UNIT_DEFS[id];
  if (!def || def.id !== id) throw new Error(`Bilinmeyen birim tipi: ${id}`);
  return def;
};
