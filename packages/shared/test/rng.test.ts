import { describe, expect, it } from 'vitest';
import { Rng } from '../src/rng/xoshiro';

describe('Rng (xoshiro128**)', () => {
  it('aynı seed → aynı dizi; farklı stream → farklı dizi', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const c = new Rng(42, 1);
    const sa = Array.from({ length: 100 }, () => a.nextU32());
    const sb = Array.from({ length: 100 }, () => b.nextU32());
    const sc = Array.from({ length: 100 }, () => c.nextU32());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });

  it('bilinen ilk değerler sabit kalır (platformlar arası regresyon kilidi)', () => {
    const r = new Rng(12345);
    const first = [r.nextU32(), r.nextU32(), r.nextU32()];
    expect(first).toMatchInlineSnapshot(`
      [
        2407269127,
        3079606827,
        3141342157,
      ]
    `);
  });

  it('nextInt aralık içinde ve kabaca uniform', () => {
    const r = new Rng(7);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) {
      const v = r.nextInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      buckets[v]++;
    }
    for (const n of buckets) expect(Math.abs(n - 10_000)).toBeLessThan(500);
  });

  it('durum kaydet / geri yükle', () => {
    const r = new Rng(99);
    r.nextU32();
    const s = r.getState();
    const x = r.nextU32();
    r.setState(s);
    expect(r.nextU32()).toBe(x);
  });
});
