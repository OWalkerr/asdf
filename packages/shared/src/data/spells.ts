/**
 * Kahraman ve Spellbook verileri (GDD §5.2, §8, §9). Süreler saniye, mesafeler metre;
 * sim bunları tick / Fx'e çevirir. Güç Puanı (PP) sim'de onda bir hassasiyetle tutulur (deci-PP).
 */

/** Tabur rütbesi: rütbe r'ye çıkmak için gereken toplam XP (indeks = rütbe; 1 başlangıç). */
export const RANK_XP: readonly number[] = [0, 0, 120, 300, 600, 1000];
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
  key: 'heal' | 'rally' | 'arrow_volley' | 'elven_allies' | 'rohirrim' | 'army_of_dead';
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
  {
    key: 'elven_allies',
    name: 'Elf Müttefikleri',
    tier: 2,
    cost: 10,
    cooldown: 150,
    radius: 6,
    desc: 'Hedef noktada 60 sn kalan iki tabur Lórien okçusu belirir.',
  },
  {
    key: 'rohirrim',
    name: "Rohirrim'i Çağır",
    tier: 3,
    cost: 15,
    cooldown: 200,
    radius: 8,
    desc: 'Rohan süvarileri doğudan hedef noktanın üzerinden batıya dörtnala geçer, yoldaki düşmanı ezer.',
  },
  {
    key: 'army_of_dead',
    name: 'Ölüler Ordusu',
    tier: 4,
    cost: 25,
    cooldown: 300,
    radius: 10,
    desc: 'Hedefte 45 sn savaşan, hasar almayan dört tabur hayalet asker belirir.',
  },
];
/** Çağrılan birliklerin süreleri (s) ve tabur sayıları. */
export const SUMMONS = {
  elvenAllies: { battalions: 2, duration: 60 },
  rohirrim: { battalions: 2, duration: 25, distance: 75 },
  armyOfDead: { battalions: 4, duration: 45 },
} as const;
/** Süvari çiğneme: rider başına vuruş aralığı (tick), yarıçap (m), hasar. */
export const TRAMPLE = { interval: 3, radius: 2.2, damage: 45 } as const;
/** Spellbook büyü sayısı üst sınırı (snapshot/hazır tick dizileri). */
export const MAX_SPELLS = 8;
export const RALLY_DURATION = 30;
export const RALLY_DAMAGE_PERCENT = 25;
/** Ok Yağmuru: dalga sayısı, dalga arası (s), dalga başına ok, ok hasarı. */
export const VOLLEY = { waves: 3, gap: 0.8, arrows: 30, damage: 30 } as const;
/** Güç Puanı kazancı: öldürülen birimin asker başı değeri / 100, dalga başı +2 (GDD §9.1 oranı yarıya indirildi: 3 büyülük kitapta PP taşmasın). */
export const PP = { perValue: 100, waveBonus: 2 } as const;
