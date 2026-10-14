/**
 * Kahraman ve Spellbook verileri (GDD §5.2, §8, §9). Süreler saniye, mesafeler metre;
 * sim bunları tick / Fx'e çevirir. Güç Puanı (PP) sim'de onda bir hassasiyetle tutulur (deci-PP).
 */

/** Tabur rütbesi: rütbe r'ye çıkmak için gereken toplam XP (indeks = rütbe; 1 başlangıç). */
export const RANK_XP: readonly number[] = [0, 0, 60, 150, 300, 500];
export const MAX_RANK = 5;
/** Rütbe başına hasar ve dayanıklılık artışı (%). */
export const RANK_BONUS_PERCENT = 10;

export const HERO = {
  /** Liderlik aurası yarıçapı (m) ve hasar bonusu (%). */
  auraRadius: 20,
  auraDamagePercent: 25,
  /** Ölümden sonra yeniden çağırma bekleme süresi (s). */
  reviveTime: 45,
} as const;

export interface AbilityDef {
  key: 'elendil' | 'athelas';
  name: string;
  /** Açılması için gereken kahraman rütbesi. */
  rank: number;
  cooldown: number;
  desc: string;
}

export const HERO_ABILITIES: readonly AbilityDef[] = [
  {
    key: 'elendil',
    name: "Elendil'in Kılıcı",
    rank: 1,
    cooldown: 45,
    desc: '10 sn boyunca Aragorn çift hasar verir.',
  },
  {
    key: 'athelas',
    name: 'Athelas',
    rank: 3,
    cooldown: 60,
    desc: '15 m içindeki dost birimlerin canını %50 yeniler.',
  },
];
export const ELENDIL_DURATION = 10;
export const ATHELAS_RADIUS = 15;

export interface SpellDef {
  key: 'heal' | 'rally' | 'arrow_volley';
  name: string;
  tier: number;
  /** Açma maliyeti (PP). */
  cost: number;
  cooldown: number;
  /** Hedef alan yarıçapı (m); 0 = global. */
  radius: number;
  desc: string;
}

export const SPELL_DEFS: readonly SpellDef[] = [
  {
    key: 'heal',
    name: 'Şifa',
    tier: 1,
    cost: 5,
    cooldown: 90,
    radius: 20,
    desc: 'Alandaki dost birimlerin canını %60 yeniler.',
  },
  {
    key: 'rally',
    name: 'Toplanma Çağrısı',
    tier: 1,
    cost: 5,
    cooldown: 120,
    radius: 0,
    desc: '30 sn boyunca tüm birlikleriniz +%25 hasar verir.',
  },
  {
    key: 'arrow_volley',
    name: 'Ok Yağmuru',
    tier: 2,
    cost: 10,
    cooldown: 100,
    radius: 12,
    desc: 'Hedef alana üç dalga ok yağdırır. Bir 1. kademe büyü gerektirir.',
  },
];
export const RALLY_DURATION = 30;
export const RALLY_DAMAGE_PERCENT = 25;
/** Ok Yağmuru: dalga sayısı, dalga arası (s), dalga başına ok, ok hasarı. */
export const VOLLEY = { waves: 3, gap: 0.8, arrows: 30, damage: 30 } as const;
/** Güç Puanı kazancı: öldürülen birimin asker başı değeri / 50 (GDD §9.1), dalga başı +2. */
export const PP = { perValue: 50, waveBonus: 2 } as const;
