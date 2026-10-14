import type { Fx } from '@bulwark/shared';
import { blockedFor, cellAt, type NavGrid, nearestOpenCell } from './grid';

/**
 * Akış alanı (flow field, GDD §2.4): hedef hücre kümesinden tüm ızgaraya tamsayı Dijkstra.
 * Tüm dalga tek alanı paylaşır → binlerce birim için A* × N yerine tek hesap.
 * Deterministik: maliyetler tamsayı (düz 10, çapraz 14), yığın eşitlikte hücre indeksine bakar,
 * komşular sabit sırada gezilir.
 */
export const COST_INF = 0x7fffffff;

/** 8 komşu: (dc, dr, maliyet). Çaprazlar köşe kesmez (iki ortogonal komşu da açık olmalı). */
const DIRS: readonly (readonly [number, number, number])[] = [
  [1, 0, 10],
  [-1, 0, 10],
  [0, 1, 10],
  [0, -1, 10],
  [1, 1, 14],
  [-1, 1, 14],
  [1, -1, 14],
  [-1, -1, 14],
];

export interface FlowField {
  /** Önbellek anahtarı (hedef hücre). */
  goal: number;
  /** Hedefe tamsayı maliyet; ulaşılamaz = COST_INF. */
  cost: Int32Array;
  /** Hedefe doğru bir sonraki hücre; hedefteyse kendisi, ulaşılamazsa -1. */
  next: Int32Array;
}

/** (maliyet, indeks) min-yığını — Int32Array tabanlı, allocation yok. */
class MinHeap {
  private cost: Int32Array;
  private idx: Int32Array;
  size = 0;
  constructor(capacity: number) {
    this.cost = new Int32Array(capacity);
    this.idx = new Int32Array(capacity);
  }
  private less(a: number, b: number): boolean {
    const ca = this.cost[a] as number;
    const cb = this.cost[b] as number;
    return ca < cb || (ca === cb && (this.idx[a] as number) < (this.idx[b] as number));
  }
  private swap(a: number, b: number): void {
    const c = this.cost[a] as number;
    const i = this.idx[a] as number;
    this.cost[a] = this.cost[b] as number;
    this.idx[a] = this.idx[b] as number;
    this.cost[b] = c;
    this.idx[b] = i;
  }
  push(cost: number, idx: number): void {
    if (this.size >= this.cost.length) {
      const grow = (arr: Int32Array) => {
        const n = new Int32Array(arr.length * 2);
        n.set(arr);
        return n;
      };
      this.cost = grow(this.cost);
      this.idx = grow(this.idx);
    }
    let i = this.size++;
    this.cost[i] = cost;
    this.idx[i] = idx;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }
  /** En küçüğü çıkarır; [cost, idx] değerlerini out'a yazar. */
  pop(out: Int32Array): void {
    out[0] = this.cost[0] as number;
    out[1] = this.idx[0] as number;
    this.size--;
    if (this.size === 0) return;
    this.cost[0] = this.cost[this.size] as number;
    this.idx[0] = this.idx[this.size] as number;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < this.size && this.less(l, m)) m = l;
      if (r < this.size && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
  }
}

const canStep = (grid: NavGrid, team: number, c: number, r: number, dc: number, dr: number): boolean => {
  const nc = c + dc;
  const nr = r + dr;
  if (nc < 0 || nr < 0 || nc >= grid.cols || nr >= grid.rows) return false;
  const cols = grid.cols;
  if (blockedFor(grid, nr * cols + nc, team)) return false;
  if (dc !== 0 && dr !== 0) {
    // Köşe kesme yok: çapraz adımda iki ortogonal komşu da açık olmalı.
    if (blockedFor(grid, r * cols + nc, team) || blockedFor(grid, nr * cols + c, team)) return false;
  }
  return true;
};

