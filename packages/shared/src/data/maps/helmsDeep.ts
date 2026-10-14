import type { MapDef, SlotDef, Vec2 } from '../../map/types';

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
  camera: { home: [8, -10], yaw: 0, distance: 175 },
  citadel: { id: 'glittering_caves', pos: [15, -140], radius: 10, hp: 10_000 },
  gates: [{ id: 'hornburg_gate', pos: GATE_POS, facing: GATE_FACING, width: 6, hp: 3000 }],
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
        [-16, 30],
        [-14, WALL_Z + 6],
      ],
      target: 'deeping_wall',
    },
    {
      id: 'wall_east',
      points: [
        [120, 176],
        [92, 95],
        [60, 30],
        [56, WALL_Z + 6],
      ],
      target: 'deeping_wall',
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
    ],
  },
};
