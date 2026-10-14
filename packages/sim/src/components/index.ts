import { MAX_ENTITIES } from '../constants';

/**
 * Struct-of-Arrays bileşenler (GDD §13.4). Tüm alanlar TypedArray; konum/hız Q16.16.
 * Dünya başına ayrı oluşturulur: sunucu aynı süreçte birden fazla maçı headless çalıştırabilir.
 */
export const createComponents = (capacity = MAX_ENTITIES) => ({
  Position: { x: new Int32Array(capacity), z: new Int32Array(capacity) },
  Velocity: { x: new Int32Array(capacity), z: new Int32Array(capacity) },
  /** uint16 binary angle (0..65535 = 0..2π). */
  Facing: { angle: new Uint16Array(capacity) },
  Team: { id: new Uint8Array(capacity) },
  /** Birim tipi (data tablosu indeksi) — render bunu mesh seçimi için kullanır. */
  UnitType: { id: new Uint8Array(capacity) },
  /** Yürüme hızı, m/s (Q16.16). */
  Speed: { value: new Int32Array(capacity) },
  /** Aktif hareket hedefi (serbest birimler). */
  MoveTarget: { x: new Int32Array(capacity), z: new Int32Array(capacity), active: new Uint8Array(capacity) },
  /** Can; lastHit = son hasar tick'i + 1 (0 = hiç). */
  /** lastBy = son hasarı veren tabur (XP için; 0 = kule/büyü). */
  Health: {
    hp: new Int32Array(capacity),
    max: new Int32Array(capacity),
    lastHit: new Uint32Array(capacity),
    lastBy: new Int32Array(capacity),
  },
  /** Animasyon durumu ve başladığı tick (render faz hesabı için). */
  Anim: { state: new Uint8Array(capacity), startTick: new Uint32Array(capacity) },
  /**
   * Savaş (GDD §6.4). target: birim veya yapı eid'i (0 = yok). Süreler tick, menzil Fx.
   * dmgType / armor: DAMAGE_TYPES / ARMOR_CLASSES indeksleri.
   */
  Combat: {
    target: new Int32Array(capacity),
    cooldown: new Int32Array(capacity),
    damage: new Int32Array(capacity),
    dmgType: new Uint8Array(capacity),
    armor: new Uint8Array(capacity),
    interval: new Uint16Array(capacity),
    range: new Int32Array(capacity),
    ranged: new Uint8Array(capacity),
  },
  /** Ölü etiketi: ölüm tick'i (ceset animasyonu sonrası temizlenir). */
  Dead: { at: new Uint32Array(capacity) },
  /**
   * Tabur (GDD §6.1): kendi Position/Facing'i olan "sancak noktası" entity'si.
   * Askerler formasyon yuvalarını bu noktaya göre hesaplar.
   */
  Battalion: {
    unitType: new Uint8Array(capacity),
    count: new Uint16Array(capacity),
    /** Güncel ön cephe genişliği (dar geçitte daralır) ve tercih edilen genişlik. */
    files: new Uint8Array(capacity),
    prefFiles: new Uint8Array(capacity),
    spacing: new Int32Array(capacity),
    speed: new Int32Array(capacity),
    /** Emir: aktif mi, kişisel varış noktası, paylaşılan akış alanı hedefi. */
    active: new Uint8Array(capacity),
    goalX: new Int32Array(capacity),
    goalZ: new Int32Array(capacity),
    fieldX: new Int32Array(capacity),
    fieldZ: new Int32Array(capacity),
    /** Önceki tick'te yuvasından uzak kalan asker sayısı (tabur onları bekler). */
    lagging: new Uint16Array(capacity),
    /** İlerleme kaydedilmeden geçen tick (kalabalıkta / ulaşılamaz noktada sonsuz itişmeyi önler). */
    stall: new Uint8Array(capacity),
    /** Emir başından beri kişisel hedefe en yakın mesafe (ilerleme takibi). */
    bestDist: new Int32Array(capacity),
    /** Facing'in cos/sin'i (Fx), formasyon sistemi için tick başına bir kez. */
    cos: new Int32Array(capacity),
    sin: new Int32Array(capacity),
    /** Emir kipi (BattalionMode). */
    mode: new Uint8Array(capacity),
    /** Saldırı emrinin hedef taburu ve saldırılacak yapı (kapı). */
    targetBattalion: new Int32Array(capacity),
    targetStructure: new Int32Array(capacity),
    /** Çatışmada mı (sancak durur, askerler hedef seçer) ve en yakın/ilgili düşman taburu. */
    engaged: new Uint8Array(capacity),
    enemy: new Int32Array(capacity),
    /** Deneyim ve rütbe (GDD §5.2, 1–5); kahraman aurası içinde mi. */
    xp: new Int32Array(capacity),
    rank: new Uint8Array(capacity),
    aura: new Uint8Array(capacity),
    /** Çağrılan birliğin yok olacağı tick (0 = kalıcı). */
    expires: new Uint32Array(capacity),
    /** Düşman taburunun koridoru (MapDef.lanes indeksi + 1; 0 = yok). */
    lane: new Uint8Array(capacity),
  },
  /** Tabur askeri: hangi tabur, hangi yuva, yuva sapması (Fx). */
  Soldier: {
    battalion: new Int32Array(capacity),
    slot: new Uint16Array(capacity),
    jx: new Int32Array(capacity),
    jz: new Int32Array(capacity),
  },
  /**
   * Yapı: kapı (kind 0) veya inşa edilmiş bina (1 = okçu kulesi, 2 = kışla; BUILDING_KINDS + 1).
   * Kuyruk: eid × QUEUE_MAX dilimli birim tipleri; qProgress = baştaki birimin kalan tick'i.
   */
  Structure: {
    kind: new Uint8Array(capacity),
    hp: new Int32Array(capacity),
    max: new Int32Array(capacity),
    radius: new Int32Array(capacity),
    gateIndex: new Uint8Array(capacity),
    slot: new Int16Array(capacity),
    buildLeft: new Int32Array(capacity),
    cooldown: new Int32Array(capacity),
    /** Ok çıkış yüksekliği (cm, zeminden): sur üstü kule. */
    height: new Uint16Array(capacity),
    qLen: new Uint8Array(capacity),
    qProgress: new Int32Array(capacity),
    queue: new Uint8Array(capacity * 8),
    /** Bina seviyesi (1–3; kapı/kale 1) ve yatırılan toplam altın (satış iadesi). */
    level: new Uint8Array(capacity),
    invested: new Int32Array(capacity),
  },
  /** Analitik mermi (GDD §6.4): uçuş önceden bilinir, isabet impact tick'inde çözülür. */
  Projectile: {
    fromX: new Int32Array(capacity),
    fromZ: new Int32Array(capacity),
    toX: new Int32Array(capacity),
    toZ: new Int32Array(capacity),
    fireTick: new Uint32Array(capacity),
    flight: new Uint16Array(capacity),
    target: new Int32Array(capacity),
    damage: new Int32Array(capacity),
    dmgType: new Uint8Array(capacity),
    /** Çıkış yüksekliği (cm, zeminden). */
    height: new Uint16Array(capacity),
    /** Atan tabur (XP için; 0 = kule/büyü). */
    source: new Int32Array(capacity),
    /** Alan hasarı yarıçapı (Fx; 0 = tek hedef), atan takım, tür (0 ok, 1 taş). */
    aoe: new Int32Array(capacity),
    team: new Uint8Array(capacity),
    kind: new Uint8Array(capacity),
  },
});

/** Kışla kuyruğu dilim boyu (Structure.queue[eid * QUEUE_STRIDE + i]). */
export const QUEUE_STRIDE = 8;
/** Structure.kind: 0 kapı, sonra BUILDING_KINDS sırası + 1. */
export const StructureKind = {
  Gate: 0,
  ArrowTower: 1,
  Barracks: 2,
  Forge: 3,
  Catapult: 4,
  Fortress: 9,
} as const;

export type Components = ReturnType<typeof createComponents>;

/** Tabur emir kipleri. */
export const BattalionMode = {
  /** Beklemede: menzile giren düşmanla çatışır, yerinden ayrılmaz. */
  Idle: 0,
  /** Oyuncu hareket emri: hedefe varana kadar çatışmaya girmez (BFME2 varsayılanı). */
  Move: 1,
  /** Saldırarak ilerle (yapay zekâ dalgaları): yoldaki düşmanla çatışır, sonra devam eder. */
  AttackMove: 2,
  /** Belirli bir düşman taburuna saldır. */
  Attack: 3,
} as const;
