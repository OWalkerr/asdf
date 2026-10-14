import type { MapDef, SlotDef, Vec2 } from '../../map/types';
import { UnitTypeId } from '../units';
import { fdWaves, gateOps, wallBlocks } from './builders';

/**
 * Taşkalkan Kalesi — özgün FD haritası. Kuzeyde dağlara yaslanan tepe kalesi; güneyini üç
 * kapılı bir dış sur yayı çevirir, kalenin etrafında tek kapılı iç halka vardır. Düşman güneyden
 * üç koldan gelir: önce dış kapılardan biri, sonra iç kapı, en sonda kale.
 *
 *            ▲ dağlar
 *         ┌─────────┐
 *         │  ◆ KALE │  iç halka (kapı güneyde)
 *         └────╥────┘
 *     ╭─────── arsalar ───────╮  dış sur (GB, G, GD kapıları)
 *    GB          G          GD
 *   ↖ batı     güney      doğu ↗   spawn'lar
 *
 * Tüm koordinatlar önceden hesaplandı (sim verisinde trigonometri yok).
 */
const OUTER: Vec2[] = [
  [-58.26, -118],
  [-58.26, -76.21],
  [-62, -55],
  [-58.26, -33.79],
  [-47.49, -15.15],
  [-31, -1.31],
  [-10.77, 6.06],
  [10.77, 6.06],
  [31, -1.31],
  [47.49, -15.15],
  [58.26, -33.79],
  [62, -55],
  [58.26, -76.21],
  [58.26, -118],
];
const INNER: Vec2[] = [
  [25.11, -71.27],
  [18.38, -59.62],
  [6.73, -52.89],
  [-6.73, -52.89],
  [-18.38, -59.62],
  [-25.11, -71.27],
  [-25.11, -84.73],
  [-18.38, -96.38],
  [-6.73, -103.11],
  [6.73, -103.11],
  [18.38, -96.38],
  [25.11, -84.73],
  [25.11, -71.27],
];
const KEEP: Vec2 = [0, -78];

const G_SW = { type: 'capsule', a: [-36.36, -11.68], b: [-42.14, -4.78], halfWidth: 3.2 } as const;
const G_S = { type: 'capsule', a: [0, 1.56], b: [0, 10.56], halfWidth: 3.2 } as const;
const G_SE = { type: 'capsule', a: [36.36, -11.68], b: [42.14, -4.78], halfWidth: 3.2 } as const;
const G_IN = { type: 'capsule', a: [0, -57.39], b: [0, -48.39], halfWidth: 3.2 } as const;

const OUTER_H = 8;
const INNER_H = 10;

const socket = (id: string, pos: Vec2, elevation: number): SlotDef => ({
  id,
  kind: 'wall_socket',
  pos,
  elevation,
  allowed: [],
});
const plot = (id: string, pos: Vec2): SlotDef => ({ id, kind: 'building', pos, elevation: 0, allowed: [] });

const BASIN: Vec2[] = [
  [-150, -112],
  [150, -112],
  [150, 154],
  [-150, 154],
];

