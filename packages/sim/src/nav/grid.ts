import { FX_ONE, type Fx, type MapDef, type NavShape, type Vec2 } from '@bulwark/shared';

/**
 * Navigasyon ızgarası (GDD §2.4). Hücre başına 1 bayt bit maskesi: bit t = takım t için kapalı
 * (BLOCK_ALL = herkese kapalı). Arka kapılar (postern) yalnızca düşman bitini taşır.
 * Harita verisindeki NavOp listesi yalnızca + − × ÷ ve karşılaştırma ile çizilir
 * (trigonometri/karekök yok) → her istemcide bit-bit aynı ızgara.
 */
export interface NavGrid {
  cols: number;
  rows: number;
  /** Hücre kenarı (m) ve Q16.16 karşılığı. */
  cellSize: number;
  cellFx: Fx;
  /** Izgaranın sol-üst köşesi (x = z = -size/2), Fx. */
  originFx: Fx;
  /** Takım bit maskesi (bit t = takım t için kapalı). */
  blocked: Uint8Array;
  /** En yakın (herhangi bir takıma) kapalı hücreye uzaklık (hücre, 255'te doyar) — formasyon genişliği için. */
  clearance: Uint8Array;
}

const pointInPolygon = (x: number, z: number, pts: readonly Vec2[]): boolean => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i] as Vec2;
    const [xj, zj] = pts[j] as Vec2;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

const distSqToSegment = (x: number, z: number, a: Vec2, b: Vec2): number => {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((x - a[0]) * abx + (z - a[1]) * abz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x - (a[0] + abx * t);
  const dz = z - (a[1] + abz * t);
  return dx * dx + dz * dz;
};

/** 4 takımın hepsine kapalı. */
export const BLOCK_ALL = 0x0f;

export const teamMask = (teams?: readonly number[]): number =>
  teams ? teams.reduce((m, t) => m | (1 << t), 0) & BLOCK_ALL : BLOCK_ALL;

export const shapeContains = (shape: NavShape, x: number, z: number): boolean => {
  switch (shape.type) {
    case 'polygon':
      return pointInPolygon(x, z, shape.points);
    case 'circle': {
      const dx = x - shape.center[0];
      const dz = z - shape.center[1];
      return dx * dx + dz * dz <= shape.radius * shape.radius;
    }
    case 'ring': {
      const dx = x - shape.center[0];
      const dz = z - shape.center[1];
      const d2 = dx * dx + dz * dz;
      return d2 >= shape.inner * shape.inner && d2 <= shape.outer * shape.outer;
    }
    case 'capsule':
      return distSqToSegment(x, z, shape.a, shape.b) <= shape.halfWidth * shape.halfWidth;
  }
};

const allocGrid = (size: number, cellSize: number): NavGrid => {
  const cols = size / cellSize;
  return {
    cols,
    rows: cols,
    cellSize,
    cellFx: cellSize * FX_ONE,
    originFx: (-size / 2) * FX_ONE,
    blocked: new Uint8Array(cols * cols),
    clearance: new Uint8Array(cols * cols),
  };
};

/** Haritanın nav işlemlerinden ızgara üretir. */
export const buildNavGrid = (map: Pick<MapDef, 'size' | 'nav'>): NavGrid => {
  const { cellSize, ops } = map.nav;
  const grid = allocGrid(map.size, cellSize);
  const half = map.size / 2;
  const masks = ops.map((op) => teamMask(op.teams));
  for (let r = 0; r < grid.rows; r++) {
    const z = -half + (r + 0.5) * cellSize;
    for (let c = 0; c < grid.cols; c++) {
      const x = -half + (c + 0.5) * cellSize;
      let blocked = BLOCK_ALL;
      ops.forEach((op, k) => {
        if (!shapeContains(op.shape, x, z)) return;
        blocked = op.op === 'open' ? 0 : blocked | (masks[k] as number);
      });
      grid.blocked[r * grid.cols + c] = blocked;
    }
  }
  computeClearance(grid);
  return grid;
};

/** Haritasız (look-dev) kullanım: kenarları kapalı, içi tamamen açık ızgara. */
export const createOpenGrid = (size: number, cellSize = 2): NavGrid => {
  const grid = allocGrid(size, cellSize);
  for (let r = 0; r < grid.rows; r++)
    for (let c = 0; c < grid.cols; c++)
      grid.blocked[r * grid.cols + c] =
        r === 0 || c === 0 || r === grid.rows - 1 || c === grid.cols - 1 ? 1 : 0;
  computeClearance(grid);
  return grid;
};

/** İki geçişli tamsayı chamfer (3/4) uzaklık dönüşümü → hücre cinsinden boşluk. */
const computeClearance = (grid: NavGrid): void => {
  const { cols, rows, blocked } = grid;
  const n = cols * rows;
  const d = new Int32Array(n);
  const INF = 1 << 20;
  for (let i = 0; i < n; i++) d[i] = blocked[i] ? 0 : INF;
  const relax = (i: number, j: number, w: number) => {
    const v = (d[j] as number) + w;
    if (v < (d[i] as number)) d[i] = v;
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c > 0) relax(i, i - 1, 3);
      if (r > 0) {
        relax(i, i - cols, 3);
        if (c > 0) relax(i, i - cols - 1, 4);
        if (c < cols - 1) relax(i, i - cols + 1, 4);
      }
    }
  for (let r = rows - 1; r >= 0; r--)
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      if (c < cols - 1) relax(i, i + 1, 3);
      if (r < rows - 1) {
        relax(i, i + cols, 3);
        if (c < cols - 1) relax(i, i + cols + 1, 4);
        if (c > 0) relax(i, i + cols - 1, 4);
      }
    }
  for (let i = 0; i < n; i++) grid.clearance[i] = Math.min(255, ((d[i] as number) / 3) | 0);
};

