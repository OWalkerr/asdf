import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  OctahedronGeometry,
  TorusGeometry,
} from 'three/webgpu';
import { merge, paint, place, verticalShade } from '../geometry/lowpoly';
import { merlonRing } from '../map/prefabs';

/**
 * Kale yükseltme parçaları (BFME2'de kale genişledikçe gövdesine eklenen yapılar gibi). Hepsi
 * fortressKeep'in model uzayında kurulur (ön = +z, kapı z ≈ 7.6; köşe kuleleri ±7.5, gövde
 * üstü terası y = 11.6, köşe kule külahlarının tepesi y ≈ 20.4) ve kalenin merkezine aynı dönüş
 * ve ölçekle yerleşir.
 */
const CORNERS: readonly (readonly [number, number])[] = [
  [-7.5, -7.5],
  [7.5, -7.5],
  [-7.5, 7.5],
  [7.5, 7.5],
];

/** Taş Takviye: sekizgen perde sur (ön açık), dört yuvarlak burç, mazgallar. */
export const bastionRing = (): BufferGeometry => {
  const parts: BufferGeometry[] = [];
  const R = 13.2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    // Ön yüz (kapı yönü, +z) açık kalsın.
    if (Math.abs(a - Math.PI / 2) < 0.5) continue;
    const len = 2 * R * Math.sin(Math.PI / 8) + 0.6;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    parts.push(paint(place(new BoxGeometry(len, 4.2, 1.6), x, 2.1, z, -a + Math.PI / 2), 'helmStone'));
    for (let k = -2; k <= 2; k++) {
      const t = (k / 5) * len;
      parts.push(
        paint(
          place(
            new BoxGeometry(0.7, 0.8, 0.5),
            x - Math.sin(a) * t + Math.cos(a) * 0.55,
            4.6,
            z + Math.cos(a) * t + Math.sin(a) * 0.55,
            -a + Math.PI / 2,
          ),
          'helmStone',
        ),
      );
    }
  }
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const x = sx * 10.4;
    const z = sz * 10.4;
    parts.push(paint(place(new CylinderGeometry(2.3, 2.7, 6.4, 8), x, 3.2, z), 'helmStone'));
    parts.push(paint(place(new CylinderGeometry(2.8, 2.4, 0.6, 8), x, 6.7, z), 'helmStoneDark'));
    for (const m of merlonRing(2.5, 7.3, 6, 'helmStone')) parts.push(m.translate(x, 0, z));
  }
  return verticalShade(merge(parts), 0.65, 0.98);
};

/** Ok Mazgalları: köşe kulelerinin tepesinde ahşap çıkmalar, ok yarıkları ve takım flamaları. */
export const archerHoardings = (): BufferGeometry => {
  const parts: BufferGeometry[] = [];
  for (const [x, z] of CORNERS) {
    parts.push(paint(place(new CylinderGeometry(3.3, 3.0, 1.4, 8), x, 14.2, z), 'wood'));
    parts.push(paint(place(new CylinderGeometry(3.4, 3.4, 0.25, 8), x, 15.0, z), 'woodDark'));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      parts.push(
        paint(
          place(new BoxGeometry(0.25, 1.0, 0.5), x + Math.cos(a) * 3.32, 14.2, z + Math.sin(a) * 3.32, -a),
          'sootBlack',
        ),
      );
    }
    parts.push(paint(place(new CylinderGeometry(0.07, 0.07, 3, 4), x, 22.6, z), 'wood'));
    parts.push(paint(place(new BoxGeometry(0.06, 0.8, 1.6), x, 23.6, z + 0.8), 'team0'));
  }
  return verticalShade(merge(parts), 0.75, 1.02);
};

/** Şifa Sancağı: ön köşe kulelerinin flamaları (parlak; emissive batch). */
export const healingBanners = (): BufferGeometry =>
  merge(
    [-7.5, 7.5].flatMap((x) => [
      paint(place(new BoxGeometry(0.1, 3.2, 2.2), x, 11.4, 9.7), 'magic'),
      paint(place(new BoxGeometry(0.12, 1.1, 0.6), x, 11.6, 9.75), 'ember'),
    ]),
  );

/** Hazine: köşe kule külahlarına altın başlıklar ve gövdeye altın kuşak. */
export const goldCaps = (): BufferGeometry => {
  const parts: BufferGeometry[] = [];
  for (const [x, z] of CORNERS) {
    parts.push(paint(place(new ConeGeometry(1.2, 2.2, 8), x, 21.3, z), 'gold'));
    parts.push(paint(place(new OctahedronGeometry(0.45, 0), x, 22.8, z), 'gold'));
  }
  parts.push(paint(place(new BoxGeometry(15.9, 0.35, 15.9), 0, 10.6, 0), 'gold'));
  return verticalShade(merge(parts), 0.8, 1.1);
};

/** 3. kademe: ön cepheye uzun Gondor sancakları (siyah zemin, Beyaz Ağaç) ve taç. */
export const keepBanners = (): BufferGeometry => {
  const parts: BufferGeometry[] = [];
  for (const x of [-3.6, 3.6]) {
    parts.push(paint(place(new BoxGeometry(2.2, 7, 0.12), x, 13.6, 4.15), 'sootBlack'));
    parts.push(paint(place(new BoxGeometry(0.25, 3.4, 0.14), x, 14.4, 4.2), 'gondorWhite'));
    parts.push(paint(place(new BoxGeometry(1.5, 0.22, 0.14), x, 15.2, 4.2), 'gondorWhite'));
    parts.push(paint(place(new BoxGeometry(1.0, 0.2, 0.14), x, 14.4, 4.2), 'gondorWhite'));
    parts.push(paint(place(new BoxGeometry(2.6, 0.25, 0.3), x, 17.2, 4.2), 'gold'));
  }
  // Taç: orta kule külahının dibinde altın halka.
  parts.push(paint(place(new TorusGeometry(6.3, 0.35, 4, 8).rotateX(Math.PI / 2), 0, 20.4, 0), 'gold'));
  return verticalShade(merge(parts), 0.8, 1.05);
};

/** 5. kademe: ön terasta Gondor işaret ateşi kazanı (gövde; alev ayrı emissive). */
export const beaconBowl = (): BufferGeometry =>
  merge([
    paint(place(new CylinderGeometry(0.5, 0.7, 1.4, 6), 0, 12.3, 6), 'iron'),
    paint(place(new CylinderGeometry(1.4, 0.9, 1.0, 8), 0, 13.5, 6), 'ironDark'),
  ]);

export const beaconFlame = (): BufferGeometry =>
  merge([
    paint(place(new ConeGeometry(1.2, 3.2, 6), 0, 15.6, 6), 'fire'),
    paint(place(new ConeGeometry(0.7, 2.2, 5), 0.2, 15.3, 6.1), 'ember'),
  ]);
