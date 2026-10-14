import { describe, expect, it } from 'vitest';
import { HeightGrid } from '../src/render/map/HeightGrid';

describe('HeightGrid', () => {
  const f = (x: number, z: number) => Math.sin(x * 0.3) * 4 + Math.cos(z * 0.2) * 3;
  const grid = new HeightGrid({ size: 40, segments: 10 }, f);

  it('köşelerde kaynak fonksiyonla aynı', () => {
    for (let i = 0; i <= 10; i++)
      for (let j = 0; j <= 10; j++)
        expect(grid.sample(-20 + i * 4, -20 + j * 4)).toBeCloseTo(f(-20 + i * 4, -20 + j * 4), 4);
  });

  it('düzlemsel fonksiyonu tam üretir (üçgen ara değeri)', () => {
    const plane = new HeightGrid({ size: 40, segments: 10 }, (x, z) => 2 * x - 0.5 * z + 3);
    for (const [x, z] of [
      [1.3, 2.7],
      [-7.9, 13.1],
      [19.5, -19.5],
      [0, 0],
    ] as const)
      expect(plane.sample(x, z)).toBeCloseTo(2 * x - 0.5 * z + 3, 4);
  });

  it('harita dışında kenara kenetlenir', () => {
    expect(grid.sample(-100, 0)).toBeCloseTo(grid.sample(-20, 0), 3);
  });
});
