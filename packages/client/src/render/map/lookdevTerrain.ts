import { fbm, type HeightFn, type PaintFn, smooth, valueNoise } from './terrain';

/** Look-dev dioramasına özgü arazi şekli ve boyama kuralı. */
export interface TerrainSpec {
  size: number;
  segments: number;
  seed: number;
  /** Merkez platosu (kale alanı) yarıçapı ve yüksekliği. */
  plateauRadius: number;
  plateauHeight: number;
  /** Güneyden plato kapısına çıkan yol genişliği. */
  roadWidth: number;
}

export const DEFAULT_TERRAIN: TerrainSpec = {
  size: 260,
  segments: 65,
  seed: 7,
  plateauRadius: 34,
  plateauHeight: 4,
  roadWidth: 9,
};

/** Analitik yükseklik fonksiyonu (kamera ve dekor yerleşimi bunu örnekler). */
export const createLookdevHeightField = (spec: TerrainSpec): HeightFn => {
  const half = spec.size / 2;
  return (x: number, z: number): number => {
    const n = fbm(x / 38, z / 38, spec.seed);
    let h = (n - 0.45) * 22;
    // Kenarlara doğru yükselen kayalık "diorama" çerçevesi.
    const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
    h += smooth(Math.min(1, Math.max(0, (edge - 0.72) / 0.28))) * 26;
    // Merkezde düz plato (kale), yumuşak şev.
    const r = Math.hypot(x, z + 10);
    const plateau = 1 - smooth(Math.min(1, Math.max(0, (r - spec.plateauRadius) / 18)));
    h = h * (1 - plateau) + spec.plateauHeight * plateau;
    // Güneyden kapıya çıkan rampa yolu.
    const road = 1 - smooth(Math.min(1, Math.abs(x) / spec.roadWidth));
    if (z > 0) h = h * (1 - road * 0.85) + (spec.plateauHeight - z * 0.05) * road * 0.85;
    return h;
  };
};

/** Üçgen başına renk: eğim (kaya) ve yüksekliğe (çimen tonları / toprak / kar) göre. */
export const createLookdevPaint =
  (spec: TerrainSpec): PaintFn =>
  (avgY, slope, x, z) => {
    if (slope > 0.62) return avgY > 18 ? 'rockLight' : 'rock';
    if (slope > 0.42) return 'rockDark';
    if (avgY > 24) return 'snow';
    if (z > 0 && Math.abs(x) < spec.roadWidth * 0.55) return 'dirt';
    const n = valueNoise(x / 14, z / 14, spec.seed + 99);
    if (avgY < -4) return n > 0.5 ? 'grassDark' : 'dirtDark';
    return n > 0.62 ? 'grassDry' : n < 0.3 ? 'grassDark' : 'grass';
  };
