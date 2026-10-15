import type { MapDef, SlotDef, Vec2 } from '../../map/types';
import { UnitTypeId } from '../units';
import { fdWaves, gateOps, wallBlocks } from './builders';

/**
 * Minas Tirith — BFME/BFME2'nin en bilinen kuşatma haritasının yorumu. Mindolluin'e yaslanan
 * yedi katlı şehrin üç halkası: Pelennor'a bakan Büyük Kapı (doğu), ardından zikzak çizen İkinci
 * ve Üçüncü kapılar; en üstte Beyaz Kule (kale). Mordor orduları doğudan, Osgiliath yönünden
 * üç koldan gelir; her kapı düştükçe savunma bir halka içeri çekilir.
 *
 * Koordinatlar üretici betikle önceden hesaplandı (sim verisinde trigonometri yok).
 */
const OUTER: Vec2[] = [
  [32.25, 11.49],
  [26.3, 33.68],
  [14.82, 53.57],
  [-1.43, 69.82],
  [-21.32, 81.3],
  [-43.51, 87.25],
  [-66.49, 87.25],
  [-88.68, 81.3],
  [-108.57, 69.82],
  [-124.82, 53.57],
  [-136.3, 33.68],
  [-142.25, 11.49],
  [-142.25, -11.49],
  [-136.3, -33.68],
  [-124.82, -53.57],
  [-108.57, -69.82],
  [-88.68, -81.3],
  [-66.49, -87.25],
  [-43.51, -87.25],
  [-21.32, -81.3],
  [-1.43, -69.82],
  [14.82, -53.57],
  [26.3, -33.68],
  [32.25, -11.49],
  [32.25, 11.49],
];
const MIDDLE: Vec2[] = [
  [-15.64, 45.28],
  [-31.56, 55.23],
  [-49.77, 59.77],
  [-68.5, 58.46],
  [-85.9, 51.43],
  [-100.28, 39.36],
  [-110.23, 23.44],
  [-114.77, 5.23],
  [-113.46, -13.5],
  [-106.43, -30.9],
  [-94.36, -45.28],
  [-78.44, -55.23],
  [-60.23, -59.77],
  [-41.5, -58.46],
  [-24.1, -51.43],
  [-9.72, -39.36],
  [0.23, -23.44],
  [4.77, -5.23],
  [3.46, 13.5],
  [-3.57, 30.9],
  [-15.64, 45.28],
];
const INNER: Vec2[] = [
  [-25.19, -16.35],
  [-21.2, -3.7],
  [-22.36, 9.51],
  [-28.48, 21.28],
  [-38.65, 29.81],
  [-51.3, 33.8],
  [-64.51, 32.64],
  [-76.28, 26.52],
  [-84.81, 16.35],
  [-88.8, 3.7],
  [-87.64, -9.51],
  [-81.52, -21.28],
  [-71.35, -29.81],
  [-58.7, -33.8],
  [-45.49, -32.64],
  [-33.72, -26.52],
  [-25.19, -16.35],
];
const TOWER: Vec2 = [-55.0, 0.0];
const BASIN: Vec2[] = [
  [-150, -150],
  [150, -150],
  [150, 150],
  [-150, 150],
];

const socket = (id: string, pos: Vec2, elevation: number): SlotDef => ({
  id,
  kind: 'wall_socket',
  pos,
  elevation,
  allowed: [],
});

const GATES = [
  {
    id: 'gate_great',
    name: 'Büyük Kapı',
    pos: [32.25, 0.0],
    facing: 0,
    width: 7,
    hp: 6500,
    breach: { type: 'capsule', a: [27.75, 0.0], b: [36.75, 0.0], halfWidth: 3.4 } as const,
  },
  {
    id: 'gate_second',
    name: 'İkinci Kapı',
    pos: [-9.6, 38.09],
    facing: 40,
    width: 7,
    hp: 5000,
    breach: { type: 'capsule', a: [-13.05, 35.2], b: [-6.16, 40.98], halfWidth: 3.4 } as const,
    approach: [-2.71, 43.88],
  },
  {
    id: 'gate_third',
    name: 'Üçüncü Kapı',
    pos: [-29.45, -21.43],
    facing: 320,
    width: 7,
    hp: 5000,
    breach: { type: 'capsule', a: [-32.9, -18.54], b: [-26.01, -24.33], halfWidth: 3.4 } as const,
    approach: [-22.56, -27.22],
  },
] as const;

