import type { MapDef, SlotDef, Vec2 } from '../../map/types';
import { UnitTypeId } from '../units';
import { fdWaves, gateOps, wallBlocks } from './builders';

/**
 * İkiz Köprü Geçidi — özgün FD haritası. Geniş bir nehir ovayı ikiye böler; yalnızca iki taş
 * köprüden geçilir ve her köprünün kuzey ucunda bir kapı kulesi vardır. Kuzeyde dağa yaslanan
 * yay surunun ardında kale durur. Düşman bir köprüyü kırarsa kale kapısına yürür.
 */
const WALL: Vec2[] = [
  [-37.59, -142],
  [-37.59, -113.68],
  [-40, -100],
  [-37.59, -86.32],
  [-30.64, -74.29],
  [-20, -65.36],
  [-6.95, -60.61],
  [6.95, -60.61],
  [20, -65.36],
  [30.64, -74.29],
  [37.59, -86.32],
  [40, -100],
  [37.59, -113.68],
  [37.59, -142],
];
const RIVER: Vec2[] = [
  [-160, 20],
  [-80, 6],
  [0, 14],
  [80, 4],
  [160, 16],
];
const KEEP: Vec2 = [0, -110];
const BRIDGE_W = { type: 'capsule', a: [-70, -8], b: [-70, 22], halfWidth: 4 } as const;
const BRIDGE_E = { type: 'capsule', a: [70, -9.75], b: [70, 20.25], halfWidth: 4 } as const;
const GATE_W = { type: 'capsule', a: [-70, -7], b: [-70, -1], halfWidth: 4 } as const;
const GATE_E = { type: 'capsule', a: [70, -8.75], b: [70, -2.75], halfWidth: 4 } as const;
const GATE_C = { type: 'capsule', a: [0, -65.11], b: [0, -56.11], halfWidth: 3.2 } as const;
const BASIN: Vec2[] = [
  [-150, -134],
  [150, -134],
  [150, 154],
  [-150, 154],
];
const H = 8;
const socket = (id: string, pos: Vec2): SlotDef => ({
  id,
  kind: 'wall_socket',
  pos,
  elevation: H,
  allowed: [],
});
const tower = (id: string, pos: Vec2): SlotDef => ({ id, kind: 'tower', pos, elevation: 0, allowed: [] });
const plot = (id: string, pos: Vec2): SlotDef => ({ id, kind: 'building', pos, elevation: 0, allowed: [] });

