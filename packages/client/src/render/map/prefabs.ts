import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  OctahedronGeometry,
} from 'three/webgpu';
import { jitter, merge, paint, place, verticalShade } from '../geometry/lowpoly';

/**
 * Placeholder low-poly prefab'lar (Phase 1). Kodla üretilir; Phase 2'de Blender
 * asset'leri aynı attribute sözleşmesiyle (lowpoly.ts) bunların yerini alacak.
 * Ölçek: 1 birim = 1 m.
 */

export type Rand = () => number;

/** Çam: 3 kat konik taç + gövde (Fangorn / Helm's Deep vadisi). */
export const pineTree = (rand: Rand): BufferGeometry => {
  const parts = [paint(place(new CylinderGeometry(0.25, 0.35, 2.2, 5), 0, 1.1, 0), 'bark')];
  let y = 1.8;
  let r = 2.1;
  for (let i = 0; i < 3; i++) {
    const cone = jitter(new ConeGeometry(r, 2.6, 6, 1), 0.25, rand);
    parts.push(paint(place(cone, 0, y + 1.1, 0, rand() * Math.PI), i === 2 ? 'leaf' : 'pine'));
    y += 1.5;
    r *= 0.72;
  }
  return verticalShade(merge(parts), 0.75, 1.05);
};

/** Yapraklı ağaç: ikosahedron taç. */
export const broadleafTree = (rand: Rand): BufferGeometry => {
  const crown = jitter(new IcosahedronGeometry(2.0, 0), 0.6, rand);
  return verticalShade(
    merge([
      paint(place(new CylinderGeometry(0.22, 0.32, 2.4, 5), 0, 1.2, 0), 'bark'),
      paint(place(crown, 0, 3.6, 0, 0, 1, 0.85, 1), 'leaf'),
      paint(place(jitter(new IcosahedronGeometry(1.2, 0), 0.4, rand), 1.0, 3.0, 0.6), 'leafDark'),
    ]),
    0.75,
    1.05,
  );
};

export const rock = (rand: Rand, size = 1): BufferGeometry => {
  const g = jitter(new DodecahedronGeometry(size, 0), size * 0.5, rand);
  place(g, 0, size * 0.35, 0, 0, 1, 0.65, 1);
  return verticalShade(paint(g, rand() > 0.5 ? 'rock' : 'rockLight'), 0.7, 1.05);
};

/** Mazgal dişleri (merlon) halkası. */
const merlonRing = (radius: number, y: number, count: number, swatch: 'gondorWhite' | 'helmStone') => {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    parts.push(
      paint(
        place(
          new BoxGeometry(0.8, 0.9, 0.5),
          Math.cos(a) * radius,
          y,
          Math.sin(a) * radius,
          -a + Math.PI / 2,
        ),
        swatch,
      ),
    );
  }
  return parts;
};

/**
 * Gondor gözetleme kulesi (GDD §3.4): beyaz sekizgen gövde, mazgallı korkuluk,
 * kurşun-mavi konik çatı ve sancak direği — izometrik kamerada anında tanınır siluet.
 */
export const gondorTower = (): BufferGeometry =>
  verticalShade(
    merge([
      paint(place(new CylinderGeometry(2.6, 3.1, 1.2, 8), 0, 0.6, 0), 'gondorStone'),
      paint(place(new CylinderGeometry(2.2, 2.6, 9, 8), 0, 5.7, 0), 'gondorWhite'),
      paint(place(new CylinderGeometry(2.9, 2.3, 0.8, 8), 0, 10.4, 0), 'gondorStone'),
      ...merlonRing(2.6, 11.2, 8, 'gondorWhite'),
      paint(place(new ConeGeometry(2.4, 4.2, 8), 0, 13.3, 0), 'gondorRoof'),
      paint(place(new CylinderGeometry(0.06, 0.06, 2.4, 4), 0, 16.4, 0), 'wood'),
      paint(place(new BoxGeometry(0.05, 1.0, 1.4), 0, 16.9, 0.7), 'team0'),
      // Pencere yarıkları
      paint(place(new BoxGeometry(0.4, 1.4, 0.2), 0, 7, 2.35), 'ironDark'),
      paint(place(new BoxGeometry(0.2, 1.4, 0.4), 2.35, 7, 0), 'ironDark'),
    ]),
    0.72,
    1.0,
  );

