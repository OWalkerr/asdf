import type { MapDef, SlotDef, Vec2 } from '../../map/types';
import { UnitTypeId } from '../units';

/**
 * Helm's Deep — sadeleştirilmiş FD haritası (GDD §10.1, Phase 1 / Adım 4).
 *
 * Yerleşim (kuzey yukarıda, düşman güneyden gelir):
 *
 *            ▲ Glittering Caves (Citadel)
 *        ┌───┴───┐   Deeping-coomb (iç vadi, bina arsaları)
 *   Horn-│       │
 *   burg ●═══════════  Deeping Wall (z = -24)
 *     ╲  kapı
 *      ╲ causeway (rampa)
 *        ╲
 *   ─────────── güney ovası (3 spawn) ───────────
 *
 * Sadeleştirmeler: culvert ve Helm's Dike yok; Hornburg tek kapılı.
 */

const WALL_Z = -24;
const WALL_X0 = -40;
const WALL_X1 = 88;
const WALL_HEIGHT = 9;
/** Deeping Wall menfezinin x konumu. */
const CULVERT_X = 20;

const HORNBURG: Vec2 = [-62, -30];
const HORNBURG_RADIUS = 22;
const HORNBURG_HEIGHT = 13;
/** Hornburg sur halkası yarıçapı ve yüksekliği (render bunu kullanır). */
export const HORNBURG_CURTAIN = { radius: 19, height: 5 } as const;

/**
 * Kapı, platonun güneydoğu kenarında (45°), rampaya bakar.
 * Koordinatlar önceden hesaplandı: sim verisinde Math.cos/sin kullanılmaz (determinizm, GDD §13.7).
 * GATE_POS = HORNBURG + 19·(cos 45°, sin 45°)
 */
const GATE_FACING = 45;
const GATE_POS: Vec2 = [-48.57, -16.57];

/** Kapı kanatlarının nav şekilleri (arka kapı: savunucuya açık, saldırana kapalı; gedikte açılır). */
const HORNBURG_GATE_SHAPE = {
  type: 'capsule',
  a: [-50.69, -18.69],
  b: [-46.45, -14.45],
  halfWidth: 2.6,
} as const;
const CULVERT_SHAPE = { type: 'capsule', a: [20, -28], b: [20, -20], halfWidth: 2 } as const;
/**
 * Hornburg arka kapısı (postern): Deeping-coomb'dan kuzeydoğu yamacındaki rampayla avluya çıkar.
 * Konumlar HORNBURG + r·(cos −60°, sin −60°) ile önceden hesaplandı (sim verisinde trigonometri yok).
 */
const POSTERN_POS: Vec2 = [-52.5, -46.45];
const POSTERN_SHAPE = { type: 'capsule', a: [-53.75, -44.29], b: [-51.25, -48.62], halfWidth: 2.4 } as const;
/** Hornburg kalesi (Citadel): avlunun kuzeybatısında, kapıya bakar. */
const KEEP_POS: Vec2 = [-68, -37];

/** Sur üstü soketler: duvar boyunca eşit aralıklı (kuleler hariç). */
const wallSockets: SlotDef[] = [-30, -14, 2, 24, 40, 70, 82].map((x, i) => ({
  id: `W${i + 1}`,
  kind: 'wall_socket',
  pos: [x, WALL_Z],
  elevation: WALL_HEIGHT,
  allowed: ['arrow_tower', 'catapult', 'burning_oil'],
}));

/** Hornburg sur halkası üzerindeki kule platformları (açı → önceden hesaplanmış konum). */
const ringSlot = (id: string, pos: Vec2): SlotDef => ({
  id,
  kind: 'tower',
  pos,
  elevation: HORNBURG_CURTAIN.height,
  allowed: ['arrow_tower', 'trebuchet'],
});

const innerPlots: SlotDef[] = (
  [
    [-12, -58],
    [18, -58],
    [48, -58],
    [-4, -92],
    [26, -92],
    [54, -92],
  ] as const
).map((pos, i) => ({
  id: `I${i + 1}`,
  kind: 'building',
  pos,
  elevation: 0,
  allowed: [],
}));

