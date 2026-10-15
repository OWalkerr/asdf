import type { CitadelDef, MapDef, Vec2 } from '../../map/types';
import { wallBlocks } from './builders';

/**
 * Çatışma (VS, BFME2 Skirmish) haritaları: her oyuncunun başlangıç konumunda bir kale; dalga,
 * kapı ve koridor yok. Oyuncular işçiyle serbest inşa eder, ordu kurar, rakip kaleyi yıkar.
 */
const start = (id: string, name: string, pos: Vec2, door: Vec2, facing: number): CitadelDef => ({
  id,
  name,
  pos,
  radius: 12,
  hp: 14_000,
  door,
  facing,
});

const square = (h: number): Vec2[] => [
  [-h, -h],
  [h, -h],
  [h, h],
  [-h, h],
];

/** İsen Geçitleri (BFME2'nin klasik 1v1 haritası): nehrin iki yakası, üç sığ geçit. */
const ISEN_RIVER: Vec2[] = [
  [8, -170],
  [-2, -90],
  [6, -30],
  [-4, 30],
  [6, 90],
  [-4, 170],
];
const ISEN_FORDS: [Vec2, Vec2][] = [
  [
    [-18, -82],
    [18, -82],
  ],
  [
    [-18, 0],
    [20, 0],
  ],
  [
    [-20, 80],
    [18, 80],
  ],
];
const ISEN_STARTS = [
  start('isen_w', 'Batı Yakası', [-112, 0], [-94, 0], 0),
  start('isen_e', 'Doğu Yakası', [112, 0], [94, 0], 180),
];
export const VS_FORDS_OF_ISEN: MapDef = {
  id: 'vs_fords_of_isen',
  name: 'İsen Geçitleri',
  mode: 'VS',
  size: 320,
  seed: 5101,
  blurb: '2 oyuncu. İsen nehrini üç sığ geçit aşar; ortadaki adacıklı geçit savaşın kalbidir.',
  camera: { home: [-80, 0], yaw: 0, distance: 170 },
  citadel: ISEN_STARTS[0] as CitadelDef,
  starts: ISEN_STARTS,
  gates: [],
  walls: [],
  slots: [],
  spawns: [],
  lanes: [],
  nav: {
    cellSize: 2,
    ops: [
      { op: 'open', label: 'ova', shape: { type: 'polygon', points: square(152) } },
      ...wallBlocks('İsen', ISEN_RIVER, 9),
      ...ISEN_FORDS.map(([a, b], i) => ({
        op: 'open' as const,
        label: `geçit ${i + 1}`,
        shape: { type: 'capsule' as const, a, b, halfWidth: 6 },
      })),
      ...ISEN_STARTS.map((s) => ({
        op: 'block' as const,
        label: s.name,
        shape: { type: 'circle' as const, center: s.pos, radius: 9 },
      })),
    ],
  },
  waves: [],
  terrain: {
    plateaus: ISEN_STARTS.map((s) => ({ id: `${s.id}_hill`, center: s.pos, radius: 26, height: 3 })),
    ramps: [],
    basins: [square(152)],
    rivers: [{ points: ISEN_RIVER, width: 18 }],
    bridges: ISEN_FORDS.map(([a, b]) => ({ a, b, width: 11 })),
    roads: [
      {
        points: [
          [-94, 0],
          [-40, -40],
          [-18, -82],
          [18, -82],
          [40, -40],
          [94, 0],
        ],
        width: 5,
      },
      {
        points: [
          [-94, 0],
          [94, 0],
        ],
        width: 6,
      },
      {
        points: [
          [-94, 0],
          [-40, 40],
          [-20, 80],
          [18, 80],
          [40, 40],
          [94, 0],
        ],
        width: 5,
      },
    ],
    theme: 'meadow',
  },
};