/** Düz sur segmenti (uzunluk 8 m = 2 grid hücresi; GDD §3.4 modüler 4 m grid). */
export const wallSegment = (swatch: 'gondorWhite' | 'helmStone' = 'helmStone'): BufferGeometry => {
  const parts = [paint(place(new BoxGeometry(8, 5, 2.4), 0, 2.5, 0), swatch)];
  for (let i = 0; i < 5; i++)
    parts.push(paint(place(new BoxGeometry(0.9, 0.9, 0.5), -3.6 + i * 1.8, 5.45, 0.95), swatch));
  // Alt kısımda koyu taş bandı (temel)
  parts.push(
    paint(
      place(new BoxGeometry(8.1, 0.8, 2.6), 0, 0.4, 0),
      swatch === 'helmStone' ? 'helmStoneDark' : 'gondorStone',
    ),
  );
  return verticalShade(merge(parts), 0.75, 1.0);
};

/** Kapı bloğu: iki yan payanda + ahşap kapı. */
export const gateHouse = (): BufferGeometry =>
  verticalShade(
    merge([
      paint(place(new BoxGeometry(3, 7, 4), -4, 3.5, 0), 'helmStone'),
      paint(place(new BoxGeometry(3, 7, 4), 4, 3.5, 0), 'helmStone'),
      paint(place(new BoxGeometry(5, 2, 4), 0, 6, 0), 'helmStone'),
      paint(place(new BoxGeometry(5, 5, 0.6), 0, 2.5, 1.2), 'woodDark'),
      paint(place(new BoxGeometry(5.2, 0.3, 0.7), 0, 3.6, 1.3), 'iron'),
      paint(place(new BoxGeometry(5.2, 0.3, 0.7), 0, 1.4, 1.3), 'iron'),
      ...[-5, -3, 3, 5].map((x) => paint(place(new BoxGeometry(0.9, 0.9, 0.5), x, 7.45, 1.6), 'helmStone')),
    ]),
    0.72,
    1.0,
  );

/** Hornburg benzeri ana kale (Citadel placeholder). */
export const keep = (): BufferGeometry =>
  verticalShade(
    merge([
      paint(place(new BoxGeometry(14, 10, 12), 0, 5, 0), 'helmStone'),
      paint(place(new BoxGeometry(9, 6, 8), 0, 13, -1), 'helmStone'),
      paint(place(new CylinderGeometry(3.2, 3.6, 22, 8), 6, 11, -5), 'helmStone'),
      paint(place(new ConeGeometry(3.6, 5, 8), 6, 24.5, -5), 'gondorRoof'),
      paint(place(new ConeGeometry(6.6, 4, 4), 0, 18, -1, Math.PI / 4), 'gondorRoof'),
      ...merlonRing(3.4, 22.4, 8, 'helmStone').map((g) => place(g, 6, 0, -5)),
      paint(place(new BoxGeometry(3, 4, 0.4), 0, 2, 6.1), 'woodDark'),
      paint(place(new CylinderGeometry(0.08, 0.08, 4, 4), 6, 29, -5), 'wood'),
      paint(place(new BoxGeometry(0.06, 1.4, 2.2), 6, 29.8, -3.9), 'team0'),
    ]),
    0.7,
    1.0,
  );

/** Mangal: taş kaide (toon) — ateş kısmı ayrı emissive batch'te. */
export const brazierBase = (): BufferGeometry =>
  merge([
    paint(place(new CylinderGeometry(0.5, 0.7, 1.2, 6), 0, 0.6, 0), 'rockDark'),
    paint(place(new CylinderGeometry(0.8, 0.5, 0.4, 6), 0, 1.4, 0), 'iron'),
  ]);

export const brazierFlame = (rand: Rand): BufferGeometry =>
  merge([
    paint(place(jitter(new OctahedronGeometry(0.55, 0), 0.2, rand), 0, 2.0, 0, 0, 1, 1.6, 1), 'fire'),
    paint(place(new OctahedronGeometry(0.3, 0), 0.15, 2.3, 0.1, 0.5, 1, 1.8, 1), 'ember'),
  ]);