export const TWIN_BRIDGES: MapDef = {
  id: 'twin_bridges',
  name: 'İkiz Köprü Geçidi',
  mode: 'FD',
  size: 320,
  seed: 4417,
  blurb: 'Nehri yalnızca iki köprü aşar. Köprü kapılarını tut; biri düşerse kale kapısı son hat.',
  camera: { home: [0, -30], yaw: 0, distance: 175 },
  citadel: {
    id: 'river_keep',
    name: 'Nehir Kalesi',
    pos: KEEP,
    radius: 12,
    hp: 12_000,
    door: [0, -94],
    facing: 90,
  },
  gates: [
    { id: 'bridge_w', name: 'Batı Köprüsü', pos: [-70, -4], facing: 90, width: 8, hp: 3500, breach: GATE_W },
    {
      id: 'bridge_e',
      name: 'Doğu Köprüsü',
      pos: [70, -5.75],
      facing: 90,
      width: 8,
      hp: 3500,
      breach: GATE_E,
    },
    {
      id: 'citadel_gate',
      name: 'Kale Kapısı',
      pos: [0, -60.61],
      facing: 90,
      width: 6,
      hp: 5000,
      breach: GATE_C,
      approach: [0, -51.61],
    },
  ],
  walls: [{ id: 'citadel_wall', points: WALL, height: H, thickness: 5, segmentHp: 4000 }],
  slots: [
    tower('B1', [-84, -14]),
    tower('B2', [-56, -14]),
    tower('B3', [56, -16]),
    tower('B4', [84, -16]),
    socket('W1', [-38.79, -93.16]),
    socket('W2', [-34.11, -80.3]),
    socket('W3', [-13.47, -62.98]),
    socket('W4', [13.47, -62.98]),
    socket('W5', [34.11, -80.3]),
    socket('W6', [38.79, -93.16]),
    plot('P1', [-40, -32]),
    plot('P2', [40, -32]),
    plot('P3', [-95, -48]),
    plot('P4', [95, -48]),
    plot('P5', [-20, -84]),
    plot('P6', [20, -84]),
  ],
  spawns: [
    { id: 'S_west', pos: [-130, 140], lane: 'west' },
    { id: 'S_mid', pos: [0, 148], lane: 'mid' },
    { id: 'S_east', pos: [130, 140], lane: 'east' },
  ],
  lanes: [
    {
      id: 'west',
      points: [
        [-130, 140],
        [-110, 80],
        [-70, 34],
        [-70, 5],
      ],
      target: 'bridge_w',
      targets: ['bridge_w', 'citadel_gate'],
    },
    {
      id: 'mid',
      points: [
        [0, 148],
        [0, 80],
        [40, 40],
        [70, 3.25],
      ],
      target: 'bridge_e',
      targets: ['bridge_e', 'citadel_gate'],
    },
    {
      id: 'east',
      points: [
        [130, 140],
        [110, 80],
        [70, 34],
        [70, 3.25],
      ],
      target: 'bridge_e',
      targets: ['bridge_e', 'citadel_gate'],
    },
  ],
  nav: {
    cellSize: 2,
    ops: [
      { op: 'open', label: 'ova', shape: { type: 'polygon', points: BASIN } },
      ...wallBlocks('nehir', RIVER, 9),
      { op: 'open', label: 'batı köprüsü', shape: BRIDGE_W },
      { op: 'open', label: 'doğu köprüsü', shape: BRIDGE_E },
      ...gateOps('batı köprü kapısı', GATE_W),
      ...gateOps('doğu köprü kapısı', GATE_E),
      ...wallBlocks('kale suru', WALL, 3),
      ...gateOps('kale kapısı', GATE_C),
      { op: 'block', label: 'kale', shape: { type: 'circle', center: KEEP, radius: 9 } },
    ],
  },
  waves: fdWaves(['S_west', 'S_mid', 'S_east'], 6, [
    'Nehir boyunca',
    'Ork akını',
    'Koçbaşları köprüde',
    'Uruk kalkanları',
    'Kuşatma',
    'Lurtz nehri geçiyor',
  ]),
  terrain: {
    plateaus: [{ id: 'keep_rock', center: KEEP, radius: 26, height: 3 }],
    ramps: [],
    basins: [BASIN],
    rivers: [{ points: RIVER, width: 18 }],
    bridges: [
      { a: [-70, -9], b: [-70, 23], width: 8 },
      { a: [70, -10.75], b: [70, 21.25], width: 8 },
    ],
    roads: [
      {
        points: [
          [-130, 140],
          [-110, 80],
          [-70, 34],
          [-70, -10],
          [-40, -40],
          [0, -60],
          [0, -92],
        ],
        width: 5,
      },
      {
        points: [
          [130, 140],
          [110, 80],
          [70, 34],
          [70, -10],
          [40, -40],
          [0, -60],
        ],
        width: 5,
      },
      {
        points: [
          [0, 148],
          [0, 80],
          [40, 40],
          [70, 34],
        ],
        width: 4,
      },
    ],
    theme: 'autumn',
  },
  garrison: [
    { unitType: UnitTypeId.GondorArcher, pos: [-70, -22], count: 1 },
    { unitType: UnitTypeId.GondorArcher, pos: [70, -24], count: 1 },
    { unitType: UnitTypeId.GondorSoldier, pos: [-70, -34], count: 1 },
    { unitType: UnitTypeId.GondorSoldier, pos: [70, -36], count: 1 },
    { unitType: UnitTypeId.TowerGuard, pos: [0, -48], count: 2 },
  ],
};
