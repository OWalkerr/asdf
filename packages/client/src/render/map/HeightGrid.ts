import type { HeightFn, TerrainGrid } from './terrain';

/**
 * Arazi mesh'inin tam yüzey yüksekliği (GDD §13.3: render, y'yi heightmap'ten örnekler).
 * Köşe yükseklikleri bir kez hesaplanır; örnekleme, arazi oluşturucusunun kullandığı
 * aynı köşegen düzenine göre üçgen içi ara değerdir — birimler yüzeye tam oturur
 * ve kare başına binlerce gürültü hesabı yapılmaz.
 */
export class HeightGrid {
  private readonly heights: Float32Array;
  private readonly n: number;
  private readonly step: number;
  private readonly half: number;

  constructor(
    readonly grid: TerrainGrid,
    heightAt: HeightFn,
  ) {
    this.n = grid.segments + 1;
    this.step = grid.size / grid.segments;
    this.half = grid.size / 2;
    this.heights = new Float32Array(this.n * this.n);
    for (let j = 0; j < this.n; j++)
      for (let i = 0; i < this.n; i++)
        this.heights[j * this.n + i] = heightAt(-this.half + i * this.step, -this.half + j * this.step);
  }

  sample = (x: number, z: number): number => {
    const segs = this.grid.segments;
    const gx = Math.min(segs - 1e-6, Math.max(0, (x + this.half) / this.step));
    const gz = Math.min(segs - 1e-6, Math.max(0, (z + this.half) / this.step));
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    const u = gx - i;
    const v = gz - j;
    const n = this.n;
    const h = this.heights;
    const h00 = h[j * n + i] as number;
    const h10 = h[j * n + i + 1] as number;
    const h01 = h[(j + 1) * n + i] as number;
    const h11 = h[(j + 1) * n + i + 1] as number;
    if ((i + j) % 2 === 0) {
      // Köşegen p00–p11: (p00, p01, p11) ve (p00, p11, p10)
      return v > u ? h00 + (h11 - h01) * u + (h01 - h00) * v : h00 + (h10 - h00) * u + (h11 - h10) * v;
    }
    // Köşegen p10–p01: (p00, p01, p10) ve (p10, p01, p11)
    return u + v < 1
      ? h00 + (h10 - h00) * u + (h01 - h00) * v
      : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  };
}
