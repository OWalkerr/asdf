/**
 * Birim tipleri (GDD §7). `id` snapshot'ta 8 bit olarak taşınır ve render tarafında
 * birim tipi başına InstancedMesh seçimi için kullanılır.
 *
 * Sayılar veri tanımıdır (metre, saniye); sim bunları yüklerken fxFromFloat / tamsayı
 * tick'e çevirir — bu dönüşümler (Math.round) tüm motorlarda aynıdır.
 * Phase 1: Helm's Deep çekirdek kadrosu.
 */
export type Faction = 'gondor' | 'rohan' | 'isengard' | 'mordor';
export type ArmorClass = 'light' | 'medium' | 'heavy' | 'cavalry' | 'monster' | 'structure' | 'siege';
export type DamageType = 'slash' | 'pierce' | 'spear' | 'crush' | 'siege' | 'fire' | 'magic';
/** Saldırı animasyon stili: kılıç savurma, mızrak dürtme, yay germe. */
export type AttackStyle = 'slash' | 'thrust' | 'bow';

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
  /** Asker başı vuruş hasarı ve tipi (GDD §7). */
  damage: number;
  damageType: DamageType;
  /** Saldırı aralığı (s). */
  attackInterval: number;
  /** Yakın dövüş erişimi veya menzil (m). */
  range: number;
  ranged: boolean;
  /** Tabur başına asker (GDD §6.1). */
  battalionSize: number;
  /** Tabur maliyeti (altın) ve kışlada yetiştirme süresi (s). Düşman için ödül tabanı. */
  cost: number;
  trainTime: number;
  /** Tercih edilen ön cephe genişliği (asker); dar geçitte otomatik daralır. */
  files: number;
  /** Formasyon aralığı (m). */
  spacing: number;
  /** Yuva sapması (m): Orc sürüleri düzensiz, Uruk/Gondor disiplinli (GDD §3.3). */
  jitter: number;
  /** Kuşatma aracı: yalnızca kapı/yapı hedefler, birliklerle çatışmaya girmez. */
  siegeOnly?: boolean;
  /** Kahraman (GDD §8): tek kişilik tabur, liderlik aurası ve yetenekler. */
  hero?: boolean;
  /** Düşman boss'u (dalgayla gelir): kendi takımına liderlik aurası verir, oyuncu çağıramaz. */
  boss?: boolean;
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
    damage: 12,
    damageType: 'slash',
    attackInterval: 1.0,
    range: 1.6,
    ranged: false,
    battalionSize: 15,
    cost: 200,
    trainTime: 10,
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
    damage: 8,
    damageType: 'slash',
    attackInterval: 1.0,
    range: 1.5,
    ranged: false,
    battalionSize: 20,
    cost: 100,
    trainTime: 8,
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
    damage: 14,
    damageType: 'spear',
    attackInterval: 1.2,
    range: 2.4,
    ranged: false,
    battalionSize: 15,
    cost: 350,
    trainTime: 14,
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
    damage: 18,
    damageType: 'slash',
    attackInterval: 1.1,
    range: 1.6,
    ranged: false,
    battalionSize: 10,
    cost: 300,
    trainTime: 12,
    files: 5,
    spacing: 1.5,
    jitter: 0.08,
  },
  {
    id: 4,
    key: 'gondor_archer',
    name: 'Gondor Archers',
    faction: 'gondor',
    speed: 4.5,
    hp: 70,
    armor: 'light',
    attackStyle: 'bow',
    damage: 10,
    damageType: 'pierce',
    attackInterval: 1.6,
    range: 32,
    ranged: true,
    battalionSize: 15,
    cost: 250,
    trainTime: 12,
    files: 5,
    spacing: 1.4,
    jitter: 0.06,
  },
  {
    // Isengard koçbaşı (GDD §7.4): Uruk taşıyıcılı kurt başlı kütük. Oklara dayanıklı,
    // kılıca açık — durdurmak için piyadeyle kapı önüne çıkmak gerekir.
    id: 5,
    key: 'battering_ram',
    name: 'Battering Ram',
    faction: 'isengard',
    speed: 2.6,
    hp: 1600,
    armor: 'siege',
    attackStyle: 'thrust',
    damage: 120,
    damageType: 'siege',
    attackInterval: 3.0,
    range: 3,
    ranged: false,
    battalionSize: 1,
    cost: 500,
    trainTime: 30,
    files: 1,
    spacing: 4,
    jitter: 0,
    siegeOnly: true,
  },
  {
    // Aragorn (GDD §8.2): korucu pelerini, Andúril. Liderlik: 20 m içindeki dost taburlara +%25 hasar.
    id: 6,
    key: 'aragorn',
    name: 'Aragorn',
    faction: 'gondor',
    speed: 5.4,
    hp: 1800,
    armor: 'heavy',
    attackStyle: 'slash',
    damage: 55,
    damageType: 'slash',
    attackInterval: 0.8,
    range: 1.9,
    ranged: false,
    battalionSize: 1,
    cost: 1200,
    trainTime: 0,
    files: 1,
    spacing: 2,
    jitter: 0,
    hero: true,
  },
  {
    // Lurtz (GDD §8.2): Saruman'ın ilk Uruk'u — miğfersiz, yüzünde Ak El, kalın kılıç ve sırtta yay.
    // 5. dalganın boss'u; yakındaki Uruk taburlarına liderlik aurası verir.
    id: 7,
    key: 'lurtz',
    name: 'Lurtz',
    faction: 'isengard',
    speed: 5.0,
    hp: 3200,
    armor: 'heavy',
    attackStyle: 'slash',
    damage: 60,
    damageType: 'slash',
    attackInterval: 0.9,
    range: 1.9,
    ranged: false,
    battalionSize: 1,
    cost: 1500,
    trainTime: 0,
    files: 1,
    spacing: 2,
    jitter: 0,
    boss: true,
  },
];

