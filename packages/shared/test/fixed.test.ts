import { describe, expect, it } from 'vitest';
import {
  ANGLE_HALF,
  ANGLE_QUARTER,
  angleDelta,
  FX_ONE,
  fxAtan2,
  fxCos,
  fxDiv,
  fxFromFloat,
  fxFromInt,
  fxLen,
  fxMul,
  fxSin,
  fxSqrt,
  fxToFloat,
  isqrt,
} from '../src/math/fixed';

const near = (fx: number, f: number, eps = 1e-3) => expect(Math.abs(fxToFloat(fx) - f)).toBeLessThan(eps);

describe('Q16.16 aritmetik', () => {
  it('çarpma işaretli değerlerde floor semantiği ile doğru', () => {
    near(fxMul(fxFromFloat(2.5), fxFromFloat(4)), 10);
    near(fxMul(fxFromFloat(-2.5), fxFromFloat(4)), -10);
    near(fxMul(fxFromFloat(-1.25), fxFromFloat(-3.5)), 4.375);
    near(fxMul(fxFromFloat(300.75), fxFromFloat(-100.5)), -30225.375, 1e-2);
    // Referans: tam 64-bit çarpım BigInt ile.
    for (const [a, b] of [
      [123456789, -98765],
      [-2147483, 2147483],
      [65536 * 181, 65536 * 181],
    ] as const) {
      const ref = Number((BigInt(a) * BigInt(b)) >> 16n) | 0;
      expect(fxMul(a, b)).toBe(ref);
    }
  });

  it('bölme', () => {
    near(fxDiv(fxFromInt(10), fxFromInt(4)), 2.5);
    near(fxDiv(fxFromInt(-7), fxFromInt(2)), -3.5);
  });

  it('karekök kesin floor', () => {
    for (let n = 0; n < 5000; n++) {
      const r = isqrt(n);
      expect(r * r <= n && (r + 1) * (r + 1) > n).toBe(true);
    }
    near(fxSqrt(fxFromInt(2)), Math.SQRT2);
    near(fxSqrt(fxFromInt(10000)), 100);
    near(fxLen(fxFromInt(3), fxFromInt(4)), 5);
    near(fxLen(fxFromInt(3000), fxFromInt(-4000)), 5000, 1e-2);
  });
});

describe('açılar ve trigonometri', () => {
  it('sin/cos LUT hata < 0.002', () => {
    for (let a = 0; a < 65536; a += 97) {
      const rad = (a / 65536) * Math.PI * 2;
      near(fxSin(a), Math.sin(rad), 2e-3);
      near(fxCos(a), Math.cos(rad), 2e-3);
    }
    expect(fxSin(0)).toBe(0);
    expect(fxSin(ANGLE_QUARTER)).toBe(FX_ONE);
    expect(fxSin(ANGLE_HALF)).toBe(0);
    expect(fxCos(ANGLE_HALF)).toBe(-FX_ONE);
  });

  it('atan2 CORDIC tüm kadranlarda doğru', () => {
    for (let deg = -179; deg <= 180; deg += 7) {
      const rad = (deg * Math.PI) / 180;
      const y = fxFromFloat(Math.sin(rad) * 37);
      const x = fxFromFloat(Math.cos(rad) * 37);
      const expected = (((deg + 360) % 360) / 360) * 65536;
      expect(Math.abs(angleDelta(expected & 0xffff, fxAtan2(y, x)))).toBeLessThanOrEqual(3);
    }
    expect(fxAtan2(0, 0)).toBe(0);
  });

  it('angleDelta en kısa yolu verir', () => {
    expect(angleDelta(65000, 500)).toBe(1036);
    expect(angleDelta(500, 65000)).toBe(-1036);
  });
});
