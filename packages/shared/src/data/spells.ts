/**
 * Kahraman ve Spellbook verileri (GDD §5.2, §8, §9). Süreler saniye, mesafeler metre;
 * sim bunları tick / Fx'e çevirir. Güç Puanı (PP) sim'de onda bir hassasiyetle tutulur (deci-PP).
 */

/** Tabur rütbesi: rütbe r'ye çıkmak için gereken toplam XP (indeks = rütbe; 1 başlangıç). */
export const RANK_XP: readonly number[] = [0, 0, 120, 300, 600, 1000];
export const MAX_RANK = 5;
/**
 * Kahraman seviyeleri (BFME2: 1–10). Kahraman öldürdükçe ve savaş alanında kaldıkça deneyim
 * kazanır; her seviye rütbe gibi +%10 hasar ve dayanıklılık verir, 3. / 6. / 10. seviyede yeni yetenek açılır.
 */
export const HERO_XP: readonly number[] = [0, 0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];
export const MAX_HERO_LEVEL = 10;
/** Kahramanın saniyede pasif kazandığı XP (savaş alanında bulunmak). */
export const HERO_PASSIVE_XP = 2;
/** Kahraman başına en fazla yetenek. */
export const MAX_ABILITIES = 4;
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
  key:
    | 'elendil'
    | 'athelas'
    | 'wizard_blast'
    | 'word_of_power'
    | 'arrow_wind'
    | 'train_archers'
    | 'kings_glory'
    | 'eored'
    | 'shieldmaiden'
    | 'slayer'
    | 'summon_dead'
    | 'eagle_call'
    | 'istar_light'
    | 'summon_elves'
    | 'flood_call';
  name: string;
  /** Açılması için gereken kahraman seviyesi. */
  rank: number;
  cooldown: number;
  desc: string;
  /** Etki parametrelerinin bu yeteneğe özgü değerleri (yoksa etkinin varsayılanı). */
  radius?: number;
  damage?: number;
  /** Ok sayısı / çağrılan tabur sayısı. */
  count?: number;
  /** Yetenek ikonu (yoksa etkinin ikonu). */
  icon?: string;
}

/**
 * Kahraman kadrosu (BFME2 İnsanlar/Elfler): kale panelinden ayrı ayrı çağrılır, kalenin kapısından
 * çıkar; her birinin iki yeteneği vardır (ikincisi rütbe 3'te açılır). İndeks = kahraman yuvası.
 */
export interface HeroDef {
  unitType: number;
  /** Portre kısayolu (KeyboardEvent.code) ve ikon. */
  key: string;
  icon: string;
  abilities: readonly AbilityDef[];
}

export const HEROES: readonly HeroDef[] = [
  {
    unitType: 6,
    key: 'KeyF',
    icon: 'hero',
    abilities: [
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
      {
        key: 'wizard_blast',
        name: 'Andúril Savuruşu',
        rank: 6,
        cooldown: 40,
        radius: 9,
        damage: 260,
        icon: 'blade',
        desc: 'Aragorn yeniden dövülmüş kılıcıyla çevresini biçer: 9 m içindeki düşmanlara 260 hasar.',
      },
      {
        key: 'summon_dead',
        name: 'Yeminbozanlar',
        rank: 10,
        cooldown: 180,
        count: 2,
        desc: "Isildur'un varisi Ölüleri çağırır: 30 sn savaşan, hasar almayan iki hayalet tabur.",
      },
    ],
  },
  {
    unitType: 14,
    key: 'KeyG',
    icon: 'staff',
    abilities: [
      {
        key: 'wizard_blast',
        name: 'Asa Patlaması',
        rank: 1,
        cooldown: 40,
        desc: "Gandalf'ın çevresindeki 10 m içindeki düşmanlara 160 büyü hasarı.",
      },
      {
        key: 'word_of_power',
        name: 'Kudret Sözü',
        rank: 3,
        cooldown: 120,
        desc: '30 m içindeki bütün düşmanlara 450 büyü hasarı — dalgayı tek sözle kırar.',
      },
      {
        key: 'istar_light',
        name: 'Beyaz Işık',
        rank: 6,
        cooldown: 75,
        radius: 20,
        desc: "Ak Gandalf'ın asasından taşan ışık: 20 m içindeki düşmanlar kamaşır (−%40 hasar, +%25 alınan hasar).",
      },
      {
        key: 'eagle_call',
        name: 'Kartalları Çağır',
        rank: 10,
        cooldown: 200,
        desc: "Gwaihir ve kartallar Gandalf'ın çağrısıyla iner: çevresine üç ağır dalış.",
      },
    ],
  },
  {
    unitType: 15,
    key: 'KeyJ',
    icon: 'bow',
    abilities: [
      {
        key: 'arrow_wind',
        name: 'Ok Rüzgârı',
        rank: 1,
        cooldown: 35,
        desc: '40 m içindeki düşmanlara hızla 30 ok yağdırır (ok başı 35 hasar).',
      },
      {
        key: 'train_archers',
        name: 'Okçu Eğitimi',
        rank: 3,
        cooldown: 60,
        desc: '30 m içindeki dost okçu taburları bir rütbe atlar.',
      },
      {
        key: 'slayer',
        name: 'Öldürücü Atış',
        rank: 6,
        cooldown: 45,
        radius: 45,
        damage: 600,
        icon: 'bow',
        desc: '45 m içindeki en güçlü düşmana (önce boss) tek okla 600 hasar.',
      },
      {
        key: 'arrow_wind',
        name: 'Elf Yayı Fırtınası',
        rank: 10,
        cooldown: 90,
        radius: 50,
        count: 70,
        damage: 45,
        icon: 'volley',
        desc: '50 m içindeki düşmanlara 70 ok (ok başı 45 hasar).',
      },
    ],
  },
];
export const MAX_HEROES = 3;

