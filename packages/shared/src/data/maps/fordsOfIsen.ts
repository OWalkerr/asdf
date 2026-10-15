import type { MapDef, SlotDef, Vec2 } from '../../map/types';
import { UnitTypeId } from '../units';
import { fdWaves, gateOps, wallBlocks } from './builders';

/**
 * İsen Geçitleri — BFME2 çok oyunculu haritalarının klasiği (Fords of Isen). İsen nehri ovayı
 * kuzeyden güneye böler; yalnızca üç sığ geçitten (ortadaki adacıklı) karşıya geçilir. Rohan'ın
 * batı yakasındaki kalesi yay biçimli bir surla korunur. Düşman doğudan, Isengard yönünden gelir:
 * önce geçit kapıları, sonra kale kapısı.
 *
 * Koordinatlar üretici betikle önceden hesaplandı (sim verisinde trigonometri yok).
 */
const WALL: Vec2[] = [
  [-152, -40.0],
  [-108.0, -40.0],
  [-96.73, -38.38],
  [-86.37, -33.65],
  [-77.77, -26.19],
  [-71.61, -16.62],
  [-68.41, -5.69],
  [-68.41, 5.69],
  [-71.61, 16.62],
  [-77.77, 26.19],
  [-86.37, 33.65],
  [-96.73, 38.38],
  [-108.0, 40.0],
  [-152, 40.0],
];
const RIVER: Vec2[] = [
  [14, -170],
  [2, -90],
  [10, -30],
  [4, 30],
  [12, 90],
  [2, 170],
];
const KEEP: Vec2 = [-108.0, 0.0];
const BASIN: Vec2[] = [
  [-150, -150],
  [150, -150],
  [150, 150],
  [-150, 150],
];
const H = 8;
const socket = (id: string, pos: Vec2): SlotDef => ({
  id,
  kind: 'wall_socket',
  pos,
  elevation: H,
  allowed: [],
});

const FORDS = [
  {
    id: 'ford_n',
    name: 'Kuzey Geçidi',
    pos: [-1.9, -78],
    facing: 0,
    width: 8,
    hp: 3500,
    breach: { type: 'capsule', a: [-4.4, -78], b: [0.6, -78], halfWidth: 4 } as const,
  },
  {
    id: 'ford_m',
    name: 'Ada Geçidi',
    pos: [1.5, 0],
    facing: 0,
    width: 8,
    hp: 3500,
    breach: { type: 'capsule', a: [-1.0, 0], b: [4.0, 0], halfWidth: 4 } as const,
  },
  {
    id: 'ford_s',
    name: 'Güney Geçidi',
    pos: [4.9, 78],
    facing: 0,
    width: 8,
    hp: 3500,
    breach: { type: 'capsule', a: [2.4, 78], b: [7.4, 78], halfWidth: 4 } as const,
  },
] as const;
const KEEP_GATE = { type: 'capsule', a: [-72.91, 0], b: [-63.91, 0], halfWidth: 3.2 } as const;

