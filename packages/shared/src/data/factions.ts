import {
  CAH_HEROES,
  ELF_HEROES,
  GOBLIN_HEROES,
  HEROES,
  type HeroDef,
  ISENGARD_HEROES,
  MORDOR_HEROES,
  ROHAN_HEROES,
  type SpellDef,
} from './spells';
import { UnitTypeId } from './units';

/**
 * Oynanabilir taraflar (BFME2 İyi tarafları + Isengard): kışlanın yetiştirdiği birimler, kahraman kadrosu,
 * harita garnizonunun karşılıkları ve takım rengi. İndeks = sim'deki faction değeri.
 */
export interface FactionDef {
  key: 'gondor' | 'rohan' | 'elves' | 'isengard' | 'mordor' | 'goblins';
  name: string;
  desc: string;
  /** Kışlanın yetiştirdiği birimler (komut paneli sırası). */
  trains: readonly number[];
  heroes: readonly HeroDef[];
  /** Harita garnizonu (Gondor birimleriyle tanımlı) → bu tarafın karşılığı. */
  garrison: Readonly<Record<number, number>>;
  /** Takım rengi (palette team0 satırı). */
  color: { main: string; dark: string; accent: string };
  /** Kötü taraf: dalgalar iyi tarafların birlikleriyle gelir (enemyMap ile çevrilir). */
  evil?: boolean;
  /** Saldıran birliklerin can yüzdesi (kötü taraflarda iyi taraf saldıranlarını dengelemek için). */
  enemyHpPercent?: number;
  /** Dalga birimi → bu tarafa saldıran karşılığı (yoksa aynı birim). */
  enemyMap?: Readonly<Record<number, number>>;
  /** Güç kitabı: tarafa özgü ad/açıklama/ikon ve çağrılan birim (etki aynı). */
  spells?: Partial<
    Record<SpellDef['key'], { name: string; desc: string; icon?: string; unit?: number; count?: number }>
  >;
}

/** Kötü taraf oynanırken dalgalar: karanlık birimler → iyi tarafların karşılıkları. */
const GOOD_ATTACKERS: Readonly<Record<number, number>> = {
  [UnitTypeId.OrcWarrior]: UnitTypeId.GondorSoldier,
  [UnitTypeId.UrukHai]: UnitTypeId.TowerGuard,
  [UnitTypeId.OrcArcher]: UnitTypeId.GondorArcher,
  [UnitTypeId.WargRider]: UnitTypeId.RohanRiders,
  [UnitTypeId.CaveTroll]: UnitTypeId.Galadhrim,
  [UnitTypeId.Lurtz]: UnitTypeId.Watcher,
  [UnitTypeId.BatteringRam]: UnitTypeId.GondorRam,
  [UnitTypeId.LadderTeam]: UnitTypeId.GondorLadder,
  [UnitTypeId.SiegeTower]: UnitTypeId.GondorSiegeTower,
};

