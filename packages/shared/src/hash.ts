/**
 * FNV-1a (32-bit) tabanlı durum hash'i — lockstep desync tespiti için (GDD §13.6).
 * Kriptografik değildir; amaç istemciler arasında hızlı eşitlik kontrolüdür.
 */
export const HASH_SEED = 0x811c9dc5;

export const hashInt = (h: number, v: number): number => {
  let x = h;
  x = Math.imul(x ^ (v & 0xff), 0x01000193);
  x = Math.imul(x ^ ((v >>> 8) & 0xff), 0x01000193);
  x = Math.imul(x ^ ((v >>> 16) & 0xff), 0x01000193);
  x = Math.imul(x ^ ((v >>> 24) & 0xff), 0x01000193);
  return x >>> 0;
};

export const hashArray = (h: number, arr: ArrayLike<number>, count = arr.length): number => {
  let x = h;
  for (let i = 0; i < count; i++) x = hashInt(x, arr[i] as number);
  return x;
};
