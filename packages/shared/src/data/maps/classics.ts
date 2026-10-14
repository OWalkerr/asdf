import type { MapDef, SlotDef, Vec2, WaveDef, WaveGroupDef } from '../../map/types';
import { UnitTypeId } from '../units';
import { gateOps, pathOpens, wallBlocks } from './builders';

/**
 * BFME2 topluluğunun iki klasik özel harita türünün yeniden yorumu (birebir dosya kopyası
 * değil; bilinen kurallara sadık özgün yerleşim):
 *
 * - Kule Savaşı (Tower Wars): tek yol kuzeyden iner, çatalda dört şeride ayrılır ve güneydeki
 *   uç bölgede birleşir. 30 dalga, dalga başı gelir, 28. dalgada iki Balrog. Uç bölgeye
 *   varan düşman hemen can götürmez: bölgede bekler, bölge güç vuruşuyla onları eritir; içeride
 *   kalan her tabur düzenli aralıkla can götürür (bölge 2–3 dalgayı tamponlar).
 * - Kale Savunması (Fortress Defence): kale yolun tam ortasında; dört yönden gelen yollar kare
 *   surun dört kapısına, oradan kaleye çıkar. 20 dalga, her 5. dalga özel (trol sürüsü,
 *   kuşatma, warg akını, Lurtz), dalga başı gelir. Kale düşerse savaş biter.
 */
const tower = (id: string, pos: Vec2): SlotDef => ({ id, kind: 'tower', pos, elevation: 0, allowed: [] });
const plot = (id: string, pos: Vec2): SlotDef => ({ id, kind: 'building', pos, elevation: 0, allowed: [] });
const socket = (id: string, pos: Vec2, elevation: number): SlotDef => ({
  id,
  kind: 'wall_socket',
  pos,
  elevation,
  allowed: [],
});

// ───────────────────────────── Kule Savaşı ─────────────────────────────

const TW_END: Vec2 = [0, 118];
const TRUNK: Vec2[] = [
  [0, -142],
  [0, -112],
  [20, -100],
  [0, -85],
];
const lane = (pts: Vec2[]): Vec2[] => [...TRUNK, ...pts];
const TW_L1 = lane([[-120, -85], [-120, 100], [-30, 100], TW_END]);
const TW_L2 = lane([[-50, -55], [-50, 60], [-15, 60], TW_END]);
const TW_L3 = lane([[50, -55], [50, 60], [15, 60], TW_END]);
const TW_L4 = lane([[120, -85], [120, 100], [30, 100], TW_END]);

const TW_NAMES = [
  'İlk sızıntı',
  'Ork devriyesi',
  'Dört şerit',
  'Okçu öncüler',
  'Warg akını',
  'Kalabalık',
  'Uruk öncüleri',
  'Gece yürüyüşü',
  'Kurt sürüsü',
  'Kuşatma',
  'Kara sel',
  'Demir kalkanlar',
  'Ok yağmuru',
  'Isengard alayı',
  'Trol sürüsü',
  'Uzun gece',
  'Dört koldan',
  'Kızıl gözler',
  'Kemik kıranlar',
  'İkinci kuşatma',
  'Sel',
  'Uruk duvarı',
  'Kurt ayı',
  'Dağ trolleri',
  'Alev okları',
  'Son dalgalar',
  'Kara ordu',
  "Durin'in Belası",
  'Isengard yanıyor',
  'Lurtz',
];