export const FORDS_OF_ISEN: MapDef = {
  id: 'fords_of_isen',
  name: 'İsen Geçitleri',
  mode: 'FD',
  size: 320,
  seed: 3018,
  blurb: 'Nehri üç sığ geçit aşar; ortadaki adacıktan geçer. Geçit kapılarını tut, kale yayın ardında.',
  camera: { home: [-40, 0], yaw: 0, distance: 180 },
  citadel: {
    id: 'isen_keep',
    name: 'Geçit Muhafızlığı',
    pos: KEEP,
    radius: 12,
    hp: 12_000,
    door: [-90.0, 0],
    facing: 0,
  },
  gates: [
    ...FORDS,
    {
      id: 'keep_gate',
      name: 'Kale Kapısı',
      pos: [-68.41, 0.0],
      facing: 0,
      width: 6,
      hp: 5000,
      breach: KEEP_GATE,
      approach: [-59.41, 0],
    },
  ],
  walls: [{ id: 'keep_wall', points: WALL, height: H, thickness: 5, segmentHp: 4000 }],
  slots: [
    socket('W1', [-91.55, -36.01]),
    socket('W2', [-74.69, -21.41]),
    socket('W3', [-74.69, 21.41]),
    socket('W4', [-91.55, 36.01]),
  ],
  spawns: [
    { id: 'S_north', pos: [146, -130], lane: 'north' },
    { id: 'S_mid', pos: [148, 0], lane: 'mid' },
    { id: 'S_south', pos: [146, 130], lane: 'south' },
  ],
  lanes: [
    {
      id: 'north',
      points: [
        [146, -130],
        [80, -78],
        [23.6, -78],
      ],
      target: 'ford_n',
      targets: ['ford_n', 'keep_gate'],
    },
    {
      id: 'mid',
      points: [
        [148, 0],
        [80, 0],
        [27.0, 0],
      ],
      target: 'ford_m',
      targets: ['ford_m', 'keep_gate'],
    },
    {
      id: 'south',
      points: [
        [146, 130],
        [80, 78],
        [30.4, 78],
      ],
      target: 'ford_s',
      targets: ['ford_s', 'keep_gate'],
    },
  ],
  nav: {
    cellSize: 2,
    ops: [
      { op: 'open', label: 'ova', shape: { type: 'polygon', points: BASIN } },
      ...wallBlocks('İsen', RIVER, 9),
      {
        op: 'open',
        label: 'Kuzey Geçidi',
        shape: { type: 'capsule', a: [-10.4, -78], b: [17.6, -78], halfWidth: 4 },
      },
      ...gateOps('Kuzey Geçidi kapısı', FORDS[0].breach),
      {
        op: 'open',
        label: 'Ada Geçidi',
        shape: { type: 'capsule', a: [-7.0, 0], b: [21.0, 0], halfWidth: 4 },
      },
      ...gateOps('Ada Geçidi kapısı', FORDS[1].breach),
      {
        op: 'open',
        label: 'Güney Geçidi',
        shape: { type: 'capsule', a: [-3.6, 78], b: [24.4, 78], halfWidth: 4 },
      },
      ...gateOps('Güney Geçidi kapısı', FORDS[2].breach),
      ...wallBlocks('kale suru', WALL, 3),
      ...gateOps('kale kapısı', KEEP_GATE),
      { op: 'block', label: 'kale', shape: { type: 'circle', center: KEEP, radius: 9 } },
    ],
  },
  waves: fdWaves(['S_north', 'S_mid', 'S_south'], 7, [
    'Isengard kurtları',
    'Uruk öncüsü',
    'Geçitlere koçbaşı',
    'Beyaz El',
    'Adacık savaşı',
    'Kuşatma',
    'Lurtz geçitlerde',
  ]),
  terrain: {
    plateaus: [{ id: 'keep_rock', center: KEEP, radius: 26, height: 3 }],
    ramps: [],
    basins: [BASIN],
    rivers: [{ points: RIVER, width: 18 }],
    bridges: [
      { a: [-8.4, -78], b: [15.6, -78], width: 9 },
      { a: [-5.0, 0], b: [19.0, 0], width: 9 },
      { a: [-1.6, 78], b: [22.4, 78], width: 9 },
    ],
    roads: [
      {
        points: [
          [146, -130],
          [80, -78],
          [3.6, -78],
          [-40, -31.2],
          [-60.41, 0],
          [-92.0, 0],
        ],
        width: 5,
      },
      {
        points: [
          [148, 0],
          [80, 0],
          [7.0, 0],
          [-40, 0.0],
          [-60.41, 0],
          [-92.0, 0],
        ],
        width: 5,
      },
      {
        points: [
          [146, 130],
          [80, 78],
          [10.4, 78],
          [-40, 31.2],
          [-60.41, 0],
          [-92.0, 0],
        ],
        width: 5,
      },
    ],
    theme: 'meadow',
  },
  garrison: [
    { unitType: UnitTypeId.GondorArcher, pos: [-22.4, -70], count: 1 },
    { unitType: UnitTypeId.GondorArcher, pos: [-19.0, 8], count: 1 },
    { unitType: UnitTypeId.GondorArcher, pos: [-15.6, 70], count: 1 },
    { unitType: UnitTypeId.GondorSoldier, pos: [-40, -20], count: 1 },
    { unitType: UnitTypeId.GondorSoldier, pos: [-40, 20], count: 1 },
    { unitType: UnitTypeId.TowerGuard, pos: [-78.41, 0], count: 1 },
  ],
};