/** Fx dünya konumunun hücre indeksi; ızgara dışıysa -1. */
export const cellAt = (grid: NavGrid, x: Fx, z: Fx): number => {
  const c = Math.floor((x - grid.originFx) / grid.cellFx);
  const r = Math.floor((z - grid.originFx) / grid.cellFx);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return -1;
  return r * grid.cols + c;
};

/** Hücre takım için kapalı mı. */
export const blockedFor = (grid: NavGrid, i: number, team: number): boolean =>
  (((grid.blocked[i] as number) >> team) & 1) === 1;

export const isBlockedAt = (grid: NavGrid, x: Fx, z: Fx, team: number): boolean => {
  const i = cellAt(grid, x, z);
  return i < 0 || blockedFor(grid, i, team);
};

/** Hücre merkezinin Fx koordinatları. */
export const cellCenterX = (grid: NavGrid, i: number): Fx =>
  grid.originFx + (i % grid.cols) * grid.cellFx + (grid.cellFx >> 1);
export const cellCenterZ = (grid: NavGrid, i: number): Fx =>
  grid.originFx + ((i / grid.cols) | 0) * grid.cellFx + (grid.cellFx >> 1);

/** En yakın açık hücre (BFS, deterministik komşu sırası). Bulunamazsa -1. */
export const nearestOpenCell = (grid: NavGrid, start: number, team: number, maxSteps = 4096): number => {
  if (start < 0) return -1;
  if (!blockedFor(grid, start, team)) return start;
  const seen = new Uint8Array(grid.cols * grid.rows);
  const queue = new Int32Array(Math.min(maxSteps * 8, grid.cols * grid.rows));
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = 1;
  while (head < tail && head < maxSteps) {
    const i = queue[head++] as number;
    if (!blockedFor(grid, i, team)) return i;
    const c = i % grid.cols;
    const r = (i / grid.cols) | 0;
    for (const [dc, dr] of NEIGHBORS4) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= grid.cols || nr >= grid.rows) continue;
      const j = nr * grid.cols + nc;
      if (seen[j] || tail >= queue.length) continue;
      seen[j] = 1;
      queue[tail++] = j;
    }
  }
  return -1;
};

const NEIGHBORS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