/** 30 dalga: tabur başına bir grup, gruplar dört şeride sırayla dağılır. */
export const towerWarWaves = (spawns: readonly string[], first = 30, gap = 38): WaveDef[] =>
  Array.from({ length: 30 }, (_, w) => {
    const t0 = first + w * gap;
    const groups: WaveGroupDef[] = [];
    let k = 0;
    const add = (unitType: number, n: number, dt = 0) => {
      for (let i = 0; i < n; i++)
        groups.push({
          atSec: t0 + dt + i * 2,
          spawn: spawns[(w + k++) % spawns.length] as string,
          unitType,
          battalions: 1,
        });
    };
    const wave = w + 1;
    if (wave === 5) add(UnitTypeId.WargRider, 4);
    else if (wave === 15) add(UnitTypeId.CaveTroll, 3, 4);
    else if (wave === 25) add(UnitTypeId.OrcArcher, 6);
    else if (wave === 28) {
      // Kaliam'ın haritasındaki Balrog dalgası: iki Balrog, ardından troller.
      add(UnitTypeId.Balrog, 2, 4);
      add(UnitTypeId.CaveTroll, 2, 16);
      add(UnitTypeId.UrukHai, 2, 20);
    } else if (wave === 30) {
      add(UnitTypeId.UrukHai, 5);
      add(UnitTypeId.CaveTroll, 2, 12);
      add(UnitTypeId.Lurtz, 1, 16);
    } else {
      add(UnitTypeId.OrcWarrior, Math.min(6, 2 + Math.floor(w * 0.2)));
      if (wave >= 4) add(UnitTypeId.OrcArcher, 1 + Math.floor((wave - 4) / 8), 6);
      if (wave >= 7) add(UnitTypeId.UrukHai, 1 + Math.floor((wave - 7) / 6), 10);
      if (wave >= 9 && wave % 2 === 1) add(UnitTypeId.WargRider, 1 + Math.floor((wave - 9) / 10), 2);
      if (wave >= 17 && wave % 4 === 2) add(UnitTypeId.CaveTroll, 1, 14);
      if (wave === 10 || wave === 20) add(UnitTypeId.BatteringRam, wave === 10 ? 2 : 3, 12);
    }
    return { name: TW_NAMES[w] ?? `Dalga ${wave}`, groups };
  });

const TW_ALL: Vec2[] = [
  [-148, -148],
  [148, -148],
  [148, 148],
  [-148, 148],
];

