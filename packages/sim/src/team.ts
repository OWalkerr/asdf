import type { SimWorld } from './world';

/**
 * Aynı ittifakta mı (BFME2 lobisindeki "Takım"): aynı takım ya da aynı ittifak numarası.
 * Savunma modunda oyuncu takımı 0, dalgalar takım 1; çatışmada her oyuncu kendi takımıdır.
 */
export const allied = (world: SimWorld, a: number, b: number): boolean =>
  a === b || world.match.alliance[a] === world.match.alliance[b];
