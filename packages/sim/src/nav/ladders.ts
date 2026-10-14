import type { MapDef, Vec2 } from '@bulwark/shared';
import type { NavGrid } from './grid';

const cellIndexAt = (grid: NavGrid, x: number, z: number): number => {
  const half = (grid.cols * grid.cellSize) / 2;
  const c = Math.floor((x + half) / grid.cellSize);
  const r = Math.floor((z + half) / grid.cellSize);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return -1;
  return r * grid.cols + c;
};

/**
 * Kuşatma merdiveni noktaları (BFME2): her FD koridoru için, koridorun ilk hedef kapısının
 * bulunduğu sur boyunca kapıya 12–34 m uzaklıktaki noktalar; dışı (O) ve içi (I) düşmana açık
 * olmalı. Koridorun ucuna yakınlığa göre sıralı, birbirinden ≥ 6 m aralıklı en fazla 6 nokta.
 * Saf fonksiyon (yalnızca + − × ÷ ve karekök): sim ve istemci aynı noktaları bulur.
 */
export interface LadderSpot {
  /** Sur üzerindeki nokta, dış ayak, iç ayak (m). */
  p: Vec2;
  o: Vec2;
  i: Vec2;
  /** Surun dışa bakan birim normali ve yüksekliği. */
  n: Vec2;
  height: number;
}

/** Merdiven ayaklarının sur ekseninden uzaklığı (m). */
export const LADDER_REACH = 4.5;
const MAX_SPOTS = 6;

export const ladderSpots = (map: MapDef, grid: NavGrid): LadderSpot[][] =>
  map.lanes.map((lane) => {
    if (map.mode !== 'FD' || map.walls.length === 0) return [];
    const gate = map.gates.find((g) => g.id === (lane.targets ?? [lane.target])[0]);
    if (!gate) return [];
    const end = lane.points[lane.points.length - 1] as Vec2;
    const enemyOpen = (x: number, z: number) => {
      const c = cellIndexAt(grid, x, z);
      return c >= 0 && ((grid.blocked[c] as number) & 2) === 0;
    };
    // Kapıya en yakın sur.
    let wall = map.walls[0] as MapDef['walls'][number];
    let best = Number.POSITIVE_INFINITY;
    for (const w of map.walls)
      for (const q of w.points) {
        const d = (q[0] - gate.pos[0]) ** 2 + (q[1] - gate.pos[1]) ** 2;
        if (d < best) {
          best = d;
          wall = w;
        }
      }
    const cands: { s: LadderSpot; score: number }[] = [];
    for (let k = 1; k < wall.points.length; k++) {
      const a = wall.points[k - 1] as Vec2;
      const b = wall.points[k] as Vec2;
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 8) continue;
      const tx = dx / len;
      const tz = dz / len;
      for (let t = 3; t <= len - 3; t += 2) {
        const p: Vec2 = [a[0] + tx * t, a[1] + tz * t];
        const dg = Math.sqrt((p[0] - gate.pos[0]) ** 2 + (p[1] - gate.pos[1]) ** 2);
        if (dg < 12 || dg > 34) continue;
        if (map.gates.some((g) => (p[0] - g.pos[0]) ** 2 + (p[1] - g.pos[1]) ** 2 < 100)) continue;
        let nx = -tz;
        let nz = tx;
        if ((end[0] - p[0]) * nx + (end[1] - p[1]) * nz < 0) {
          nx = -nx;
          nz = -nz;
        }
        const o: Vec2 = [p[0] + nx * LADDER_REACH, p[1] + nz * LADDER_REACH];
        const i: Vec2 = [p[0] - nx * LADDER_REACH, p[1] - nz * LADDER_REACH];
        if (!enemyOpen(o[0], o[1]) || !enemyOpen(i[0], i[1])) continue;
        const score = (p[0] - end[0]) ** 2 + (p[1] - end[1]) ** 2;
        cands.push({ s: { p, o, i, n: [nx, nz], height: wall.height }, score });
      }
    }
    cands.sort((x, y) => x.score - y.score);
    const out: LadderSpot[] = [];
    for (const c of cands) {
      if (out.length >= MAX_SPOTS) break;
      if (out.some((s) => (s.p[0] - c.s.p[0]) ** 2 + (s.p[1] - c.s.p[1]) ** 2 < 36)) continue;
      out.push(c.s);
    }
    return out;
  });

/** Merdiven geçidindeki hücreler (O→I kapsülü, yarıçap 1.5 m) — yalnızca sur hücreleri. */
export const ladderCells = (grid: NavGrid, spot: LadderSpot): number[] => {
  const out: number[] = [];
  const half = (grid.cols * grid.cellSize) / 2;
  const [ax, az] = spot.o;
  const [bx, bz] = spot.i;
  const minX = Math.min(ax, bx) - 2;
  const maxX = Math.max(ax, bx) + 2;
  const minZ = Math.min(az, bz) - 2;
  const maxZ = Math.max(az, bz) + 2;
  const c0 = Math.max(0, Math.floor((minX + half) / grid.cellSize));
  const c1 = Math.min(grid.cols - 1, Math.floor((maxX + half) / grid.cellSize));
  const r0 = Math.max(0, Math.floor((minZ + half) / grid.cellSize));
  const r1 = Math.min(grid.rows - 1, Math.floor((maxZ + half) / grid.cellSize));
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const x = -half + (c + 0.5) * grid.cellSize;
      const z = -half + (r + 0.5) * grid.cellSize;
      let t = ((x - ax) * abx + (z - az) * abz) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = x - (ax + abx * t);
      const dz = z - (az + abz * t);
      if (dx * dx + dz * dz <= 1.5 * 1.5) out.push(r * grid.cols + c);
    }
  return out;
};