export const TOWER_WARS: MapDef = {
  id: 'tower_wars',
  name: 'Kule Savaşı',
  mode: 'TD',
  size: 300,
  seed: 4242,
  lives: 40,
  blurb:
    "Tower Wars: tek yol dört şeride ayrılır, 30 dalga. Dalga başı altın; uç bölgede bekleyen her tabur 4 sn'de 1 can götürür. 28. dalga: iki Balrog.",
  camera: { home: [0, -20], yaw: 0, distance: 185 },
  citadel: {
    id: 'tw_base',
    name: 'Son Kale',
    pos: [0, 138],
    radius: 8,
    hp: 5000,
    door: [0, 128],
    facing: 270,
  },
  endZone: { radius: 16, strikeDamage: 60, strikePercent: 12, strikeEvery: 2, drainEvery: 4 },
  waveGold: { base: 180, perWave: 12 },
  gates: [],
  walls: [],
  slots: [
    // Gövde
    tower('T1', [-12, -128]),
    tower('T2', [12, -122]),
    tower('T3', [32, -104]),
    tower('T4', [-12, -98]),
    // Batı dış şerit
    tower('T5', [-60, -97]),
    tower('T6', [-108, -72]),
    tower('T7', [-132, -30]),
    tower('T8', [-108, 10]),
    tower('T9', [-132, 60]),
    tower('T10', [-108, 88]),
    tower('T11', [-70, 112]),
    // Batı iç şerit
    tower('T12', [-26, -60]),
    tower('T13', [-62, -30]),
    tower('T14', [-38, 0]),
    tower('T15', [-62, 30]),
    tower('T16', [-38, 48]),
    tower('T17', [-30, 72]),
    // Doğu iç şerit
    tower('T18', [26, -60]),
    tower('T19', [62, -30]),
    tower('T20', [38, 0]),
    tower('T21', [62, 30]),
    tower('T22', [38, 48]),
    tower('T23', [30, 72]),
    // Doğu dış şerit
    tower('T24', [60, -97]),
    tower('T25', [108, -72]),
    tower('T26', [132, -30]),
    tower('T27', [108, 10]),
    tower('T28', [132, 60]),
    tower('T29', [108, 88]),
    tower('T30', [70, 112]),
    // Uç bölge çevresi
    tower('T31', [-24, 128]),
    tower('T32', [24, 128]),
    plot('P1', [-40, 132]),
    plot('P2', [40, 132]),
  ],
  spawns: [
    { id: 'S1', pos: [0, -142], lane: 'l1' },
    { id: 'S2', pos: [0, -142], lane: 'l2' },
    { id: 'S3', pos: [0, -142], lane: 'l3' },
    { id: 'S4', pos: [0, -142], lane: 'l4' },
  ],
  lanes: [
    { id: 'l1', points: TW_L1, target: 'exit' },
    { id: 'l2', points: TW_L2, target: 'exit' },
    { id: 'l3', points: TW_L3, target: 'exit' },
    { id: 'l4', points: TW_L4, target: 'exit' },
  ],
  nav: {
    cellSize: 2,
    ops: [
      ...pathOpens('gövde', TRUNK, 5.5),
      ...pathOpens('şerit 1', TW_L1.slice(3), 5),
      ...pathOpens('şerit 2', TW_L2.slice(3), 5),
      ...pathOpens('şerit 3', TW_L3.slice(3), 5),
      ...pathOpens('şerit 4', TW_L4.slice(3), 5),
      { op: 'open', label: 'uç bölge', shape: { type: 'circle', center: TW_END, radius: 18 } },
      { op: 'open', label: 'son kale önü', shape: { type: 'circle', center: [0, 128], radius: 7 } },
    ],
  },
  waves: towerWarWaves(['S1', 'S2', 'S3', 'S4']),
  terrain: {
    plateaus: [],
    ramps: [],
    basins: [TW_ALL],
    roads: [
      { points: TRUNK, width: 11 },
      { points: TW_L1.slice(3), width: 9 },
      { points: TW_L2.slice(3), width: 9 },
      { points: TW_L3.slice(3), width: 9 },
      { points: TW_L4.slice(3), width: 9 },
    ],
    theme: 'dark',
  },
  garrison: [{ unitType: UnitTypeId.GondorArcher, pos: [0, 132], count: 1 }],
};

// ─────────────────────────── Kale Savunması ───────────────────────────

const R = 40;
const RING: Vec2[] = [
  [-R, -R],
  [R, -R],
  [R, R],
  [-R, R],
  [-R, -R],
];
const G_N = { type: 'capsule', a: [0, -R - 4.5], b: [0, -R + 4.5], halfWidth: 3.2 } as const;
const G_S = { type: 'capsule', a: [0, R - 4.5], b: [0, R + 4.5], halfWidth: 3.2 } as const;
const G_W = { type: 'capsule', a: [-R - 4.5, 0], b: [-R + 4.5, 0], halfWidth: 3.2 } as const;
const G_E = { type: 'capsule', a: [R - 4.5, 0], b: [R + 4.5, 0], halfWidth: 3.2 } as const;
const WALL_H = 8;

const FD_N: Vec2[] = [
  [0, -146],
  [-28, -112],
  [0, -80],
  [0, -49],
];
const FD_S: Vec2[] = [
  [0, 146],
  [28, 112],
  [0, 80],
  [0, 49],
];
const FD_W: Vec2[] = [
  [-146, 0],
  [-112, 28],
  [-80, 0],
  [-49, 0],
];
const FD_E: Vec2[] = [
  [146, 0],
  [112, -28],
  [80, 0],
  [49, 0],
];

const FD_NAMES = [
  'Keşif kolları',
  'Dört yönden',
  'Okçular',
  'Uruk öncüleri',
  'Trol sürüsü',
  'Kurtlar',
  'Kara sel',
  'Demir kalkanlar',
  'Gece hücumu',
  'Kuşatma',
  'Ok yağmuru',
  'Kemik kıranlar',
  'Isengard alayı',
  'Dört kol',
  'Warg akını',
  'Uzun gece',
  'Kızıl gözler',
  'Son hazırlık',
  'Kara ordu',
  'Lurtz ve Balrog',
];

