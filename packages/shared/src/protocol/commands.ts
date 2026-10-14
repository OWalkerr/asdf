import type { Fx } from '../math/fixed';

/**
 * Oyuncu komutları (GDD §13.3, §13.6). Lockstep'te ağdan geçen TEK veri budur;
 * bu yüzden tüm sayılar tamsayıdır (konumlar Q16.16). Komutlar, sim'e uygulanacakları
 * tick ile damgalanır; her istemci aynı tick'te aynı sırayla uygular.
 */
export type Command =
  /** Debug/senaryo: (x,z) merkezli ızgarada `count` birim oluştur. */
  | { type: 'spawn'; team: number; unitType: number; x: Fx; z: Fx; count: number; spacing: Fx }
  /**
   * Debug/senaryo: (x,z) merkezli yan yana `count` tabur oluştur (GDD §6.1).
   * facing: uint16 açı; taburlar bu yöne bakar ve dik eksende sıralanır.
   */
  | { type: 'spawnBattalion'; team: number; unitType: number; x: Fx; z: Fx; count: number; facing: number }
  /**
   * Birimleri/taburları hedefe yürüt. Tabur eid'leri akış alanıyla (flow field) yürür ve
   * hedefte yan yana dizilir; serbest birimler kare formasyonla doğrudan yürür.
   */
  | { type: 'move'; units: readonly number[]; x: Fx; z: Fx; spacing: Fx }
  /** Taburlarla düşman taburuna saldır (hedef, ölene veya emir değişene kadar izlenir). */
  | { type: 'attack'; units: readonly number[]; target: number }
  | { type: 'stop'; units: readonly number[] }
  /** Haritanın `slot` indeksli inşa yerine yapı kur (BUILDING_KINDS indeksi). */
  | { type: 'build'; slot: number; kind: number }
  /** Kışlada birim yetiştir (kuyruğa ekle). building = yapı eid'i. */
  | { type: 'train'; building: number; unitType: number }
  /** Demirhanede yükseltme araştır (UPGRADE_DEFS indeksi). */
  | { type: 'research'; building: number; upgrade: number }
  /** Kapıyı onar (haritadaki kapı indeksi). */
  | { type: 'repair'; gate: number }
  /** Kahramanı çağır (veya ölmüşse yeniden canlandır). */
  | { type: 'summonHero'; unitType: number }
  /** Kahraman yeteneği (HERO_ABILITIES indeksi). unit = kahraman taburu. */
  | { type: 'ability'; unit: number; ability: number }
  /** Spellbook: büyüyü PP ile aç; açık büyüyü (x, z) hedefine kullan. */
  | { type: 'unlockSpell'; spell: number }
  | { type: 'castSpell'; spell: number; x: number; z: number };

export interface StampedCommand {
  /** Uygulanacağı sim tick'i. */
  tick: number;
  player: number;
  /** Oyuncu başına artan sıra numarası (aynı tick'teki komutların sırası). */
  seq: number;
  cmd: Command;
}

/** Deterministik uygulama sırası: tick → player → seq. */
export const compareStamped = (a: StampedCommand, b: StampedCommand): number =>
  a.tick - b.tick || a.player - b.player || a.seq - b.seq;

/** Birim animasyon durumları (snapshot → render). */
export const AnimState = { Idle: 0, Walk: 1, Attack: 2, Die: 3 } as const;
export type AnimState = (typeof AnimState)[keyof typeof AnimState];
