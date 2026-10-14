/**
 * Q16.16 sabit noktalı matematik (GDD §13.7).
 *
 * Simülasyonun tüm durumu bu formatta tutulur; böylece farklı tarayıcı/CPU'larda
 * bit-bit aynı sonuç üretilir (deterministik lockstep için zorunlu).
 *
 * Kurallar:
 * - Değerler int32 aralığındadır (±32768.0). Harita 512 m olduğundan güvenli.
 * - Yalnızca +, -, *, / ve tamsayı işlemleri kullanılır. Ara sonuçlar 2^53'ün altında
 *   tutulur, böylece IEEE-754 double işlemleri tam (exact) ve deterministiktir.
 * - `Math.sin`, `Math.atan2` gibi "implementation-approximated" fonksiyonlar KULLANILMAZ.
 */

export type Fx = number;

export const FX_SHIFT = 16;
export const FX_ONE: Fx = 1 << FX_SHIFT;
export const FX_HALF: Fx = FX_ONE >> 1;
const TWO_POW_16 = 65536;

/** Tamsayıdan Fx'e. */
export const fxFromInt = (n: number): Fx => (n << FX_SHIFT) | 0;

/**
 * Float'tan Fx'e. Sadece veri tanımı / yükleme anında (ör. JSON birim tabloları) kullanılmalı;
 * sim döngüsü içinde float üretilmez.
 */
export const fxFromFloat = (f: number): Fx => Math.round(f * FX_ONE) | 0;

/** Fx'ten float'a — yalnızca render/UI tarafı için. */
export const fxToFloat = (a: Fx): number => a / FX_ONE;

/** Sıfıra doğru değil, -∞'a doğru yuvarlanan tamsayı kısmı. */
export const fxFloor = (a: Fx): number => a >> FX_SHIFT;

/**
 * Çarpma: (a * b) >> 16, 64-bit ara sonuç olmadan.
 * b = hi * 2^16 + lo  (hi aritmetik kaydırma, lo ∈ [0, 65535])
 * a*b / 2^16 = a*hi + a*lo / 2^16 → her iki çarpım da < 2^47, double'da tam.
 */
export const fxMul = (a: Fx, b: Fx): Fx => {
  const hi = b >> FX_SHIFT;
  const lo = b & 0xffff;
  return (a * hi + Math.floor((a * lo) / TWO_POW_16)) | 0;
};

/** Bölme: (a << 16) / b, sıfıra doğru kesilir. b = 0 ise ±max döner. */
export const fxDiv = (a: Fx, b: Fx): Fx => {
  if (b === 0) return a >= 0 ? 0x7fffffff : -0x7fffffff;
  return Math.trunc((a * TWO_POW_16) / b) | 0;
};

/** Negatif olmayan tamsayının tam karekökü (floor). n < 2^53 olmalı. */
export const isqrt = (n: number): number => {
  if (n <= 0) return 0;
  // Math.sqrt yalnızca başlangıç tahmini; aşağıdaki düzeltme sonucu kesin floor(√n) yapar.
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
};

/** Fx karekök: √(a / 2^16) * 2^16 = √(a * 2^16). */
export const fxSqrt = (a: Fx): Fx => (a <= 0 ? 0 : isqrt(a * TWO_POW_16));

export const fxAbs = (a: Fx): Fx => (a < 0 ? -a | 0 : a);
export const fxMin = (a: Fx, b: Fx): Fx => (a < b ? a : b);
export const fxMax = (a: Fx, b: Fx): Fx => (a > b ? a : b);
export const fxClamp = (a: Fx, lo: Fx, hi: Fx): Fx => (a < lo ? lo : a > hi ? hi : a);

/** Doğrusal ara değer, t ∈ [0, FX_ONE]. */
export const fxLerp = (a: Fx, b: Fx, t: Fx): Fx => (a + fxMul(b - a, t)) | 0;

// ---------------------------------------------------------------------------
// Açılar: uint16 "binary angle" — 0..65535 = 0..2π. Taşma doğal olarak sarar.
// Yön: açı 0 = +X, açı 16384 (π/2) = +Z.
// ---------------------------------------------------------------------------

export type Angle = number;
export const ANGLE_FULL = 65536;
export const ANGLE_HALF = 32768;
export const ANGLE_QUARTER = 16384;

export const angleWrap = (a: number): Angle => a & 0xffff;

/** İki açı arasındaki işaretli en kısa fark, [-32768, 32767]. */
export const angleDelta = (from: Angle, to: Angle): number => (((to - from) << 16) >> 16) | 0;

const SIN_BITS = 12;
const SIN_SIZE = 1 << SIN_BITS; // 4096 giriş
const SIN_SHIFT = 16 - SIN_BITS;