/** 20 dalga, her dalgada dört yönden; her 5. dalga özel. */
export const fortressDefenceWaves = (spawns: readonly string[], first = 35, gap = 62): WaveDef[] =>
  Array.from({ length: 20 }, (_, w) => {
    const t0 = first + w * gap;
    const wave = w + 1;
    const groups: WaveGroupDef[] = [];
    const g = (dt: number, spawn: string, unitType: number, battalions: number) => {
      if (battalions > 0) groups.push({ atSec: t0 + dt, spawn, unitType, battalions });
    };
    spawns.forEach((spawn, k) => {
      const dt = k * 4;
      g(dt, spawn, UnitTypeId.OrcWarrior, Math.min(7, 2 + Math.floor(w / 3)));
      if (wave >= 3) g(dt + 8, spawn, UnitTypeId.OrcArcher, 1 + Math.floor(w / 8));
      if (wave >= 4) g(dt + 12, spawn, UnitTypeId.UrukHai, Math.min(5, Math.floor((w + 1) / 3)));
      if (wave >= 6 && (w + k) % 2 === 0) g(dt + 2, spawn, UnitTypeId.WargRider, 1 + Math.floor(w / 12));
      // Kuşatma merdivenleri: 4. dalgadan bir yönden, 10. dalgadan iki yönden.
      if (wave >= 4 && (w + k) % (wave >= 10 ? 2 : 4) === 0) g(dt + 16, spawn, UnitTypeId.LadderTeam, 1);
    });
    const side = (i: number) => spawns[(w + i) % spawns.length] as string;
    if (wave === 5)
      spawns.forEach((s, k) => {
        g(20 + k * 3, s, UnitTypeId.CaveTroll, k % 2 === 0 ? 1 : 0);
      });
    if (wave === 10)
      spawns.forEach((s, k) => {
        g(18 + k * 3, s, UnitTypeId.BatteringRam, 1);
      });
    if (wave === 15)
      spawns.forEach((s, k) => {
        g(1 + k * 2, s, UnitTypeId.WargRider, 1);
      });
    if (wave === 20) {
      spawns.forEach((s, k) => {
        g(20 + k * 3, s, UnitTypeId.CaveTroll, 1);
      });
      g(24, side(0), UnitTypeId.Lurtz, 1);
      g(30, side(2), UnitTypeId.Balrog, 1);
      g(26, side(1), UnitTypeId.BatteringRam, 2);
    }
    if (wave > 7 && wave % 5 !== 0 && wave % 2 === 0)
      g(22, side(2), UnitTypeId.CaveTroll, 1 + Math.floor(w / 12));
    if (wave > 5 && wave % 5 !== 0 && wave % 4 === 3) g(18, side(3), UnitTypeId.BatteringRam, 1);
    return { name: FD_NAMES[w] ?? `Dalga ${wave}`, groups };
  });

const FD_ALL: Vec2[] = [
  [-148, -148],
  [148, -148],
  [148, 148],
  [-148, 148],
];

