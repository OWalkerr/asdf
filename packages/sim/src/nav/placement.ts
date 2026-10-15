import { FREE_BUILD, type MapDef, type Vec2 } from '@bulwark/shared';
import { cellAt, type NavGrid } from './grid';

/**
 * Serbest inşa yerleşim kuralı (BFME2 işçi inşası). Sim (komut doğrulama) ve istemci (hayalet
 * önizleme) aynı fonksiyonu kullanır. Konumlar metre (float); yalnızca karşılaştırma ve çarpma
 * kullanılır, sonuç her motorda aynıdır.
 * - Taban harita içinde. Kale Savunması: tamamen açık zeminde (nav: hiçbir takıma kapalı değil).
 *   Kule Savunması (Tower Wars): yolun dışındaki arazide (düşmana kapalı hücreler) — yol açık kalır.
 * - Düşman koridorlarından `lanePad`, doğuş noktalarından `spawnPad`, kapılardan `gatePad` uzakta
 *   (yol hiçbir zaman kapanmaz).
 * - Kaleye ve diğer yapılara çakışmaz.
 */
export interface Footprint {
  x: number;
  z: number;
  r: number;
}

const segDistSq = (x: number, z: number, a: Vec2, b: Vec2): number => {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((x - a[0]) * abx + (z - a[1]) * abz) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x - (a[0] + abx * t);
  const dz = z - (a[1] + abz * t);
  return dx * dx + dz * dz;
};

/** Yerleşim neden geçersiz (null = geçerli). İstemci ipucunda gösterir. */
export const placementError = (
  map: MapDef,
  grid: NavGrid,
  x: number,
  z: number,
  r: number,
  others: Iterable<Footprint>,
): string | null => {
  const half = map.size / 2 - 6;
  if (x - r < -half || x + r > half || z - r < -half || z + r > half) return 'Harita kenarı';
  const sq = (v: number) => v * v;
  for (const lane of map.lanes)
    for (let i = 1; i < lane.points.length; i++)
      if (segDistSq(x, z, lane.points[i - 1] as Vec2, lane.points[i] as Vec2) < sq(r + FREE_BUILD.lanePad))
        return 'Düşman yolunu kapatır';
  for (const s of map.spawns)
    if (sq(x - s.pos[0]) + sq(z - s.pos[1]) < sq(r + FREE_BUILD.spawnPad)) return 'Düşman bölgesi';
  for (const g of map.gates)
    if (sq(x - g.pos[0]) + sq(z - g.pos[1]) < sq(r + FREE_BUILD.gatePad + g.width / 2))
      return 'Kapıya çok yakın';
  const c = map.citadel;
  if (sq(x - c.pos[0]) + sq(z - c.pos[1]) < sq(r + c.radius + 4)) return 'Kaleye çok yakın';
  for (const o of others)
    if (sq(x - o.x) + sq(z - o.z) < sq(r + o.r + FREE_BUILD.structPad)) return 'Başka yapıya çok yakın';
  // Taban hücreleri: kare tarama (FD: hepsi açık; TD: hepsi yol dışı).
  const td = map.mode === 'TD';
  const step = grid.cellSize;
  for (let dz = -r; dz <= r; dz += step)
    for (let dx = -r; dx <= r; dx += step) {
      if (dx * dx + dz * dz > r * r) continue;
      const i = cellAt(grid, Math.round((x + dx) * 65536), Math.round((z + dz) * 65536));
      if (i < 0) return 'Harita kenarı';
      const b = grid.blocked[i] as number;
      if (td ? (b & 2) === 0 : b !== 0) return td ? 'Düşman yolunu kapatır' : 'Engebeli / kapalı zemin';
    }
  return null;
};

/** Yapı tabanının kapattığı nav hücreleri (yarıçapın biraz içi: birlikler kenardan sürtünerek geçebilsin). */
export const footprintCells = (grid: NavGrid, x: number, z: number, r: number): number[] => {
  const out: number[] = [];
  const rr = Math.max(grid.cellSize * 0.75, r - 0.6);
  const step = grid.cellSize / 2;
  for (let dz = -rr; dz <= rr; dz += step)
    for (let dx = -rr; dx <= rr; dx += step) {
      if (dx * dx + dz * dz > rr * rr) continue;
      const i = cellAt(grid, Math.round((x + dx) * 65536), Math.round((z + dz) * 65536));
      if (i >= 0 && !out.includes(i)) out.push(i);
    }
  return out.sort((a, b) => a - b);
};
