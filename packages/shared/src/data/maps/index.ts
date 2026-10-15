import type { MapDef } from '../../map/types';
import { FORTRESS_DEFENCE, TOWER_WARS } from './classics';
import { FORDS_OF_ISEN } from './fordsOfIsen';
import { HELMS_DEEP } from './helmsDeep';
import { MINAS_TIRITH } from './minasTirith';
import { STONESHIELD } from './stoneshield';
import { FORKED_ROAD, SERPENT_VALE } from './tdMaps';
import { TWIN_BRIDGES } from './twinBridges';
import { VS_FORDS_OF_ISEN, VS_GAP_OF_ROHAN, VS_WILDERLAND } from './vsMaps';

/** Oynanabilir harita verileri (id → tanım). Worker sim'i bu kayıttan kurar. Sıra = seçim ekranı. */
export const MAP_DEFS: Readonly<Record<string, MapDef>> = {
  [FORTRESS_DEFENCE.id]: FORTRESS_DEFENCE,
  [TOWER_WARS.id]: TOWER_WARS,
  [STONESHIELD.id]: STONESHIELD,
  [TWIN_BRIDGES.id]: TWIN_BRIDGES,
  [HELMS_DEEP.id]: HELMS_DEEP,
  [MINAS_TIRITH.id]: MINAS_TIRITH,
  [FORDS_OF_ISEN.id]: FORDS_OF_ISEN,
  [SERPENT_VALE.id]: SERPENT_VALE,
  [FORKED_ROAD.id]: FORKED_ROAD,
  [VS_FORDS_OF_ISEN.id]: VS_FORDS_OF_ISEN,
  [VS_GAP_OF_ROHAN.id]: VS_GAP_OF_ROHAN,
  [VS_WILDERLAND.id]: VS_WILDERLAND,
};