export const FACTIONS: readonly FactionDef[] = [
  {
    key: 'gondor',
    name: 'Gondor',
    desc: 'Beyaz Şehrin askerleri: kılıç-kalkan piyade, okçular, Kule Muhafızları. Aragorn, Gandalf, Legolas.',
    trains: [UnitTypeId.GondorSoldier, UnitTypeId.GondorArcher, UnitTypeId.TowerGuard],
    heroes: HEROES,
    garrison: {},
    color: { main: '#2f5fa8', dark: '#1e3d6e', accent: '#d9e4f5' },
  },
  {
    key: 'rohan',
    name: 'Rohan',
    desc: 'At Efendileri: mızrakçılar, okçular ve ezen Rohirrim süvarisi. Théoden, Éowyn, Gandalf.',
    trains: [UnitTypeId.RohanSpearman, UnitTypeId.RohanArcher, UnitTypeId.RohanRiders],
    heroes: ROHAN_HEROES,
    garrison: {
      [UnitTypeId.GondorSoldier]: UnitTypeId.RohanSpearman,
      [UnitTypeId.TowerGuard]: UnitTypeId.RohanSpearman,
      [UnitTypeId.GondorArcher]: UnitTypeId.RohanArcher,
    },
    color: { main: '#3d7a35', dark: '#26521f', accent: '#f0dc8a' },
  },
  {
    key: 'elves',
    name: 'Lothlórien',
    desc: 'Altın Orman elfleri: keskin Galadhrim savaşçıları ve en uzun menzilli okçular. Haldir, Elrond, Legolas.',
    trains: [UnitTypeId.Galadhrim, UnitTypeId.LorienArcherTrained],
    heroes: ELF_HEROES,
    garrison: {
      [UnitTypeId.GondorSoldier]: UnitTypeId.Galadhrim,
      [UnitTypeId.TowerGuard]: UnitTypeId.Galadhrim,
      [UnitTypeId.GondorArcher]: UnitTypeId.LorienArcherTrained,
    },
    color: { main: '#4f8f86', dark: '#2e5c56', accent: '#f2e6b8' },
  },
  {
    key: 'isengard',
    name: 'Isengard',
    desc: 'Beyaz Elin ordusu: Uruk-hai, Uruk arbaletçileri ve warg binicileri. Saruman, Lurtz, Sharku. Gondor ve Rohan saldırır.',
    trains: [UnitTypeId.UrukHai, UnitTypeId.UrukCrossbow, UnitTypeId.WargRider],
    heroes: ISENGARD_HEROES,
    garrison: {
      [UnitTypeId.GondorSoldier]: UnitTypeId.UrukHai,
      [UnitTypeId.TowerGuard]: UnitTypeId.UrukHai,
      [UnitTypeId.GondorArcher]: UnitTypeId.UrukCrossbow,
    },
    color: { main: '#d8d8d2', dark: '#3a3a3e', accent: '#c0302a' },
    evil: true,
    enemyHpPercent: 78,
    enemyMap: GOOD_ATTACKERS,
    spells: {
      heal: {
        name: 'Ateşleri Körükle',
        desc: 'Demirhanelerin ateşi orduyu diriltir: alandaki dost birimlerin canını %60 yeniler.',
        icon: 'flame',
      },
      rally: { name: 'Savaş Davulları', desc: '30 sn boyunca tüm birlikleriniz +%25 hasar verir.' },
      arrow_volley: {
        name: 'Arbalet Yaylımı',
        desc: 'Hedef alana üç dalga ağır cıvata yağdırır. Bir 1. kademe güç gerektirir.',
      },
      elven_allies: {
        name: 'Uruk Takviyesi',
        desc: 'Hedef noktada 60 sn kalan iki tabur Uruk-hai belirir.',
        icon: 'club',
        unit: UnitTypeId.UrukHai,
      },
      sun_flare: {
        name: 'Kara Duman',
        desc: 'Isengard ocaklarının dumanı: alandaki düşmanlar 60 hasar alır, 15 sn −%40 hasar verir ve +%25 hasar alır.',
        icon: 'eye',
      },
      rohirrim: {
        name: 'Warg Akını',
        desc: 'Warg binicileri doğudan hedef noktanın üzerinden batıya akar, yoldaki düşmanla çarpışır.',
        icon: 'wolf',
        unit: UnitTypeId.WargRider,
      },
      earthquake: {
        name: 'Uruk Barutu',
        desc: 'Isengard patlayıcısı 4 sn boyunca toprağı yarar: askerlere ve kuşatma yapılarına ağır hasar.',
      },
      army_of_dead: {
        name: "Balrog'u Uyandır",
        desc: 'Derinlerden bir Balrog yükselir ve 45 sn sizin için savaşır.',
        icon: 'flame',
        unit: UnitTypeId.Balrog,
        count: 1,
      },
      eagles: {
        name: 'Crebain Sürüsü',
        desc: 'Dunland kargaları üç kez dalış yapar: her dalış alandaki düşmanlara 220 hasar.',
        icon: 'eagle',
      },
      flood: {
        name: 'Kara Fırtına',
        desc: "Saruman'ın fırtınası hedeften dışa yayılır: düşmanı yaralar ve sürükler.",
        icon: 'wave',
      },
      tom_bombadil: {
        name: 'Dunland Yabanileri',
        desc: 'Dunland kabileleri inip gelir: hedef noktada üç tabur Uruk 40 sn savaşır.',
        icon: 'club',
        unit: UnitTypeId.UrukHai,
        count: 3,
      },
      ent_moot: {
        name: 'Orman Kıyımı',
        desc: 'Isengard ocaklarının odun avcıları: hedef noktada iki mağara trolü 50 sn savaşır.',
        icon: 'club',
        unit: UnitTypeId.CaveTroll,
        count: 2,
      },
    },
  },
  {
    key: 'mordor',
    name: 'Mordor',
    desc: 'Karanlık Lord’un orduları: ucuz ork sürüleri, ork okçuları ve mağara trolleri. Cadı Kral, Gothmog, Sauron’un Ağzı. Gondor ve Rohan saldırır.',
    trains: [UnitTypeId.OrcWarrior, UnitTypeId.OrcArcher, UnitTypeId.CaveTroll],
    heroes: MORDOR_HEROES,
    garrison: {
      [UnitTypeId.GondorSoldier]: UnitTypeId.OrcWarrior,
      [UnitTypeId.TowerGuard]: UnitTypeId.CaveTroll,
      [UnitTypeId.GondorArcher]: UnitTypeId.OrcArcher,
    },
    color: { main: '#3b3431', dark: '#1c1817', accent: '#e0502a' },
    evil: true,
    enemyHpPercent: 74,
    enemyMap: GOOD_ATTACKERS,
    spells: {
      heal: {
        name: 'Ork Ziyafeti',
        desc: 'Sürü kendini toparlar: alandaki dost birimlerin canını %60 yeniler.',
      },
      rally: { name: 'Mordor Davulları', desc: '30 sn boyunca tüm birlikleriniz +%25 hasar verir.' },
      arrow_volley: {
        name: 'Kara Oklar',
        desc: 'Hedef alana üç dalga kara ok yağdırır. Bir 1. kademe güç gerektirir.',
      },
      elven_allies: {
        name: 'Ork Sürüsü',
        desc: 'Hedef noktada 60 sn kalan üç tabur Mordor orku belirir.',
        icon: 'army',
        unit: UnitTypeId.OrcWarrior,
        count: 3,
      },
      sun_flare: {
        name: 'Karanlık',
        desc: "Sauron'un bulutları güneşi örter: alandaki düşmanlar 60 hasar alır, 15 sn −%40 hasar verir, +%25 alır.",
        icon: 'ghost',
      },
      rohirrim: {
        name: 'Warg Akını',
        desc: 'Warg binicileri doğudan hedef noktanın üzerinden batıya akar, yoldaki düşmanla çarpışır.',
        icon: 'wolf',
        unit: UnitTypeId.WargRider,
      },
      earthquake: {
        name: 'Yer Yarılır',
        desc: 'Orodruin uyanır: 4 sn boyunca toprak yarılır, askerlere ve kuşatma yapılarına ağır hasar.',
      },
      army_of_dead: {
        name: "Balrog'u Uyandır",
        desc: 'Derinlerden bir Balrog yükselir ve 45 sn sizin için savaşır.',
        icon: 'flame',
        unit: UnitTypeId.Balrog,
        count: 1,
      },
      eagles: {
        name: 'Fell Beast Dalışı',
        desc: 'Kanatlı Nazgûl üç kez dalış yapar: her dalış alandaki düşmanlara 220 hasar.',
        icon: 'eagle',
      },
      flood: {
        name: 'Lav Dalgası',
        desc: 'Hedeften dışa yayılan kızgın dalga düşmanı yaralar ve sürükler.',
        icon: 'flame',
      },
      tom_bombadil: {
        name: 'Morgul Süvarisi',
        desc: 'Bir warg sürüsü hedef noktaya iner ve 40 sn savaşır.',
        icon: 'wolf',
        unit: UnitTypeId.WargRider,
        count: 2,
      },
      ent_moot: {
        name: 'Dağ Trolleri',
        desc: 'Gorgoroth trolleri yürür: hedef noktada üç mağara trolü 50 sn savaşır.',
        icon: 'club',
        unit: UnitTypeId.CaveTroll,
        count: 3,
      },
    },
  },
  {
    key: 'goblins',
    name: 'Goblinler',
    desc: 'Sisli Dağların sürüleri: ucuz goblin savaşçıları ve okçuları, örümcek biniciler. Gorkil, Drogoth, Shelob. Gondor ve Rohan saldırır.',
    trains: [UnitTypeId.GoblinWarrior, UnitTypeId.GoblinArcher, UnitTypeId.SpiderRider],
    heroes: GOBLIN_HEROES,
    garrison: {
      [UnitTypeId.GondorSoldier]: UnitTypeId.GoblinWarrior,
      [UnitTypeId.TowerGuard]: UnitTypeId.SpiderRider,
      [UnitTypeId.GondorArcher]: UnitTypeId.GoblinArcher,
    },
    color: { main: '#6b5a2c', dark: '#2e2612', accent: '#d8b040' },
    evil: true,
    enemyHpPercent: 72,
    enemyMap: GOOD_ATTACKERS,
    spells: {
      heal: {
        name: 'Mağara Ziyafeti',
        desc: 'Sürü kendini toparlar: alandaki dost birimlerin canını %60 yeniler.',
      },
      rally: { name: 'Goblin Davulları', desc: '30 sn boyunca tüm birlikleriniz +%25 hasar verir.' },
      arrow_volley: {
        name: 'Ateşli Oklar',
        desc: 'Hedef alana üç dalga ateşli ok yağdırır. Bir 1. kademe güç gerektirir.',
      },
      elven_allies: {
        name: 'Goblin Akını',
        desc: 'Hedef noktada 60 sn kalan dört tabur goblin belirir.',
        icon: 'army',
        unit: UnitTypeId.GoblinWarrior,
        count: 4,
      },
      sun_flare: {
        name: 'Karanlık Mağara',
        desc: 'Alandaki düşmanlar 60 hasar alır, 15 sn −%40 hasar verir, +%25 alır.',
        icon: 'ghost',
      },
      rohirrim: {
        name: 'Örümcek Akını',
        desc: 'Örümcek biniciler doğudan hedef noktanın üzerinden batıya akar, yoldaki düşmanı çiğner.',
        icon: 'spider',
        unit: UnitTypeId.SpiderRider,
      },
      earthquake: {
        name: 'Dağ Uyanır',
        desc: 'Sisli Dağlar sarsılır: askerlere ve kuşatma yapılarına ağır hasar.',
      },
      army_of_dead: {
        name: "Balrog'u Uyandır",
        desc: 'Derinlerden bir Balrog yükselir ve 45 sn sizin için savaşır.',
        icon: 'flame',
        unit: UnitTypeId.Balrog,
        count: 1,
      },
      eagles: {
        name: 'Yarasa Sürüsü',
        desc: 'Kara yarasalar üç kez dalış yapar: her dalış 220 hasar.',
        icon: 'eagle',
      },
      flood: {
        name: 'Ateş Seli',
        desc: 'Hedeften dışa yayılan alev dalgası düşmanı yaralar ve sürükler.',
        icon: 'flame',
      },
      tom_bombadil: {
        name: 'Dağ Devi',
        desc: 'Sisli Dağlardan bir mağara trolü hedef noktaya iner ve 40 sn savaşır.',
        icon: 'club',
        unit: UnitTypeId.CaveTroll,
        count: 1,
      },
      ent_moot: {
        name: 'Örümcek Yuvası',
        desc: 'Mirkwood örümcekleri: hedef noktada üç tabur örümcek binicisi 50 sn savaşır.',
        icon: 'spider',
        unit: UnitTypeId.SpiderRider,
        count: 3,
      },
    },
  },
];

export const factionDef = (f: number): FactionDef => FACTIONS[f] ?? (FACTIONS[0] as FactionDef);

/** Tarafın kahraman kadrosu; `cah` ≥ 0 ise Kahraman Yarat sınıfı 3. kahramanın (J) yerini alır. */
export const heroRoster = (faction: number, cah = -1): readonly HeroDef[] => {
  const heroes = factionDef(faction).heroes;
  const custom = CAH_HEROES[cah];
  if (!custom) return heroes;
  return heroes.map((h, i) => (i === heroes.length - 1 ? custom : h));
};