/** Rohan Geçidi: kuzey–güney uzanan vadi; ortada kayalık tepeler üç yol açar. */
const GAP_STARTS = [
  start('gap_n', 'Kuzey Vadisi', [0, -118], [0, -100], 90),
  start('gap_s', 'Güney Vadisi', [0, 118], [0, 100], 270),
];
const GAP_ROCKS: { c: Vec2; r: number }[] = [
  { c: [-48, 0], r: 22 },
  { c: [48, 0], r: 22 },
  { c: [-110, -30], r: 18 },
  { c: [110, 30], r: 18 },
];
export const VS_GAP_OF_ROHAN: MapDef = {
  id: 'vs_gap_of_rohan',
  name: 'Rohan Geçidi',
  mode: 'VS',
  size: 320,
  seed: 5102,
  blurb: '2 oyuncu. Dağların arasında geniş vadi; ortadaki kayalıklar orduları üç yola böler.',
  camera: { home: [0, -80], yaw: 0, distance: 170 },
  citadel: GAP_STARTS[0] as CitadelDef,
  starts: GAP_STARTS,
  gates: [],
  walls: [],
  slots: [],
  spawns: [],
  lanes: [],
  nav: {
    cellSize: 2,
    ops: [
      { op: 'open', label: 'vadi', shape: { type: 'polygon', points: square(150) } },
      ...GAP_ROCKS.map((k, i) => ({
        op: 'block' as const,
        label: `kaya ${i + 1}`,
        shape: { type: 'circle' as const, center: k.c, radius: k.r },
      })),
      ...GAP_STARTS.map((s) => ({
        op: 'block' as const,
        label: s.name,
        shape: { type: 'circle' as const, center: s.pos, radius: 9 },
      })),
    ],
  },
  waves: [],
  terrain: {
    plateaus: [
      ...GAP_STARTS.map((s) => ({ id: `${s.id}_hill`, center: s.pos, radius: 26, height: 3 })),
      ...GAP_ROCKS.map((k, i) => ({ id: `rock_${i}`, center: k.c, radius: k.r + 2, height: 9 })),
    ],
    ramps: [],
    basins: [square(150)],
    roads: [
      {
        points: [
          [0, -100],
          [0, 100],
        ],
        width: 6,
      },
      {
        points: [
          [0, -100],
          [-90, -40],
          [-90, 40],
          [0, 100],
        ],
        width: 4,
      },
      {
        points: [
          [0, -100],
          [90, -40],
          [90, 40],
          [0, 100],
        ],
        width: 4,
      },
    ],
    theme: 'autumn',
  },
};

/** Yaban Topraklar (Wilderland, 4 oyuncu): dört köşede kale, ortada ormanlı tepe. */
const WILD_STARTS = [
  start('wild_nw', 'Kuzeybatı', [-108, -108], [-92, -92], 45),
  start('wild_ne', 'Kuzeydoğu', [108, -108], [92, -92], 135),
  start('wild_se', 'Güneydoğu', [108, 108], [92, 92], 225),
  start('wild_sw', 'Güneybatı', [-108, 108], [-92, 92], 315),
];
export const VS_WILDERLAND: MapDef = {
  id: 'vs_wilderland',
  name: 'Yaban Topraklar',
  mode: 'VS',
  size: 320,
  seed: 5104,
  blurb: '4 oyuncu (2v2 ya da herkes kendine). Köşelerde kaleler, ortada ormanlı tepe.',
  camera: { home: [-70, -70], yaw: 0, distance: 175 },
  citadel: WILD_STARTS[0] as CitadelDef,
  starts: WILD_STARTS,
  gates: [],
  walls: [],
  slots: [],
  spawns: [],
  lanes: [],
  nav: {
    cellSize: 2,
    ops: [
      { op: 'open', label: 'ova', shape: { type: 'polygon', points: square(152) } },
      { op: 'block', label: 'orta tepe', shape: { type: 'circle', center: [0, 0], radius: 20 } },
      ...WILD_STARTS.map((s) => ({
        op: 'block' as const,
        label: s.name,
        shape: { type: 'circle' as const, center: s.pos, radius: 9 },
      })),
    ],
  },
  waves: [],
  terrain: {
    plateaus: [
      ...WILD_STARTS.map((s) => ({ id: `${s.id}_hill`, center: s.pos, radius: 26, height: 3 })),
      { id: 'mid_hill', center: [0, 0], radius: 24, height: 10 },
    ],
    ramps: [],
    basins: [square(152)],
    roads: [
      {
        points: [
          [-92, -92],
          [92, -92],
          [92, 92],
          [-92, 92],
          [-92, -92],
        ],
        width: 5,
      },
      {
        points: [
          [-92, -92],
          [-30, -30],
        ],
        width: 4,
      },
      {
        points: [
          [92, 92],
          [30, 30],
        ],
        width: 4,
      },
    ],
    theme: 'meadow',
  },
};
