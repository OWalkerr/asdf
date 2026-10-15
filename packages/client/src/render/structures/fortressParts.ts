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
import type { Swatch } from '../palette';

/**
 * Taraf teması (FACTIONS indeksi): kale yükseltme parçalarının taşı, süsü (altın / demir) ve
 * sancak arması. 0 Gondor Beyaz Ağaç, 1 Rohan altın at, 2 Lórien altın yaprak, 3 Isengard Beyaz El,
 * 4 Mordor Göz.
 */
export interface FortTheme {
  stone: Swatch;
  stoneDark: Swatch;
  trim: Swatch;
  bannerBg: Swatch;
  emblem: 'tree' | 'horse' | 'leaf' | 'hand' | 'eye';
  glow: Swatch;
}
export const fortTheme = (faction: number): FortTheme =>
  (
    [
      {
        stone: 'helmStone',
        stoneDark: 'helmStoneDark',
        trim: 'gold',
        bannerBg: 'sootBlack',
        emblem: 'tree',
        glow: 'magic',
      },
      {
        stone: 'helmStone',
        stoneDark: 'helmStoneDark',
        trim: 'gold',
        bannerBg: 'team0',
        emblem: 'horse',
        glow: 'magic',
      },
      {
        stone: 'rockLight',
        stoneDark: 'helmStone',
        trim: 'gold',
        bannerBg: 'team0',
        emblem: 'leaf',
        glow: 'magic',
      },
      {
        stone: 'rockDark',
        stoneDark: 'sootBlack',
        trim: 'ironDark',
        bannerBg: 'sootBlack',
        emblem: 'hand',
        glow: 'fire',
      },
      {
        stone: 'rockDark',
        stoneDark: 'sootBlack',
        trim: 'ironDark',
        bannerBg: 'sootBlack',
        emblem: 'eye',
        glow: 'fire',
      },
      // Goblinler: Sisli Dağların kaba taşı, kızıl göz arması.
      {
        stone: 'rock',
        stoneDark: 'rockDark',
        trim: 'rust',
        bannerBg: 'sootBlack',
        emblem: 'eye',
        glow: 'fire',
      },
    ] as const satisfies readonly FortTheme[]
  )[faction] ?? {
    stone: 'helmStone',
    stoneDark: 'helmStoneDark',
    trim: 'gold',
    bannerBg: 'sootBlack',
    emblem: 'tree',
    glow: 'magic',
  };