/** Rohan kahramanları (Théoden F, Éowyn G, Gandalf J). */
export const ROHAN_HEROES: readonly HeroDef[] = [
  {
    unitType: 23,
    key: 'KeyF',
    icon: 'crown',
    abilities: [
      {
        key: 'kings_glory',
        name: 'Kralın Şanı',
        rank: 1,
        cooldown: 60,
        desc: 'Théoden savaş naraları atar: 15 sn boyunca bütün ordunuz +%25 hasar verir.',
      },
      {
        key: 'eored',
        name: 'Éored Çağır',
        rank: 3,
        cooldown: 90,
        desc: "Théoden'in yanına 40 sn için bir Rohirrim süvari bölüğü gelir.",
      },
      {
        key: 'wizard_blast',
        name: 'Herugrim Hücumu',
        rank: 6,
        cooldown: 40,
        radius: 10,
        damage: 220,
        icon: 'blade',
        desc: 'Théoden kılıcı Herugrim ile atılır: 10 m içindeki düşmanlara 220 hasar.',
      },
      {
        key: 'eored',
        name: "Rohan'ın Bütün Atlıları",
        rank: 10,
        cooldown: 150,
        count: 3,
        icon: 'horse',
        desc: "Mark'ın bütün süvarileri: Théoden'in yanına 40 sn için üç Rohirrim bölüğü.",
      },
    ],
  },
  {
    unitType: 24,
    key: 'KeyG',
    icon: 'blade',
    abilities: [
      {
        key: 'shieldmaiden',
        name: 'Kalkan Kızı',
        rank: 1,
        cooldown: 45,
        desc: "Éowyn 10 sn boyunca çift hasar verir ve canının %30'unu yeniler.",
      },
      {
        key: 'slayer',
        name: 'Ben Erkek Değilim!',
        rank: 3,
        cooldown: 90,
        desc: '15 m içindeki en güçlü düşmana (önce boss) 700 büyü hasarı.',
      },
      {
        key: 'wizard_blast',
        name: 'Kılıç Fırtınası',
        rank: 6,
        cooldown: 35,
        radius: 8,
        damage: 200,
        icon: 'blade',
        desc: 'Éowyn kalkanı ve kılıcıyla döner: 8 m içindeki düşmanlara 200 hasar.',
      },
      {
        key: 'slayer',
        name: 'Cadı Kral Katili',
        rank: 10,
        cooldown: 150,
        radius: 25,
        damage: 1600,
        icon: 'crown',
        desc: '25 m içindeki en güçlü düşmana (önce boss) 1600 hasar.',
      },
    ],
  },
  {
    // Gandalf her iki tarafta da (BFME2 Rohan kahramanı).
    unitType: 14,
    key: 'KeyJ',
    icon: 'staff',
    abilities: (HEROES[1] as HeroDef).abilities,
  },
];
/**
 * Lothlórien kahramanları (Haldir F, Elrond G, Legolas J). Etkiler mevcut yetenek türlerini
 * kullanır (key = etki), adları elflere özgü.
 */
