import type { MapDef } from '../../map/types';
import { FORTRESS_DEFENCE, TOWER_WARS } from './classics';
import { HELMS_DEEP } from './helmsDeep';
import { STONESHIELD } from './stoneshield';
import { FORKED_ROAD, SERPENT_VALE } from './tdMaps';
import { TWIN_BRIDGES } from './twinBridges';

/** Oynanabilir harita verileri (id → tanım). Worker sim'i bu kayıttan kurar. Sıra = seçim ekranı. */
export const MAP_DEFS: Readonly<Record<string, MapDef>> = {
  [FORTRESS_DEFENCE.id]: FORTRESS_DEFENCE,
  [TOWER_WARS.id]: TOWER_WARS,
  [STONESHIELD.id]: STONESHIELD,
  [TWIN_BRIDGES.id]: TWIN_BRIDGES,
  [HELMS_DEEP.id]: HELMS_DEEP,
  [SERPENT_VALE.id]: SERPENT_VALE,
  [FORKED_ROAD.id]: FORKED_ROAD,
};