export const MINAS_TIRITH: MapDef = {
  id: 'minas_tirith',
  name: 'Minas Tirith',
  mode: 'FD',
  size: 320,
  seed: 3019,
  blurb: 'Üç halkalı Beyaz Şehir. Büyük Kapı düşerse savunma zikzak kapılardan içeri çekilir.',
  camera: { home: [10, 10], yaw: 0, distance: 185 },
  citadel: {
    id: 'white_tower',
    name: 'Beyaz Kule',
    pos: TOWER,
    radius: 12,
    hp: 14_000,
    door: [-41.98, -10.93],
    facing: 320,
  },
  gates: [...GATES],
  walls: [
    { id: 'ring_outer', points: OUTER, height: 9, thickness: 5, segmentHp: 3200 },
    { id: 'ring_middle', points: MIDDLE, height: 10, thickness: 5, segmentHp: 3800 },
    { id: 'ring_inner', points: INNER, height: 12, thickness: 5, segmentHp: 4500 },
  ],
  slots: [
    socket('G3', [6.69, 61.69], 9),
    socket('G6', [-55.0, 87.25], 9),
    socket('G9', [-116.69, 61.69], 9),
    socket('G14', [-130.56, -43.62], 9),
    socket('G17', [-77.58, -84.27], 9),
    socket('G20', [-11.38, -75.56], 9),
    socket('M3', [-59.13, 59.12], 10),
    socket('M6', [-105.26, 31.4], 10),
    socket('M13', [-50.87, -59.12], 10),
    socket('M16', [-4.74, -31.4], 10),
    socket('I4', [-33.57, 25.55], 12),
    socket('I8', [-80.55, 21.43], 12),
    socket('I12', [-76.43, -25.55], 12),
  ],
  spawns: [
    { id: 'S_north', pos: [146, -128], lane: 'north' },
    { id: 'S_east', pos: [148, 0], lane: 'east' },
    { id: 'S_south', pos: [146, 128], lane: 'south' },
  ],
  lanes: [
    {
      id: 'north',
      points: [
        [146, -128],
        [90, -60],
        [44.25, -6],
      ],
      target: 'gate_great',
      targets: ['gate_great', 'gate_second', 'gate_third'],
    },
    {
      id: 'east',
      points: [
        [148, 0],
        [90, 0],
        [44.25, 0],
      ],
      target: 'gate_great',
      targets: ['gate_great', 'gate_second', 'gate_third'],
    },
    {
      id: 'south',
      points: [
        [146, 128],
        [90, 60],
        [44.25, 6],
      ],
      target: 'gate_great',
      targets: ['gate_great', 'gate_second', 'gate_third'],
    },
  ],
  nav: {
    cellSize: 2,
    ops: [
      { op: 'open', label: 'Pelennor', shape: { type: 'polygon', points: BASIN } },
      ...wallBlocks('birinci halka', OUTER, 3),
      ...wallBlocks('ikinci halka', MIDDLE, 3),
      ...wallBlocks('üçüncü halka', INNER, 3),
      ...gateOps('Büyük Kapı', GATES[0].breach),
      ...gateOps('İkinci Kapı', GATES[1].breach),
      ...gateOps('Üçüncü Kapı', GATES[2].breach),
      { op: 'block', label: 'Beyaz Kule', shape: { type: 'circle', center: TOWER, radius: 9 } },
    ],
  },
  waves: fdWaves(
    ['S_north', 'S_east', 'S_south'],
    8,
    [
      'Osgiliath düştü',
      'Pelennor akını',
      'Koçbaşları',
      'Kuşatma kuleleri',
      'Haradrim yürüyüşü',
      'Grond yaklaşıyor',
      'Karanlık Kapı',
      'Son hücum',
    ],
    35,
    70,
  ),
  terrain: {
    plateaus: [{ id: 'citadel_rock', center: TOWER, radius: 24, height: 5 }],
    ramps: [],
    basins: [BASIN],
    roads: [
      {
        points: [
          [148, 0],
          [32.25, 0],
          [-9.6, 38.09],
          [-29.45, -21.43],
          [-41.98, -10.93],
        ],
        width: 6,
      },
      {
        points: [
          [146, -128],
          [90, -60],
          [44.25, -6],
        ],
        width: 5,
      },
      {
        points: [
          [146, 128],
          [90, 60],
          [44.25, 6],
        ],
        width: 5,
      },
    ],
    theme: 'dark',
  },
  garrison: [
    { unitType: UnitTypeId.GondorArcher, pos: [20.25, -12], count: 1 },
    { unitType: UnitTypeId.GondorArcher, pos: [20.25, 12], count: 1 },
    { unitType: UnitTypeId.GondorSoldier, pos: [14.25, 0], count: 2 },
    { unitType: UnitTypeId.TowerGuard, pos: [-17.6, 32.09], count: 1 },
    { unitType: UnitTypeId.GondorArcher, pos: [-35.45, -15.43], count: 1 },
  ],
};
