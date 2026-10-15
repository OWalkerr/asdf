import { ELF_HEROES, HEROES, type HeroDef, ISENGARD_HEROES, ROHAN_HEROES, type SpellDef } from './spells';
import { UnitTypeId } from './units';

/**
 * Oynanabilir taraflar (BFME2 İyi tarafları + Isengard): kışlanın yetiştirdiği birimler, kahraman kadrosu,
 * harita garnizonunun karşılıkları ve takım rengi. İndeks = sim'deki faction değeri.
 */
export interface FactionDef {
  key: 'gondor' | 'rohan' | 'elves' | 'isengard';
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
  /** Dalga birimi → bu tarafa saldıran karşılığı (yoksa aynı birim). */
  enemyMap?: Readonly<Record<number, number>>;
  /** Güç kitabı: tarafa özgü ad/açıklama/ikon ve çağrılan birim (etki aynı). */
  spells?: Partial<
    Record<SpellDef['key'], { name: string; desc: string; icon?: string; unit?: number; count?: number }>
  >;
}

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
    enemyMap: {
      [UnitTypeId.OrcWarrior]: UnitTypeId.GondorSoldier,
      [UnitTypeId.UrukHai]: UnitTypeId.TowerGuard,
      [UnitTypeId.OrcArcher]: UnitTypeId.GondorArcher,
      [UnitTypeId.WargRider]: UnitTypeId.RohanRiders,
      [UnitTypeId.CaveTroll]: UnitTypeId.Galadhrim,
      [UnitTypeId.Lurtz]: UnitTypeId.Watcher,
    },
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
    },
  },
];

export const factionDef = (f: number): FactionDef => FACTIONS[f] ?? (FACTIONS[0] as FactionDef);
