import {
  ARMOR_CLASSES,
  DAMAGE_PERCENT,
  DAMAGE_TYPES,
  type Fx,
  fxFromFloat,
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
};

export const isUnitType = (t: number): boolean => Number.isInteger(t) && t >= 0 && t < UNIT_DEFS.length;

/** Hasar çarpanı tablosu, indeks erişimli: PERCENT[dmgType][armor] (GDD §6.2). */
export const ARMOR_STRUCTURE = ARMOR_CLASSES.indexOf('structure');
export const PERCENT: readonly (readonly number[])[] = DAMAGE_TYPES.map((dt) =>
  ARMOR_CLASSES.map((ac) => DAMAGE_PERCENT[dt][ac]),
);