/**
 * Sinüs tablosu yalnızca IEEE temel işlemleri (+ - * /) ile Taylor serisinden üretilir;
 * Math.sin kullanılmaz, bu yüzden her motorda aynı tablo çıkar.
 */
const SIN_LUT: Int32Array = (() => {
  const quarter = SIN_SIZE / 4;
  // Math.PI spec'te sabit bir double'dır (fonksiyon değil) — tüm motorlarda aynı bit deseni.
  const PI = Math.PI;
  const q = new Int32Array(quarter + 1);
  for (let i = 0; i <= quarter; i++) {
    const x = (i / quarter) * (PI / 2);
    const x2 = x * x;
    // sin x = x - x³/3! + x⁵/5! - ... (x ≤ π/2 için 10 terim double hassasiyetine yeter)
    let term = x;
    let sum = x;
    for (let k = 1; k < 10; k++) {
      term = (-term * x2) / (2 * k * (2 * k + 1));
      sum += term;
    }
    q[i] = Math.round(sum * FX_ONE);
  }
  // Çeyrek dalgadan tam dalgaya: sin(π - x) = sin x, sin(π + x) = -sin x.
  const lut = new Int32Array(SIN_SIZE);
  const half = quarter * 2;
  for (let i = 0; i < SIN_SIZE; i++) {
    const h = i % half;
    const v = (h <= quarter ? q[h] : q[half - h]) as number;
    lut[i] = i < half ? v : -v;
  }
  return lut;
})();

export const fxSin = (a: Angle): Fx => SIN_LUT[(a & 0xffff) >> SIN_SHIFT] as number;
export const fxCos = (a: Angle): Fx => SIN_LUT[((a + ANGLE_QUARTER) & 0xffff) >> SIN_SHIFT] as number;

/** atan(2^-i), 24-bit açı biriminde (ANGLE_FULL * 256). Python ile önceden hesaplandı. */
const CORDIC_ATAN = [
  2097152, 1238021, 654136, 332050, 166669, 83416, 41718, 20860, 10430, 5215, 2608, 1304, 652, 326, 163, 81,
  41, 20, 10, 5, 3, 1, 1,
];

/**
 * Tamsayı CORDIC (vectoring mode) ile atan2. Dönüş: uint16 açı.
 * Girdiler herhangi bir ölçekte olabilir (Fx veya ham int); yalnızca oran önemli.
 */
export const fxAtan2 = (y: number, x: number): Angle => {
  if (x === 0 && y === 0) return 0;
  // Sağ yarı düzleme indir.
  let base = 0;
  if (x < 0) {
    base = ANGLE_HALF * 256;
    x = -x;
    y = -y;
  }
  // Büyüklüğü [2^20, 2^28) aralığına ölçekle (taşma ve hassasiyet için).
  while (Math.abs(x) >= 1 << 28 || Math.abs(y) >= 1 << 28) {
    x = Math.trunc(x / 2);
    y = Math.trunc(y / 2);
  }
  while (Math.abs(x) < 1 << 20 && Math.abs(y) < 1 << 20) {
    x *= 2;
    y *= 2;
  }
  let z = 0;
  for (let i = 0; i < CORDIC_ATAN.length; i++) {
    const dx = Math.trunc(x / 2 ** i);
    const dy = Math.trunc(y / 2 ** i);
    const step = CORDIC_ATAN[i] as number;
    if (y > 0) {
      x += dy;
      y -= dx;
      z += step;
    } else {
      x -= dy;
      y += dx;
      z -= step;
    }
  }
  return angleWrap(Math.round((base + z) / 256));
};

// ---------------------------------------------------------------------------
// 2B vektör yardımcıları (XZ düzlemi). Allocation yapmamak için skaler fonksiyonlar.
// ---------------------------------------------------------------------------

/** Kare uzunluk, Fx olarak (taşmayı önlemek için fxMul ile). */
export const fxLenSq = (x: Fx, z: Fx): Fx => (fxMul(x, x) + fxMul(z, z)) | 0;

export const fxLen = (x: Fx, z: Fx): Fx => {
  // √(x² + z²) — ham int kareler 2^53'ü aşabilir, bu yüzden önce büyüklüğe göre ölçekle.
  const ax = fxAbs(x);
  const az = fxAbs(z);
  if (ax === 0) return az;
  if (az === 0) return ax;
  // ax, az < 2^31 → ax² + az² < 2^63; 2^53 altında kalması için gerekirse 2^5 ile böl.
  if (ax < 1 << 26 && az < 1 << 26) return isqrt(ax * ax + az * az);
  const sx = ax / 32;
  const sz = az / 32;
  return (isqrt(Math.floor(sx * sx + sz * sz)) * 32) | 0;
};