export const FORTRESS_DEFENCE: MapDef = {
  id: 'fortress_defence',
  name: 'Kale Savunması',
  mode: 'FD',
  size: 300,
  seed: 1337,
  blurb:
    'Fortress Defence: kale yolun ortasında, kare surun dört kapısı. 20 dalga dört yönden; her 5. dalga özel. Dalga başı altın.',
  camera: { home: [0, 10], yaw: 0, distance: 175 },
  citadel: {
    id: 'fd_keep',
    name: 'Ortadiyar Kalesi',
    pos: [0, 0],
    radius: 12,
    hp: 16_000,
    door: [0, 16],
    facing: 90,
  },
  waveGold: { base: 60, perWave: 5 },
  gates: [
    { id: 'gate_n', name: 'Kuzey Kapısı', pos: [0, -R], facing: 270, width: 6, hp: 3500, breach: G_N },
    { id: 'gate_e', name: 'Doğu Kapısı', pos: [R, 0], facing: 0, width: 6, hp: 3500, breach: G_E },
    { id: 'gate_s', name: 'Güney Kapısı', pos: [0, R], facing: 90, width: 6, hp: 3500, breach: G_S },
    { id: 'gate_w', name: 'Batı Kapısı', pos: [-R, 0], facing: 180, width: 6, hp: 3500, breach: G_W },
  ],
  walls: [{ id: 'ring', points: RING, height: WALL_H, thickness: 5, segmentHp: 4000 }],
  slots: [
    socket('W1', [-R, -R], WALL_H),
    socket('W2', [R, -R], WALL_H),
    socket('W3', [R, R], WALL_H),
    socket('W4', [-R, R], WALL_H),
    socket('W5', [-20, -R], WALL_H),
    socket('W6', [20, -R], WALL_H),
    socket('W7', [R, -20], WALL_H),
    socket('W8', [R, 20], WALL_H),
    socket('W9', [20, R], WALL_H),
    socket('W10', [-20, R], WALL_H),
    socket('W11', [-R, 20], WALL_H),
    socket('W12', [-R, -20], WALL_H),
    tower('T1', [-24, -90]),
    tower('T2', [14, -66]),
    tower('T3', [24, 90]),
    tower('T4', [-14, 66]),
    tower('T5', [-90, 24]),
    tower('T6', [-66, -14]),
    tower('T7', [90, -24]),
    tower('T8', [66, 14]),
    plot('P1', [-26, -26]),
    plot('P2', [26, -26]),
    plot('P3', [26, 22]),
    plot('P4', [-26, 22]),
  ],
  spawns: [
    { id: 'S_n', pos: [0, -146], lane: 'north' },
    { id: 'S_e', pos: [146, 0], lane: 'east' },
    { id: 'S_s', pos: [0, 146], lane: 'south' },
    { id: 'S_w', pos: [-146, 0], lane: 'west' },
  ],
  lanes: [
    { id: 'north', points: FD_N, target: 'gate_n' },
    { id: 'east', points: FD_E, target: 'gate_e' },
    { id: 'south', points: FD_S, target: 'gate_s' },
    { id: 'west', points: FD_W, target: 'gate_w' },
  ],
  nav: {
    cellSize: 2,
    ops: [
      { op: 'open', label: 'ova', shape: { type: 'polygon', points: FD_ALL } },
      ...wallBlocks('sur', RING, 3),
      ...gateOps('K kapı', G_N),
      ...gateOps('D kapı', G_E),
      ...gateOps('G kapı', G_S),
      ...gateOps('B kapı', G_W),
      { op: 'block', label: 'kale', shape: { type: 'circle', center: [0, 0], radius: 9 } },
    ],
  },
  waves: fortressDefenceWaves(['S_n', 'S_e', 'S_s', 'S_w']),
  terrain: {
    plateaus: [{ id: 'keep_hill', center: [0, 0], radius: 22, height: 3 }],
    ramps: [],
    basins: [FD_ALL],
    roads: [
      { points: [...FD_N, [0, -14]], width: 6 },
      { points: [...FD_S, [0, 16]], width: 6 },
      { points: [...FD_W, [-14, 0]], width: 6 },
      { points: [...FD_E, [14, 0]], width: 6 },
    ],
    theme: 'meadow',
  },
  garrison: [
    { unitType: UnitTypeId.GondorSoldier, pos: [-14, 28], count: 1 },
    { unitType: UnitTypeId.GondorSoldier, pos: [14, -28], count: 1 },
    { unitType: UnitTypeId.GondorArcher, pos: [-28, 0], count: 1 },
    { unitType: UnitTypeId.GondorArcher, pos: [28, 0], count: 1 },
  ],
};
