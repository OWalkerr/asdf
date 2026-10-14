/**
 * xoshiro128** — 32-bit, hızlı, deterministik PRNG (GDD §13.7).
 * Maç seed'i sunucudan gelir; her sistem kendi akışını (stream) kullanır ki
 * bir sisteme eklenen rastgele çağrı diğerlerinin dizisini kaydırmasın.
 */
export class Rng {
  private s0 = 0;
  private s1 = 0;
  private s2 = 0;
  private s3 = 0;

  constructor(seed: number, stream = 0) {
    this.reseed(seed, stream);
  }

  /** splitmix32 ile 128-bit durumu doldurur (sıfır durumdan kaçınır). */
  reseed(seed: number, stream = 0): void {
    let x = (seed ^ Math.imul(stream + 1, 0x9e3779b9)) >>> 0;
    const next = (): number => {
      x = (x + 0x9e3779b9) | 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.s0 = next();
    this.s1 = next();
    this.s2 = next();
    this.s3 = next();
  }

  /** [0, 2^32) aralığında uint32. */
  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0;
    const t = this.s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  /** [0, max) aralığında tamsayı. max ≤ 2^21 (çarpım 2^53 altında kalmalı). */
  nextInt(max: number): number {
    return Math.floor((this.nextU32() * max) / 4294967296);
  }

  /** [min, max] (dahil) aralığında tamsayı. */
  range(min: number, max: number): number {
    return min + this.nextInt(max - min + 1);
  }

  /** [0, 1) aralığında Fx (Q16.16). */
  nextFx(): number {
    return this.nextU32() >>> 16;
  }

  /** Durumu kaydet/geri yükle (save, replay, resync için). */
  getState(): [number, number, number, number] {
    return [this.s0, this.s1, this.s2, this.s3];
  }

  setState(s: readonly [number, number, number, number]): void {
    [this.s0, this.s1, this.s2, this.s3] = s;
  }
}

const rotl = (x: number, k: number): number => (x << k) | (x >>> (32 - k));
