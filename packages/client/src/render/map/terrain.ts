import { BufferAttribute, BufferGeometry } from 'three/webgpu';
import { type Swatch, swatchUV } from '../palette';

export type HeightFn = (x: number, z: number) => number;

export interface TerrainGrid {
  size: number;
  segments: number;
}

/** Üçgen başına renk seçimi: ortalama yükseklik, eğim (0 düz … 1 dikey) ve merkez. */
export type PaintFn = (avgY: number, slope: number, x: number, z: number) => Swatch;

/**
 * Prosedürel low-poly arazi (GDD §10 diorama formu). Haritadan bağımsızdır:
 * her harita kendi yükseklik fonksiyonunu ve boyama kuralını verir.
 * Kozmetik/render tarafıdır — sim ileride kendi integer yükseklik ızgarasını kullanır.
 */

const hash2 = (x: number, z: number, seed: number): number => {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export const smooth = (t: number) => t * t * (3 - 2 * t);
/** [edge0, edge1] aralığında 0→1 yumuşak geçiş. */
export const smoothstep = (edge0: number, edge1: number, x: number) =>
  smooth(Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0))));

export const valueNoise = (x: number, z: number, seed: number): number => {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const tx = smooth(x - xi);
  const tz = smooth(z - zi);
  const a = hash2(xi, zi, seed);
  const b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed);
  const d = hash2(xi + 1, zi + 1, seed);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
};

export const fbm = (x: number, z: number, seed: number): number => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < 4; o++) {
    sum += amp * valueNoise(x * freq, z * freq, seed + o * 17);
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum;
};

export const buildTerrainGeometry = (grid: TerrainGrid, heightAt: HeightFn, paintAt: PaintFn) => {
  const { size, segments } = grid;
  const step = size / segments;
  const half = size / 2;
  const triCount = segments * segments * 2;
  const pos = new Float32Array(triCount * 9);
  const uv = new Float32Array(triCount * 6);
  const col = new Float32Array(triCount * 9);
  let t = 0;

  // Köşe yüksekliklerini önceden hesapla.
  const n = segments + 1;
  const hy = new Float32Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) hy[j * n + i] = heightAt(-half + i * step, -half + j * step);

  type V3 = readonly [number, number, number];
  const pushTri = (a: V3, b: V3, c: V3) => {
    const [ax, ay, az] = a;
    const [bx, by, bz] = b;
    const [cx, cy, cz] = c;
    const avgY = (ay + by + cy) / 3;
    // Eğim: yüz normalinin yataylık oranı (u × v).
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const slope = 1 - Math.abs(ny) / Math.hypot(nx, ny, nz);
    const [u, v] = swatchUV(paintAt(avgY, slope, (ax + bx + cx) / 3, (az + bz + cz) / 3));
    // Hafif yükseklik bazlı ton (alçak yerler daha koyu → derinlik hissi).
    const shade = Math.min(1.05, Math.max(0.78, 0.9 + avgY * 0.008));
    for (const p of [a, b, c]) {
      pos.set(p, t * 3);
      uv.set([u, v], t * 2);
      col.set([shade, shade, shade], t * 3);
      t++;
    }
  };

  const vert = (i: number, j: number): V3 => [-half + i * step, hy[j * n + i] as number, -half + j * step];
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const p00 = vert(i, j);
      const p10 = vert(i + 1, j);
      const p01 = vert(i, j + 1);
      const p11 = vert(i + 1, j + 1);
      // Köşegen yönünü değiştirerek düzenli "ızgara" görüntüsünü kır.
      if ((i + j) % 2 === 0) {
        pushTri(p00, p01, p11);
        pushTri(p00, p11, p10);
      } else {
        pushTri(p00, p01, p10);
        pushTri(p10, p01, p11);
      }
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('uv', new BufferAttribute(uv, 2));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
};
