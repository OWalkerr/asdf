import type { MapDef } from '../../map/types';
import { HELMS_DEEP } from './helmsDeep';

/** Oynanabilir harita verileri (id → tanım). Worker sim'i bu kayıttan kurar. */
export const MAP_DEFS: Readonly<Record<string, MapDef>> = {
  [HELMS_DEEP.id]: HELMS_DEEP,
};