export const HELMS_DEEP: MapDef = {
  id: 'helms_deep',
  name: "Helm's Deep",
  mode: 'FD',
  size: 384,
  seed: 3019,
  camera: { home: [6, -8], yaw: 0, distance: 135 },
  blurb: 'Klasik kuşatma: Deeping Wall, menfez ve Hornburg. Kale düşerse savaş biter.',
  citadel: {
    id: 'hornburg_keep',
    name: 'Hornburg',
    pos: KEEP_POS,
    radius: 11,
    hp: 9000,
    door: [-60.5, -29.5],
    facing: GATE_FACING,
    elevation: 13,
  },
  gates: [
    {
      id: 'hornburg_gate',
      name: 'Hornburg Kapısı',
      pos: GATE_POS,
      facing: GATE_FACING,
      width: 6,
      hp: 4000,
      breach: HORNBURG_GATE_SHAPE,
    },
    // Deeping Wall menfezi (culvert): savunucuların çıkış kapısı, düşmanın kırmaya çalıştığı zayıf nokta.
    {
      id: 'culvert',
      name: 'Menfez',
      pos: [CULVERT_X, WALL_Z],
      facing: 90,
      width: 4,
      hp: 3000,
      breach: CULVERT_SHAPE,
    },
    // Menfez düşerse vadiye dolan düşman Hornburg'a arka kapıdan girmeye çalışır.
    {
      id: 'hornburg_postern',
      name: 'Arka Kapı',
      pos: POSTERN_POS,
      facing: -60,
      width: 4,
      hp: 2500,
      breach: POSTERN_SHAPE,
      approach: [-49.25, -52.08],
    },
  ],
  walls: [
    {
      id: 'deeping_wall',
      points: [
        [WALL_X0, WALL_Z],
        [WALL_X1, WALL_Z],
      ],
      height: WALL_HEIGHT,
      thickness: 6,
      segmentHp: 2500,
    },
  ],
  slots: [...wallSockets, ringSlot('H1', [-66.92, -11.65]), ringSlot('H2', [-44.78, -38.03]), ...innerPlots],
  spawns: [
    { id: 'S_main', pos: [15, 180], lane: 'causeway' },
    { id: 'S_west', pos: [-100, 176], lane: 'wall_west' },
    { id: 'S_east', pos: [120, 176], lane: 'wall_east' },
  ],
  lanes: [
    {
      id: 'causeway',
      points: [
        [15, 180],
        [12, 95],
        [10, 52],
        [GATE_POS[0] + 3, GATE_POS[1] + 3],
      ],
      target: 'hornburg_gate',
    },
    {
      id: 'wall_west',
      points: [
        [-100, 176],
        [-62, 95],
        [-6, 30],
        [CULVERT_X - 4, WALL_Z + 5],
      ],
      target: 'culvert',
      targets: ['culvert', 'hornburg_postern'],
    },
    {
      id: 'wall_east',
      points: [
        [120, 176],
        [92, 95],
        [48, 30],
        [CULVERT_X + 4, WALL_Z + 5],
      ],
      target: 'culvert',
      targets: ['culvert', 'hornburg_postern'],
    },
  ],
  // Başlangıç garnizonu: sur arkasında okçular ve piyade (menfezden çıkışa hazır), Hornburg'da muhafız.
  garrison: [
    { unitType: UnitTypeId.GondorArcher, pos: [20, -33], count: 2 },
    { unitType: UnitTypeId.GondorSoldier, pos: [2, -46], count: 2 },
    { unitType: UnitTypeId.TowerGuard, pos: [46, -46], count: 2 },
    { unitType: UnitTypeId.GondorArcher, pos: [-56, -24], count: 1 },
    { unitType: UnitTypeId.GondorSoldier, pos: [-62, -22], count: 2 },
  ],
  nav: {
    cellSize: 2,
    ops: [
      // Yürünebilir zemin: güney ovası + kuzeye daralan Deeping-coomb (render'daki vadi şekliyle aynı).
      {
        op: 'open',
        label: 'güney ovası',
        shape: {
          type: 'polygon',
          points: [
            [-150, -10],
            [150, -10],
            [150, 190],
            [-150, 190],
          ],
        },
      },
      {
        op: 'open',
        label: 'Deeping-coomb',
        shape: {
          type: 'polygon',
          points: [
            [-60, -10],
            [90, -10],
            [54.5, -152],
            [-24.5, -152],
          ],
        },
      },
      // Hornburg kayası: 13 m'lik uçurum bandı kapalı, plato içi açık.
      {
        op: 'block',
        label: 'Hornburg uçurumu',
        shape: { type: 'ring', center: HORNBURG, inner: 17.5, outer: 30 },
      },
      { op: 'open', label: 'Hornburg avlusu', shape: { type: 'circle', center: HORNBURG, radius: 17.5 } },
      // Causeway: setin yüksek kısmının yanları kapalı (yamaçtan tırmanılmaz), set üstü açık.
      {
        op: 'block',
        label: 'causeway yamaçları',
        shape: { type: 'capsule', a: [-9.1, 29.3], b: [GATE_POS[0] + 4, GATE_POS[1] + 4], halfWidth: 11 },
      },
      {
        op: 'open',
        label: 'causeway',
        shape: { type: 'capsule', a: [10, 52], b: [GATE_POS[0] + 4, GATE_POS[1] + 4], halfWidth: 4 },
      },
      // Surlar en son: kapı kapalıdır (kırılması Adım 8+), Deeping Wall vadiyi mühürler.
      {
        op: 'block',
        label: 'Hornburg sur halkası + kapı',
        shape: { type: 'ring', center: HORNBURG, inner: 17.5, outer: 20.5 },
      },
      {
        op: 'block',
        label: 'Deeping Wall',
        shape: { type: 'capsule', a: [WALL_X0, WALL_Z], b: [WALL_X1, WALL_Z], halfWidth: 3.5 },
      },
      // Arka kapılar: kapı/menfez hücreleri savunucuya açık, düşmana kapalı (GDD §4.2 Postern Gate).
      // Hornburg kapısı ekseni = GATE_POS ± 3·(cos 45°, sin 45°), önceden hesaplandı.
      { op: 'open', label: 'Hornburg kapısı', shape: HORNBURG_GATE_SHAPE },
      { op: 'block', label: 'Hornburg kapısı (düşman)', teams: [1], shape: HORNBURG_GATE_SHAPE },
      { op: 'open', label: 'menfez', shape: CULVERT_SHAPE },
      { op: 'block', label: 'menfez (düşman)', teams: [1], shape: CULVERT_SHAPE },
      // Arka kapı rampası: vadi tabanından uçurumu ve sur halkasını yararak avluya.
      {
        op: 'open',
        label: 'arka kapı rampası',
        shape: { type: 'capsule', a: [-43, -62.91], b: [-54.5, -42.99], halfWidth: 2.4 },
      },
      { op: 'block', label: 'arka kapı (düşman)', teams: [1], shape: POSTERN_SHAPE },
      // Kale gövdesi: birimler etrafında toplanır, içinden geçemez.
      { op: 'block', label: 'Hornburg kalesi', shape: { type: 'circle', center: KEEP_POS, radius: 7 } },
    ],
  },
  waves: [
    {
      name: 'Öncü birlikler',
      groups: [
        { atSec: 25, spawn: 'S_main', unitType: UnitTypeId.OrcWarrior, battalions: 3 },
        { atSec: 32, spawn: 'S_west', unitType: UnitTypeId.OrcWarrior, battalions: 2 },
      ],
    },
    {
      name: 'Beyaz El',
      groups: [
        { atSec: 95, spawn: 'S_east', unitType: UnitTypeId.UrukHai, battalions: 3 },
        { atSec: 100, spawn: 'S_main', unitType: UnitTypeId.OrcWarrior, battalions: 5 },
        { atSec: 108, spawn: 'S_west', unitType: UnitTypeId.OrcWarrior, battalions: 2 },
      ],
    },
    {
      name: 'Isengard ordusu',
      groups: [
        { atSec: 170, spawn: 'S_main', unitType: UnitTypeId.UrukHai, battalions: 4 },
        { atSec: 175, spawn: 'S_west', unitType: UnitTypeId.UrukHai, battalions: 3 },
        { atSec: 180, spawn: 'S_east', unitType: UnitTypeId.OrcWarrior, battalions: 4 },
        { atSec: 190, spawn: 'S_main', unitType: UnitTypeId.OrcWarrior, battalions: 2 },
        { atSec: 196, spawn: 'S_main', unitType: UnitTypeId.BatteringRam, battalions: 1 },
      ],
    },
    {
      name: 'Kuşatma',
      groups: [
        { atSec: 255, spawn: 'S_west', unitType: UnitTypeId.OrcWarrior, battalions: 4 },
        { atSec: 260, spawn: 'S_main', unitType: UnitTypeId.UrukHai, battalions: 4 },
        { atSec: 268, spawn: 'S_east', unitType: UnitTypeId.UrukHai, battalions: 3 },
        { atSec: 280, spawn: 'S_main', unitType: UnitTypeId.OrcWarrior, battalions: 4 },
        { atSec: 284, spawn: 'S_main', unitType: UnitTypeId.BatteringRam, battalions: 1 },
        { atSec: 290, spawn: 'S_west', unitType: UnitTypeId.BatteringRam, battalions: 1 },
      ],
    },
    {
      name: 'Son hücum',
      groups: [
        { atSec: 345, spawn: 'S_main', unitType: UnitTypeId.UrukHai, battalions: 5 },
        { atSec: 350, spawn: 'S_west', unitType: UnitTypeId.UrukHai, battalions: 3 },
        { atSec: 355, spawn: 'S_east', unitType: UnitTypeId.UrukHai, battalions: 3 },
        { atSec: 365, spawn: 'S_main', unitType: UnitTypeId.OrcWarrior, battalions: 4 },
        { atSec: 372, spawn: 'S_west', unitType: UnitTypeId.OrcWarrior, battalions: 3 },
        { atSec: 368, spawn: 'S_main', unitType: UnitTypeId.Lurtz, battalions: 1 },
        { atSec: 376, spawn: 'S_main', unitType: UnitTypeId.BatteringRam, battalions: 2 },
        { atSec: 380, spawn: 'S_east', unitType: UnitTypeId.BatteringRam, battalions: 1 },
      ],
    },
  ],
  terrain: {
    plateaus: [{ id: 'hornburg_rock', center: HORNBURG, radius: HORNBURG_RADIUS, height: HORNBURG_HEIGHT }],
    ramps: [
      {
        id: 'causeway_ramp',
        from: [10, 52],
        to: [GATE_POS[0] + 4, GATE_POS[1] + 4],
        fromHeight: 0.5,
        toHeight: HORNBURG_HEIGHT,
        width: 8,
      },
      {
        id: 'postern_ramp',
        from: [-43, -62.91],
        to: [-51.25, -48.62],
        fromHeight: 2,
        toHeight: HORNBURG_HEIGHT,
        width: 5,
      },
    ],
  },
};