/** Sancak arması (yerel: sancak merkezinde, z önünde). */
const emblem = (t: FortTheme, x: number, y: number, z: number): BufferGeometry[] => {
  switch (t.emblem) {
    case 'tree':
      return [
        paint(place(new BoxGeometry(0.25, 3.4, 0.14), x, y, z), 'gondorWhite'),
        paint(place(new BoxGeometry(1.5, 0.22, 0.14), x, y + 0.8, z), 'gondorWhite'),
        paint(place(new BoxGeometry(1.0, 0.2, 0.14), x, y, z), 'gondorWhite'),
      ];
    case 'horse':
      return [
        paint(place(new BoxGeometry(0.5, 1.6, 0.14), x, y, z, 0, 1, 1, 1), 'gold'),
        paint(place(new BoxGeometry(1.0, 0.45, 0.14), x + 0.35, y + 0.7, z), 'gold'),
        paint(place(new BoxGeometry(0.2, 0.5, 0.14), x - 0.15, y + 1.0, z), 'gold'),
      ];
    case 'leaf':
      return [paint(place(new OctahedronGeometry(0.9, 0).scale(0.7, 1.4, 0.15), x, y, z), 'gold')];
    case 'hand':
      return [
        paint(place(new BoxGeometry(1.0, 1.0, 0.14), x, y - 0.4, z), 'whiteHand'),
        ...[0, 1, 2, 3].map((f) =>
          paint(place(new BoxGeometry(0.2, 0.9, 0.14), x - 0.36 + f * 0.24, y + 0.5, z), 'whiteHand'),
        ),
      ];
    case 'eye':
      return [
        paint(place(new OctahedronGeometry(0.9, 1).scale(1.2, 0.6, 0.15), x, y, z), 'eyeRed'),
        paint(place(new BoxGeometry(0.16, 0.9, 0.16), x, y, z), 'sootBlack'),
      ];
  }
};

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
export const bastionRing = (th: FortTheme = fortTheme(0)): BufferGeometry => {
  const parts: BufferGeometry[] = [];
  const R = 13.2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    // Ön yüz (kapı yönü, +z) açık kalsın.
    if (Math.abs(a - Math.PI / 2) < 0.5) continue;
    const len = 2 * R * Math.sin(Math.PI / 8) + 0.6;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    parts.push(paint(place(new BoxGeometry(len, 4.2, 1.6), x, 2.1, z, -a + Math.PI / 2), th.stone));
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
          th.stone,
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
    parts.push(paint(place(new CylinderGeometry(2.3, 2.7, 6.4, 8), x, 3.2, z), th.stone));
    parts.push(paint(place(new CylinderGeometry(2.8, 2.4, 0.6, 8), x, 6.7, z), th.stoneDark));
    for (const m of merlonRing(2.5, 7.3, 6, th.stone)) parts.push(m.translate(x, 0, z));
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
export const healingBanners = (t: FortTheme = fortTheme(0)): BufferGeometry =>
  merge(
    [-7.5, 7.5].flatMap((x) => [
      paint(place(new BoxGeometry(0.1, 3.2, 2.2), x, 11.4, 9.7), t.glow),
      paint(place(new BoxGeometry(0.12, 1.1, 0.6), x, 11.6, 9.75), 'ember'),
    ]),
  );

/** Hazine: köşe kule külahlarına altın başlıklar ve gövdeye altın kuşak. */
export const goldCaps = (t: FortTheme = fortTheme(0)): BufferGeometry => {
  const parts: BufferGeometry[] = [];
  const evil = t.trim !== 'gold';
  for (const [x, z] of CORNERS) {
    // İyi taraflar: altın külah ve yıldız; kötü taraflar: demir diken ve kor uç.
    parts.push(
      paint(place(new ConeGeometry(evil ? 0.7 : 1.2, evil ? 3.4 : 2.2, evil ? 4 : 8), x, 21.6, z), t.trim),
    );
    parts.push(
      paint(place(new OctahedronGeometry(0.45, 0), x, evil ? 23.6 : 22.8, z), evil ? 'fire' : 'gold'),
    );
  }
  parts.push(paint(place(new BoxGeometry(15.9, 0.35, 15.9), 0, 10.6, 0), t.trim));
  return verticalShade(merge(parts), 0.8, 1.1);
};

/** 3. kademe: ön cepheye uzun Gondor sancakları (siyah zemin, Beyaz Ağaç) ve taç. */
export const keepBanners = (t: FortTheme = fortTheme(0)): BufferGeometry => {
  const parts: BufferGeometry[] = [];
  for (const x of [-3.6, 3.6]) {
    parts.push(paint(place(new BoxGeometry(2.2, 7, 0.12), x, 13.6, 4.15), t.bannerBg));
    parts.push(...emblem(t, x, 14.4, 4.2));
    parts.push(paint(place(new BoxGeometry(2.6, 0.25, 0.3), x, 17.2, 4.2), t.trim));
  }
  // Taç: orta kule külahının dibinde halka (iyi: altın; kötü: dikenli demir).
  parts.push(paint(place(new TorusGeometry(6.3, 0.35, 4, 8).rotateX(Math.PI / 2), 0, 20.4, 0), t.trim));
  if (t.trim !== 'gold')
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      parts.push(
        paint(place(new ConeGeometry(0.25, 1.6, 4), Math.cos(a) * 6.3, 21.2, Math.sin(a) * 6.3), 'iron'),
      );
    }
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