export const ELF_HEROES: readonly HeroDef[] = [
  {
    unitType: 28,
    key: 'KeyF',
    icon: 'bow',
    abilities: [
      {
        key: 'arrow_wind',
        name: 'Lórien Ok Yağmuru',
        rank: 1,
        cooldown: 35,
        desc: '40 m içindeki düşmanlara hızla 30 elf oku yağdırır.',
      },
      {
        key: 'elendil',
        name: 'Galadhrim Öfkesi',
        rank: 3,
        cooldown: 50,
        desc: '10 sn boyunca Haldir çift hasar verir.',
      },
      {
        key: 'train_archers',
        name: 'Galadhrim Komutanı',
        rank: 6,
        cooldown: 60,
        desc: '30 m içindeki dost okçu taburları bir rütbe atlar.',
      },
      {
        key: 'summon_elves',
        name: 'Lórien Muhafızları',
        rank: 10,
        cooldown: 150,
        count: 2,
        desc: "Haldir'in yanına 45 sn için iki tabur Lórien okçusu gelir.",
      },
    ],
  },
  {
    unitType: 29,
    key: 'KeyG',
    icon: 'leaf',
    abilities: [
      {
        key: 'athelas',
        name: 'Elf Şifası',
        rank: 1,
        cooldown: 50,
        desc: '15 m içindeki dost birimlerin canını %50 yeniler.',
      },
      {
        key: 'word_of_power',
        name: 'Imladris Selleri',
        rank: 3,
        cooldown: 120,
        desc: 'Bruinen selleri gibi: 30 m içindeki bütün düşmanlara 450 büyü hasarı.',
      },
      {
        key: 'istar_light',
        name: "Vilya'nın Işığı",
        rank: 6,
        cooldown: 75,
        radius: 20,
        icon: 'sun',
        desc: 'Hava Yüzüğü parlar: 20 m içindeki düşmanlar kamaşır (−%40 hasar, +%25 alınan hasar).',
      },
      {
        key: 'flood_call',
        name: 'Bruinen Taşkını',
        rank: 10,
        cooldown: 180,
        desc: 'Elrond nehri çağırır: çevresinden dışa yayılan, düşmanı sürükleyen sel dalgası.',
      },
    ],
  },
  HEROES[2] as HeroDef, // Legolas
];
export const SLAYER = { radius: 15, damage: 700 } as const;
/** Yeminbozanlar: çağrılan hayalet taburların süresi (s). Lórien Muhafızları süresi. */
export const SUMMON_DEAD = { duration: 30 } as const;
export const SUMMON_ELVES = { duration: 45 } as const;
export const EORED = { duration: 40 } as const;
export const KINGS_GLORY_DURATION = 15;
export const SHIELDMAIDEN = { duration: 10, healPercent: 30 } as const;
/** Aragorn'un yetenekleri (geriye uyum). */
export const HERO_ABILITIES: readonly AbilityDef[] = (HEROES[0] as HeroDef).abilities;
export const WIZARD_BLAST = { radius: 10, damage: 160 } as const;
export const WORD_OF_POWER = { radius: 30, damage: 450 } as const;
export const ARROW_WIND = { radius: 40, arrows: 30, damage: 35 } as const;
export const TRAIN_ARCHERS_RADIUS = 30;
export const ELENDIL_DURATION = 10;
export const ATHELAS_RADIUS = 15;

export interface SpellDef {
  key:
    | 'heal'
    | 'rally'
    | 'arrow_volley'
    | 'elven_allies'
    | 'sun_flare'
    | 'rohirrim'
    | 'earthquake'
    | 'army_of_dead'
    | 'eagles'
    | 'flood';
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
    key: 'sun_flare',
    name: 'Güneş Parlaması',
    tier: 2,
    cost: 10,
    cooldown: 120,
    radius: 16,
    desc: 'Göz kamaştıran ışık: alandaki düşmanlar 60 büyü hasarı alır, 15 sn boyunca %40 daha az hasar verir ve %25 daha fazla hasar alır.',
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
    key: 'earthquake',
    name: 'Deprem',
    tier: 3,
    cost: 15,
    cooldown: 180,
    radius: 16,
    desc: 'Toprak 4 sn boyunca sarsılır: düşman askerlerine ezme hasarı, merdiven ve kuşatma kulelerine ağır hasar.',
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
  {
    key: 'eagles',
    name: 'Kartallar Geliyor!',
    tier: 4,
    cost: 20,
    cooldown: 240,
    radius: 14,
    desc: "Gwaihir'in kartalları üç kez dalış yapar: her dalış alandaki düşmanlara 220 ezme hasarı verir, boss'ları da yaralar.",
  },
  {
    key: 'flood',
    name: 'Bruinen Seli',
    tier: 4,
    cost: 25,
    cooldown: 300,
    radius: 20,
    desc: 'Hedeften dışa yayılan sel dalgası: geçtiği her düşmana 200 büyü hasarı verir ve onları sürükler.',
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
export const MAX_SPELLS = 12;
export const RALLY_DURATION = 30;
export const RALLY_DAMAGE_PERCENT = 25;
/** Ok Yağmuru: dalga sayısı, dalga arası (s), dalga başına ok, ok hasarı. */
export const VOLLEY = { waves: 3, gap: 0.8, arrows: 30, damage: 30 } as const;
/** Güç Puanı kazancı: öldürülen birimin asker başı değeri / 100, dalga başı +2 (GDD §9.1 oranı yarıya indirildi: 3 büyülük kitapta PP taşmasın). */
export const PP = { perValue: 100, waveBonus: 2 } as const;
/** Güneş Parlaması: anlık hasar, zayıflama süresi (s), verilen/alınan hasar yüzdeleri. */
export const SUN_FLARE = { damage: 60, duration: 15, dealtPercent: 60, takenPercent: 125 } as const;
/** Deprem: sarsıntı sayısı, aralığı (s), asker ve yapı hasarı. */
export const EARTHQUAKE = { pulses: 8, gap: 0.5, damage: 45, structureDamage: 260 } as const;
/** Kartallar: dalış sayısı, ilk dalış gecikmesi ve aralığı (s), dalış yarıçapı (m), hasar. */
export const EAGLES = { dives: 3, delay: 1.2, gap: 1.1, radius: 8, damage: 220 } as const;
/** Sel: dalga halkası sayısı, aralığı (s), hasar, sürükleme (m). */
export const FLOOD = { rings: 6, gap: 0.45, damage: 200, push: 3 } as const;