/** Hedef hücreler kümesinden akış alanı hesaplar. */
export const computeFlowField = (
  grid: NavGrid,
  goals: readonly number[],
  team: number,
  key = goals[0] ?? -1,
): FlowField => {
  const n = grid.cols * grid.rows;
  const cost = new Int32Array(n).fill(COST_INF);
  const next = new Int32Array(n).fill(-1);
  const heap = new MinHeap(1024);
  const top = new Int32Array(2);
  for (const g of goals) {
    if (g < 0 || blockedFor(grid, g, team) || cost[g] === 0) continue;
    cost[g] = 0;
    next[g] = g;
    heap.push(0, g);
  }
  const cols = grid.cols;
  while (heap.size > 0) {
    heap.pop(top);
    const cc = top[0] as number;
    const i = top[1] as number;
    if (cc > (cost[i] as number)) continue;
    const c = i % cols;
    const r = (i / cols) | 0;
    for (const [dc, dr, w] of DIRS) {
      // Ters yön: komşudan bu hücreye adım geçerli mi (simetrik ızgarada aynı koşul).
      if (!canStep(grid, team, c, r, dc, dr)) continue;
      const j = (r + dr) * cols + (c + dc);
      const nc = cc + w;
      if (nc < (cost[j] as number)) {
        cost[j] = nc;
        heap.push(nc, j);
      }
    }
  }
  // Her hücre için en düşük maliyetli geçerli komşu (sabit yön sırası → deterministik).
  for (let i = 0; i < n; i++) {
    const ci = cost[i] as number;
    if (ci === COST_INF || ci === 0) continue;
    const c = i % cols;
    const r = (i / cols) | 0;
    let best = -1;
    let bestCost = ci;
    for (const [dc, dr] of DIRS) {
      if (!canStep(grid, team, c, r, dc, dr)) continue;
      const j = (r + dr) * cols + (c + dc);
      const cj = cost[j] as number;
      if (cj < bestCost) {
        bestCost = cj;
        best = j;
      }
    }
    next[i] = best;
  }
  return { goal: key, cost, next };
};

/** Hedef noktası etrafında (yarıçap hücre) açık hücreler; hiçbiri yoksa en yakın açık hücre. */
export const goalCellsAround = (grid: NavGrid, x: Fx, z: Fx, team: number, radiusCells = 1): number[] => {
  const center = cellAt(grid, x, z);
  if (center < 0) return [];
  const c0 = center % grid.cols;
  const r0 = (center / grid.cols) | 0;
  const out: number[] = [];
  for (let dr = -radiusCells; dr <= radiusCells; dr++)
    for (let dc = -radiusCells; dc <= radiusCells; dc++) {
      const c = c0 + dc;
      const r = r0 + dr;
      if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
      const i = r * grid.cols + c;
      if (!blockedFor(grid, i, team)) out.push(i);
    }
  if (out.length === 0) {
    const near = nearestOpenCell(grid, center, team);
    if (near >= 0) out.push(near);
  }
  return out;
};

/**
 * Hedef hücresine göre akış alanı önbelleği. Ekleme sırasıyla tahliye (Map ekleme sırası
 * spec gereği deterministik). Aynı hedefe giden tüm taburlar tek alanı paylaşır.
 */
export class FlowFieldCache {
  private readonly fields = new Map<number, FlowField>();
  computed = 0;
  constructor(
    readonly grid: NavGrid,
    readonly capacity = 24,
  ) {}

  /**
   * Takımın hedef noktaya alanı; hedef ızgara dışında veya tamamen kapalıysa null.
   * Anahtar = takım × hücre sayısı + hedefin merkez hücresi.
   */
  get(x: Fx, z: Fx, team: number): FlowField | null {
    const cell = cellAt(this.grid, x, z);
    if (cell < 0) return null;
    const key = team * this.grid.cols * this.grid.rows + cell;
    const hit = this.fields.get(key);
    if (hit) return hit;
    const goals = goalCellsAround(this.grid, x, z, team);
    if (goals.length === 0) return null;
    const field = computeFlowField(this.grid, goals, team, key);
    this.computed++;
    if (this.fields.size >= this.capacity) {
      const oldest = this.fields.keys().next().value as number;
      this.fields.delete(oldest);
    }
    this.fields.set(key, field);
    return field;
  }

  byKey(key: number): FlowField | undefined {
    return this.fields.get(key);
  }

  /** Nav ızgarası değiştiğinde (yıkılan kapı vb.) tüm alanları geçersiz kıl. */
  clear(): void {
    this.fields.clear();
  }
}
