import { DataTexture, NearestFilter, RGBAFormat, SRGBColorSpace } from 'three/webgpu';

/**
 * Renk paleti atlası (GDD §3.1): 16×16 hücre, her hücre 1 texel (Nearest filtre).
 * Geometri UV'leri hücre merkezine "çivilenir"; doku yerine palet kullanılır.
 *
 * Satır düzeni:
 *   0–1  : arazi (çimen, toprak, kaya, kum, kar)
 *   2–3  : taş & mimari (Gondor beyazı, Rohan ahşabı, Isengard demiri)
 *   4–5  : bitki örtüsü
 *   6–9  : faction renkleri (GDD §3.3)
 *   10–11: efekt / emissive
 *   12–15: TAKIM RENKLERİ (4 takım). Shader, team index ile bu satırları kaydırır.
 */
export const PALETTE_SIZE = 16;

const SWATCHES = {
  // 0: arazi
  grass: [0, 0, '#6f8f4e'],
  grassDark: [1, 0, '#557440'],
  grassDry: [2, 0, '#8f9a5a'],
  dirt: [3, 0, '#7a6448'],
  dirtDark: [4, 0, '#5d4a35'],
  rock: [5, 0, '#8a8580'],
  rockDark: [6, 0, '#6b6661'],
  rockLight: [7, 0, '#a7a29b'],
  sand: [8, 0, '#c8b68c'],
  snow: [9, 0, '#e9edf0'],
  water: [10, 0, '#3f6f8f'],
  waterDeep: [11, 0, '#2b4f6b'],
  // 2: mimari
  gondorWhite: [0, 2, '#e8e4d8'],
  gondorStone: [1, 2, '#c9c3b5'],
  gondorRoof: [2, 2, '#5a6878'],
  helmStone: [3, 2, '#9b8f7d'],
  helmStoneDark: [4, 2, '#7a6f60'],
  wood: [5, 2, '#7a5534'],
  woodDark: [6, 2, '#5a3d25'],
  ironDark: [7, 2, '#2b2d30'],
  iron: [8, 2, '#4a4d52'],
  // 4: bitki
  leaf: [0, 4, '#4e7a3a'],
  leafDark: [1, 4, '#3b5e2c'],
  pine: [2, 4, '#2f5133'],
  bark: [3, 4, '#5b4331'],
  // 6–9: faction (GDD §3.3)
  steel: [0, 6, '#8c96a0'],
  gondorBlue: [1, 6, '#1e2a44'],
  silver: [2, 6, '#c8d0d8'],
  rohanGreen: [3, 6, '#4e6b3a'],
  leather: [4, 6, '#7a5534'],
  gold: [5, 6, '#c9a23a'],
  sootBlack: [0, 8, '#24211f'],
  rust: [1, 8, '#6b3a26'],
  urukSkin: [2, 8, '#4a3b32'],
  whiteHand: [3, 8, '#f2f2f2'],
  eyeRed: [4, 8, '#c2281e'],
  orcSkin: [5, 8, '#5f6b4a'],
  // 10: efekt
  fire: [0, 10, '#ff8a2a'],
  ember: [1, 10, '#ffcf5a'],
  magic: [2, 10, '#bfe6ff'],
  // 12–15: takım renkleri (her satır = bir takım; sütun 0 ana, 1 koyu, 2 vurgu)
  team0: [0, 12, '#2f5fa8'],
  team0Dark: [1, 12, '#1e3d6e'],
  team0Accent: [2, 12, '#d9e4f5'],
  team1: [0, 13, '#a83232'],
  team1Dark: [1, 13, '#6e1e1e'],
  team1Accent: [2, 13, '#f2d0c0'],
  team2: [0, 14, '#3a8f4a'],
  team2Dark: [1, 14, '#25602f'],
  team2Accent: [2, 14, '#d5f0d0'],
  team3: [0, 15, '#c9a23a'],
  team3Dark: [1, 15, '#8a6d22'],
  team3Accent: [2, 15, '#f7ecc8'],
} as const satisfies Record<string, readonly [number, number, string]>;

export type Swatch = keyof typeof SWATCHES;

/** Hücre merkezinin UV'si. Texture flipY=false; v satır yönünde artar. */
export const swatchUV = (name: Swatch): [number, number] => {
  const [col, row] = SWATCHES[name];
  return [(col + 0.5) / PALETTE_SIZE, (row + 0.5) / PALETTE_SIZE];
};

export const createPaletteTexture = (): DataTexture => {
  const data = new Uint8Array(PALETTE_SIZE * PALETTE_SIZE * 4);
  // Boş hücreler magenta: yanlış UV hemen göze çarpar.
  for (let i = 0; i < PALETTE_SIZE * PALETTE_SIZE; i++) data.set([255, 0, 255, 255], i * 4);
  for (const [col, row, hex] of Object.values(SWATCHES)) {
    const n = Number.parseInt(hex.slice(1), 16);
    data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], (row * PALETTE_SIZE + col) * 4);
  }
  const tex = new DataTexture(data, PALETTE_SIZE, PALETTE_SIZE, RGBAFormat);
  tex.colorSpace = SRGBColorSpace;
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
};