export const STONESHIELD: MapDef = {
  id: 'stoneshield',
  name: 'Taşkalkan Kalesi',
  mode: 'FD',
  size: 320,
  seed: 7713,
  blurb: 'Üç kapılı dış sur, tek kapılı iç halka ve tepede kale. Düşman üç koldan gelir.',
  camera: { home: [0, -20], yaw: 0, distance: 165 },
  citadel: {
    id: 'stoneshield_keep',
    name: 'Taşkalkan',
    pos: KEEP,
    radius: 12,
    hp: 12_000,
    door: [0, -62],
    facing: 90,
  },
  gates: [
    {
      id: 'gate_sw',
      name: 'Batı Kapısı',
      pos: [-39.25, -8.23],
      facing: 130,
      width: 6,
      hp: 3500,
      breach: G_SW,
    },
    { id: 'gate_s', name: 'Güney Kapısı', pos: [0, 6.06], facing: 90, width: 6, hp: 3500, breach: G_S },
    { id: 'gate_se', name: 'Doğu Kapısı', pos: [39.25, -8.23], facing: 50, width: 6, hp: 3500, breach: G_SE },
    {
      id: 'gate_inner',
      name: 'İç Kapı',
      pos: [0, -52.89],
      facing: 90,
      width: 6,
      hp: 5000,
      breach: G_IN,
      approach: [0, -43.89],
    },
  ],
  walls: [
    { id: 'outer_wall', points: OUTER, height: OUTER_H, thickness: 5, segmentHp: 3000 },
    { id: 'inner_ring', points: INNER, height: INNER_H, thickness: 5, segmentHp: 4000 },
  ],
  slots: [
    socket('W1', [-60.13, -65.6], OUTER_H),
    socket('W2', [-60.13, -44.4], OUTER_H),
    socket('W3', [-52.88, -24.47], OUTER_H),
    socket('W4', [-20.88, 2.38], OUTER_H),
    socket('W5', [20.88, 2.38], OUTER_H),
    socket('W6', [52.88, -24.47], OUTER_H),
    socket('W7', [60.13, -44.4], OUTER_H),
    socket('W8', [60.13, -65.6], OUTER_H),
    socket('K1', [21.75, -65.44], INNER_H),
    socket('K2', [-21.75, -65.44], INNER_H),
    socket('K3', [-21.75, -90.56], INNER_H),
    socket('K4', [21.75, -90.56], INNER_H),
    plot('P1', [-30, -20]),
    plot('P2', [30, -20]),
    plot('P3', [-46, -48]),
    plot('P4', [46, -48]),
    plot('P5', [-16, -28]),
    plot('P6', [16, -28]),
  ],
  spawns: [
    { id: 'S_south', pos: [0, 148], lane: 'south' },
    { id: 'S_west', pos: [-142, 128], lane: 'west' },
    { id: 'S_east', pos: [142, 128], lane: 'east' },
  ],
  lanes: [
    {
      id: 'south',
      points: [
        [0, 148],
        [0, 80],
        [0, 15.06],
      ],
      target: 'gate_s',
      targets: ['gate_s', 'gate_inner'],
    },
    {
      id: 'west',
      points: [
        [-142, 128],
        [-100, 60],
        [-45.04, -1.34],
      ],
      target: 'gate_sw',
      targets: ['gate_sw', 'gate_inner'],
    },
    {
      id: 'east',
      points: [
        [142, 128],
        [100, 60],
        [45.04, -1.34],
      ],
      target: 'gate_se',
      targets: ['gate_se', 'gate_inner'],
    },
  ],
  nav: {
    cellSize: 2,
    ops: [
      { op: 'open', label: 'vadi', shape: { type: 'polygon', points: BASIN } },
      ...wallBlocks('dış sur', OUTER, 3),
      ...wallBlocks('iç halka', INNER, 3),
      ...gateOps('GB kapı', G_SW),
      ...gateOps('G kapı', G_S),
      ...gateOps('GD kapı', G_SE),
      ...gateOps('iç kapı', G_IN),
      { op: 'block', label: 'kale', shape: { type: 'circle', center: KEEP, radius: 9 } },
    ],
  },
  waves: fdWaves(['S_south', 'S_west', 'S_east'], 6, [
    'Keşif kolları',
    'Ork sürüsü',
    'Koçbaşları',
    'Beyaz El',
    'Kuşatma',
    "Lurtz'un hücumu",
  ]),
  terrain: {
    plateaus: [{ id: 'keep_hill', center: KEEP, radius: 30, height: 4 }],
    ramps: [],
    basins: [BASIN],
    roads: [
      {
        points: [
          [0, 148],
          [0, 80],
          [0, 6],
          [0, -60],
        ],
        width: 6,
      },
      {
        points: [
          [-142, 128],
          [-100, 60],
          [-39, -8],
          [-16, -36],
          [0, -50],
        ],
        width: 5,
      },
      {
        points: [
          [142, 128],
          [100, 60],
          [39, -8],
          [16, -36],
          [0, -50],
        ],
        width: 5,
      },
    ],
    theme: 'meadow',
  },
  garrison: [
    { unitType: UnitTypeId.GondorArcher, pos: [-8, -10], count: 2 },
    { unitType: UnitTypeId.GondorSoldier, pos: [0, -24], count: 2 },
    { unitType: UnitTypeId.TowerGuard, pos: [0, -46], count: 1 },
    { unitType: UnitTypeId.GondorArcher, pos: [0, -66], count: 1 },
  ],
};
