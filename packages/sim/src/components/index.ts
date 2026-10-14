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
  /** Aktif hareket hedefi. */
  MoveTarget: { x: new Int32Array(capacity), z: new Int32Array(capacity), active: new Uint8Array(capacity) },
  Health: { hp: new Int32Array(capacity), max: new Int32Array(capacity) },
  /** Animasyon durumu ve başladığı tick (render faz hesabı için). */
  Anim: { state: new Uint8Array(capacity), startTick: new Uint32Array(capacity) },
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
    /** Grup hedef bölgesinde geçen tick (kalabalıkta sonsuz itişmeyi önleyen sabır sayacı). */
    stall: new Uint8Array(capacity),
    /** Facing'in cos/sin'i (Fx), formasyon sistemi için tick başına bir kez. */
    cos: new Int32Array(capacity),
    sin: new Int32Array(capacity),
  },
  /** Tabur askeri: hangi tabur, hangi yuva, yuva sapması (Fx). */
  Soldier: {
    battalion: new Int32Array(capacity),
    slot: new Uint16Array(capacity),
    jx: new Int32Array(capacity),
    jz: new Int32Array(capacity),
  },
});

export type Components = ReturnType<typeof createComponents>;
