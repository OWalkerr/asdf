import type { MapDef, SlotDef, Vec2 } from '../../map/types';
import { UnitTypeId } from '../units';
import { pathOpens, tdWaves } from './builders';

/**
 * Tower Defense haritaları (GDD §4.1): düşman tek bir yolu izleyip çıkışa yürür; çıkışa ulaşan
 * her tabur can götürür. Yolun kenarlarında kule yuvaları (okçu kulesi / mancınık), üssün
 * yanında kışla-demirhane arsaları vardır. Yuvalar yola 9–15 m mesafede seçildi.
 */
const tower = (id: string, pos: Vec2): SlotDef => ({ id, kind: 'tower', pos, elevation: 0, allowed: [] });
const plot = (id: string, pos: Vec2): SlotDef => ({ id, kind: 'building', pos, elevation: 0, allowed: [] });
const ALL: Vec2[] = [
  [-124, -124],
  [124, -124],
  [124, 124],
  [-124, 124],
];

const SERPENT: Vec2[] = [
  [-110, -118],
  [-110, -50],
  [-60, -50],
  [-60, -95],
  [0, -95],
  [0, -20],
  [-90, -20],
  [-90, 40],
  [-20, 40],
  [-20, 100],
  [60, 100],
  [60, 20],
  [110, 20],
  [110, 108],
];

export const SERPENT_VALE: MapDef = {
  id: 'serpent_vale',
  name: 'Yılan Vadisi',
  mode: 'TD',
  size: 256,
  seed: 9001,
  lives: 20,
  blurb: 'Kıvrılan tek yol, 12 dalga. Virajlara kule dik; sızan her tabur can götürür.',
  camera: { home: [0, 0], yaw: 0, distance: 190 },
  citadel: {
    id: 'vale_base',
    name: 'Vadi Karakolu',
    pos: [110, 118],
    radius: 8,
    hp: 5000,
    door: [110, 104],
    facing: 270,
  },
  gates: [],
  walls: [],
  slots: [
    tower('T1', [-92, -40]),
    tower('T2', [-32, -104]),
    tower('T3', [-100, -20]),
    tower('T4', [-100, 8]),
    tower('T5', [-92, -60]),
    tower('T6', [-80, 8]),
    tower('T7', [-72, -40]),
    tower('T8', [-32, -84]),
    tower('T9', [-72, -80]),
    tower('T10', [-48, -76]),
    tower('T11', [80, 8]),
    tower('T12', [80, 32]),
    tower('T13', [8, -100]),
    tower('T14', [-8, 70]),
    tower('T15', [-32, 28]),
    tower('T16', [20, 88]),
    tower('T17', [48, 60]),
    tower('T18', [96, 32]),
    plot('P1', [96, 94]),
    plot('P2', [40, 80]),
  ],
  spawns: [{ id: 'S_nw', pos: [-110, -118], lane: 'serpent' }],
  lanes: [{ id: 'serpent', points: SERPENT, target: 'exit' }],
  nav: {
    cellSize: 2,
    ops: [
      ...pathOpens('yol', SERPENT, 5.5),
      { op: 'open', label: 'karakol önü', shape: { type: 'circle', center: [110, 104], radius: 7 } },
    ],
  },
  waves: tdWaves(['S_nw'], 12, [
    'İlk sızıntı',
    'Ork devriyesi',
    'Kalabalık',
    'Uruk öncüleri',
    'Gece yürüyüşü',
    'Koçbaşı',
    'Kara sel',
    'Demir kalkanlar',
    'İkinci koçbaşı',
    'Uruk alayı',
    'Son hazırlık',
    'Lurtz',
  ]),
  terrain: {
    plateaus: [],
    ramps: [],
    basins: [ALL],
    roads: [{ points: SERPENT, width: 10 }],
    theme: 'autumn',
  },
  garrison: [{ unitType: UnitTypeId.GondorSoldier, pos: [110, 90], count: 1 }],
};

const FORK_N: Vec2[] = [
  [-30, -120],
  [-30, -70],
  [30, -70],
  [30, -20],
  [0, -20],
  [0, 20],
];
const FORK_W: Vec2[] = [
  [-120, 60],
  [-60, 60],
  [-60, 20],
  [0, 20],
];
const TRUNK: Vec2[] = [
  [0, 20],
  [0, 70],
  [70, 70],
  [70, 0],
  [112, 0],
];

export const FORKED_ROAD: MapDef = {
  id: 'forked_road',
  name: 'Çatal Yol',
  mode: 'TD',
  size: 256,
  seed: 5150,
  lives: 25,
  blurb: 'İki koldan gelen düşman ortada birleşir. Kavşağı tut, iki yolu da ayrı ayrı inceltin.',
  camera: { home: [0, 0], yaw: 0, distance: 190 },
  citadel: {
    id: 'fork_base',
    name: 'Çatal Kulesi',
    pos: [118, 12],
    radius: 8,
    hp: 5000,
    door: [106, 0],
    facing: 180,
  },
  gates: [],
  walls: [],
  slots: [
    tower('T1', [12, -8]),
    tower('T2', [-16, 8]),
    tower('T3', [-12, 40]),
    tower('T4', [12, 40]),
    tower('T5', [20, -44]),
    tower('T6', [-28, 32]),
    tower('T7', [-40, -100]),
    tower('T8', [-20, -100]),
    tower('T9', [0, -82]),
    tower('T10', [40, -52]),
    tower('T11', [-76, 48]),
    tower('T12', [-48, 32]),
    tower('T13', [84, -12]),
    tower('T14', [56, 56]),
    tower('T15', [84, 40]),
    tower('T16', [-90, 72]),
    plot('P1', [96, 24]),
    plot('P2', [40, 88]),
  ],
  spawns: [
    { id: 'S_north', pos: [-30, -120], lane: 'north' },
    { id: 'S_west', pos: [-120, 60], lane: 'west' },
  ],
  lanes: [
    { id: 'north', points: [...FORK_N, ...TRUNK.slice(1)], target: 'exit' },
    { id: 'west', points: [...FORK_W, ...TRUNK.slice(1)], target: 'exit' },
  ],
  nav: {
    cellSize: 2,
    ops: [
      ...pathOpens('kuzey kolu', FORK_N, 5.5),
      ...pathOpens('batı kolu', FORK_W, 5.5),
      ...pathOpens('ana yol', TRUNK, 6),
      { op: 'open', label: 'kule önü', shape: { type: 'circle', center: [106, 0], radius: 7 } },
    ],
  },
  waves: tdWaves(['S_north', 'S_west'], 12, [
    'İki kol',
    'Ork devriyesi',
    'Kavşak',
    'Uruk öncüleri',
    'Çift akın',
    'Koçbaşı',
    'Kara sel',
    'Demir kalkanlar',
    'İkinci koçbaşı',
    'Uruk alayı',
    'Son hazırlık',
    'Lurtz',
  ]),
  terrain: {
    plateaus: [],
    ramps: [],
    basins: [ALL],
    roads: [
      { points: FORK_N, width: 10 },
      { points: FORK_W, width: 10 },
      { points: TRUNK, width: 11 },
    ],
    theme: 'meadow',
  },
  garrison: [{ unitType: UnitTypeId.GondorSoldier, pos: [96, 0], count: 1 }],
};
