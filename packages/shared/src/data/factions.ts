import { ELF_HEROES, HEROES, type HeroDef, ROHAN_HEROES } from './spells';
import { UnitTypeId } from './units';

/**
 * Oynanabilir taraflar (BFME2 İyi tarafları): kışlanın yetiştirdiği birimler, kahraman kadrosu,
 * harita garnizonunun karşılıkları ve takım rengi. İndeks = sim'deki faction değeri.
 */
export interface FactionDef {
  key: 'gondor' | 'rohan' | 'elves';
  name: string;
  desc: string;
  /** Kışlanın yetiştirdiği birimler (komut paneli sırası). */
  trains: readonly number[];
  heroes: readonly HeroDef[];
  /** Harita garnizonu (Gondor birimleriyle tanımlı) → bu tarafın karşılığı. */
  garrison: Readonly<Record<number, number>>;
  /** Takım rengi (palette team0 satırı). */
  color: { main: string; dark: string; accent: string };
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
];

export const factionDef = (f: number): FactionDef => FACTIONS[f] ?? (FACTIONS[0] as FactionDef);