export const UnitTypeId = {
  GondorSoldier: 0,
  OrcWarrior: 1,
  TowerGuard: 2,
  UrukHai: 3,
  GondorArcher: 4,
  BatteringRam: 5,
  Aragorn: 6,
  Lurtz: 7,
} as const;

export const unitDef = (id: number): UnitDef => {
  const def = UNIT_DEFS[id];
  if (!def || def.id !== id) throw new Error(`Bilinmeyen birim tipi: ${id}`);
  return def;
};

/**
 * Hasar çarpanları, yüzde (GDD §6.2): DAMAGE_PERCENT[hasarTipi][zırhSınıfı].
 * Tamsayı yüzde → sim'de `hasar * yüzde / 100` tamsayı aritmetiği.
 */
export const DAMAGE_PERCENT: Readonly<Record<DamageType, Readonly<Record<ArmorClass, number>>>> = {
  slash: { light: 125, medium: 100, heavy: 75, cavalry: 100, monster: 50, structure: 25, siege: 100 },
  pierce: { light: 150, medium: 100, heavy: 50, cavalry: 100, monster: 60, structure: 10, siege: 15 },
  spear: { light: 100, medium: 100, heavy: 90, cavalry: 300, monster: 100, structure: 25, siege: 75 },
  crush: { light: 125, medium: 125, heavy: 100, cavalry: 100, monster: 100, structure: 150, siege: 150 },
  siege: { light: 75, medium: 75, heavy: 75, cavalry: 75, monster: 100, structure: 400, siege: 150 },
  fire: { light: 150, medium: 125, heavy: 75, cavalry: 100, monster: 100, structure: 150, siege: 200 },
  magic: { light: 100, medium: 100, heavy: 100, cavalry: 100, monster: 100, structure: 50, siege: 100 },
};

export const DAMAGE_TYPES: readonly DamageType[] = [
  'slash',
  'pierce',
  'spear',
  'crush',
  'siege',
  'fire',
  'magic',
];
export const ARMOR_CLASSES: readonly ArmorClass[] = [
  'light',
  'medium',
  'heavy',
  'cavalry',
  'monster',
  'structure',
  'siege',
];
