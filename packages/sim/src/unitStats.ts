import {
  ARMOR_CLASSES,
  DAMAGE_PERCENT,
  DAMAGE_TYPES,
  ECONOMY,
  type Fx,
  fxFromFloat,
  PP,
  UNIT_DEFS,
} from '@bulwark/shared';
import { SIM_HZ } from './constants';

/**
 * Birim tablosunun (UNIT_DEFS) sim birimlerine bir kez çevrilmiş hali: Fx mesafe/hız,
 * tick cinsinden süreler, tablo indeksleri. fxFromFloat / Math.round → deterministik.
 */
export const STAT = {
  speed: UNIT_DEFS.map((d) => fxFromFloat(d.speed)) as readonly Fx[],
  hp: UNIT_DEFS.map((d) => d.hp) as readonly number[],
  spacing: UNIT_DEFS.map((d) => fxFromFloat(d.spacing)) as readonly Fx[],
  jitter: UNIT_DEFS.map((d) => fxFromFloat(d.jitter)) as readonly Fx[],
  damage: UNIT_DEFS.map((d) => d.damage) as readonly number[],
  dmgType: UNIT_DEFS.map((d) => DAMAGE_TYPES.indexOf(d.damageType)) as readonly number[],
  armor: UNIT_DEFS.map((d) => ARMOR_CLASSES.indexOf(d.armor)) as readonly number[],
  interval: UNIT_DEFS.map((d) => Math.max(1, Math.round(d.attackInterval * SIM_HZ))) as readonly number[],
  range: UNIT_DEFS.map((d) => fxFromFloat(d.range)) as readonly Fx[],
  ranged: UNIT_DEFS.map((d) => (d.ranged ? 1 : 0)) as readonly number[],
  siegeOnly: UNIT_DEFS.map((d) => (d.siegeOnly ? 1 : 0)) as readonly number[],
  hero: UNIT_DEFS.map((d) => (d.hero ? 1 : 0)) as readonly number[],
  boss: UNIT_DEFS.map((d) => (d.boss ? 1 : 0)) as readonly number[],
  summoned: UNIT_DEFS.map((d) => (d.summoned ? 1 : 0)) as readonly number[],
  charger: UNIT_DEFS.map((d) => (d.charger ? 1 : 0)) as readonly number[],
  invulnerable: UNIT_DEFS.map((d) => (d.invulnerable ? 1 : 0)) as readonly number[],
  /** Yarma (alan) vuruş yarıçapı (Fx; 0 = yok) ve yapılara ateşli ok atan okçu. */
  cleave: UNIT_DEFS.map((d) => fxFromFloat(d.cleave ?? 0)) as readonly Fx[],
  siegeArcher: UNIT_DEFS.map((d) => (d.siegeArcher ? 1 : 0)) as readonly number[],
  ladder: UNIT_DEFS.map((d) => (d.ladder ? 1 : 0)) as readonly number[],
  fireAuraR: UNIT_DEFS.map((d) => fxFromFloat(d.fireAura?.radius ?? 0)) as readonly Fx[],
  fireAuraDmg: UNIT_DEFS.map((d) => d.fireAura?.damage ?? 0) as readonly number[],
  lifeCost: UNIT_DEFS.map((d) => d.lifeCost ?? 1) as readonly number[],
  /** Öldürülünce verilen XP (asker başı değer) ve Güç Puanı ×10 (değer / PP.perValue). */
  xpValue: UNIT_DEFS.map((d) => Math.max(1, Math.round(d.cost / d.battalionSize))) as readonly number[],
  ppValue: UNIT_DEFS.map((d) =>
    Math.max(1, Math.round((d.cost / d.battalionSize / PP.perValue) * 10)),
  ) as readonly number[],
  cost: UNIT_DEFS.map((d) => d.cost) as readonly number[],
  trainTicks: UNIT_DEFS.map((d) => Math.round(d.trainTime * SIM_HZ)) as readonly number[],
  /** Öldürülen asker başına ödül (altın). */
  bounty: UNIT_DEFS.map((d) =>
    Math.max(1, Math.round((d.cost / d.battalionSize) * ECONOMY.bountyRate)),
  ) as readonly number[],
};

export const isUnitType = (t: number): boolean => Number.isInteger(t) && t >= 0 && t < UNIT_DEFS.length;

/** Hasar çarpanı tablosu, indeks erişimli: PERCENT[dmgType][armor] (GDD §6.2). */
export const ARMOR_STRUCTURE = ARMOR_CLASSES.indexOf('structure');
export const PERCENT: readonly (readonly number[])[] = DAMAGE_TYPES.map((dt) =>
  ARMOR_CLASSES.map((ac) => DAMAGE_PERCENT[dt][ac]),
);
