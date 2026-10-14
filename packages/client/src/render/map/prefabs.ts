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
export const merlonRing = (radius: number, y: number, count: number, swatch: 'gondorWhite' | 'helmStone') => {
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

/**
 * Deeping Wall segmenti (GDD §3.4): kalın, yüksek taş sur. Uzunluk X ekseninde,
 * dış yüz (mazgallar) +Z'de. İç tarafta alçak korkuluk ve yürüyüş yolu.
 */
export const deepingWallSegment = (length: number, height: number, thickness: number): BufferGeometry => {
  const parts = [
    paint(place(new BoxGeometry(length, height, thickness), 0, height / 2, 0), 'helmStone'),
    // Dış yüzde hafif eğimli payanda (Helm's Deep'in kalın tabanlı silueti)
    paint(
      place(new BoxGeometry(length, height * 0.45, 1.6), 0, height * 0.22, thickness / 2 + 0.6),
      'helmStoneDark',
    ),
    paint(place(new BoxGeometry(length + 0.05, 0.5, thickness + 0.3), 0, height - 0.1, 0), 'helmStoneDark'),
    // İç korkuluk
    paint(place(new BoxGeometry(length, 0.8, 0.4), 0, height + 0.4, -thickness / 2 + 0.2), 'helmStone'),
  ];
  const merlons = Math.max(2, Math.round(length / 1.8));
  for (let i = 0; i < merlons; i++) {
    const x = -length / 2 + (i + 0.5) * (length / merlons);
    parts.push(
      paint(place(new BoxGeometry(0.9, 1.1, 0.6), x, height + 0.55, thickness / 2 - 0.3), 'helmStone'),
    );
  }
  return verticalShade(merge(parts), 0.68, 1.0);
};

/** Deeping Wall üzerindeki yuvarlak merdiven kulesi. */
export const wallTower = (height: number): BufferGeometry =>
  verticalShade(
    merge([
      paint(place(new CylinderGeometry(4.4, 5.0, height, 8), 0, height / 2, 0), 'helmStone'),
      paint(place(new CylinderGeometry(4.9, 4.4, 0.7, 8), 0, height + 0.35, 0), 'helmStoneDark'),
      ...merlonRing(4.6, height + 1.1, 10, 'helmStone'),
      paint(place(new BoxGeometry(1.6, 2.6, 0.3), 0, 1.3, 4.6), 'woodDark'),
    ]),
    0.68,
    1.0,
  );

/**
 * Glittering Caves ağzı (Citadel): kaya kemer + karanlık giriş + yan mangallar için kaide.
 * Ön yüz +Z'ye (güneye) bakar.
 */
export const caveMouth = (rand: Rand): BufferGeometry => {
  const boulder = (x: number, y: number, z: number, s: number, sy = s) =>
    verticalShade(
      paint(
        place(jitter(new DodecahedronGeometry(1, 0), 0.35, rand), x, y, z, rand() * 6, s, sy, s),
        'rockDark',
      ),
      0.7,
      1.05,
    );
  return merge([
    paint(place(new BoxGeometry(10, 11, 6), 0, 5.5, -2.5), 'ironDark'),
    boulder(-8, 5, 0, 5, 7),
    boulder(8, 5, 0, 5, 7.5),
    boulder(0, 13, -0.5, 9, 4),
    boulder(-12, 2, 2, 3.5),
    boulder(12, 2.5, 1.5, 4),
    paint(place(new BoxGeometry(8, 0.4, 5), 0, 0.2, 4), 'helmStone'),
  ]);
};

/** Çimen öbeği: 3 ince üçgen yaprak (dekor; binlerce instance, ~6 üçgen). */
export const grassTuft = (rand: Rand, swatch: 'grass' | 'grassDark' | 'grassDry'): BufferGeometry => {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const h = 0.6 + rand() * 0.5;
    parts.push(
      paint(
        place(
          new ConeGeometry(0.12, h, 3, 1, true),
          (rand() - 0.5) * 0.4,
          h / 2,
          (rand() - 0.5) * 0.4,
          rand() * 6,
        ),
        swatch,
      ),
    );
  }
  return verticalShade(merge(parts), 0.55, 1.1);
};

/** Duvar meşalesi: ince ahşap direk + demir kafes (alev ayrı emissive batch'te: torchFlame). */
export const torchPost = (): BufferGeometry =>
  merge([
    paint(place(new CylinderGeometry(0.07, 0.09, 1.6, 4), 0, 0.8, 0), 'woodDark'),
    paint(place(new CylinderGeometry(0.22, 0.12, 0.3, 5), 0, 1.7, 0), 'iron'),
  ]);

export const torchFlame = (rand: Rand): BufferGeometry =>
  merge([
    paint(place(jitter(new OctahedronGeometry(0.28, 0), 0.08, rand), 0, 2.05, 0, 0, 1, 1.7, 1), 'fire'),
    paint(place(new OctahedronGeometry(0.14, 0), 0.04, 2.2, 0.03, 0.5, 1, 1.8, 1), 'ember'),
  ]);

/** Kapı çerçevesi: iki payanda + üst kemer (kanatlar GateRenderer'da, kırılınca gizlenir). Genişlik 5 m'lik açıklık. */
export const gateFrame = (swatch: 'helmStone' | 'gondorStone' = 'helmStone'): BufferGeometry =>
  verticalShade(
    merge([
      paint(place(new BoxGeometry(3, 7, 4), -4, 3.5, 0), swatch),
      paint(place(new BoxGeometry(3, 7, 4), 4, 3.5, 0), swatch),
      paint(place(new BoxGeometry(5, 2, 4), 0, 6, 0), swatch),
      ...[-5, -3, 3, 5].map((x) => paint(place(new BoxGeometry(0.9, 0.9, 0.5), x, 7.45, 1.6), swatch)),
      ...[-5, -3, 3, 5].map((x) => paint(place(new BoxGeometry(0.9, 0.9, 0.5), x, 7.45, -1.6), swatch)),
    ]),
    0.72,
    1.0,
  );

/** Kapı kanatları (iki ahşap kanat + demir kuşaklar); GateRenderer instance'ı. */
export const gateDoors = (): BufferGeometry =>
  merge([
    paint(place(new BoxGeometry(2.45, 5, 0.6), -1.27, 2.5, 1.2), 'woodDark'),
    paint(place(new BoxGeometry(2.45, 5, 0.6), 1.27, 2.5, 1.2), 'woodDark'),
    paint(place(new BoxGeometry(5.2, 0.3, 0.7), 0, 3.6, 1.3), 'iron'),
    paint(place(new BoxGeometry(5.2, 0.3, 0.7), 0, 1.4, 1.3), 'iron'),
    paint(place(new BoxGeometry(0.4, 0.4, 0.75), -0.4, 2.5, 1.3), 'ironDark'),
    paint(place(new BoxGeometry(0.4, 0.4, 0.75), 0.4, 2.5, 1.3), 'ironDark'),
  ]);

/** Kırık kapı enkazı: devrilmiş kanat parçaları ve taşlar. */
export const gateRubble = (rand: Rand): BufferGeometry =>
  merge([
    paint(place(new BoxGeometry(2.4, 0.4, 4.6), -1.2, 0.2, 2.6, 0.3), 'woodDark'),
    paint(place(new BoxGeometry(2.2, 0.4, 4.2), 1.4, 0.35, 3.0, -0.4), 'woodDark'),
    ...[0, 1, 2, 3, 4].map((i) =>
      paint(
        place(jitter(new DodecahedronGeometry(0.5, 0), 0.2, rand), -2 + i, 0.3, 1 + (i % 2), rand() * 6),
        'helmStone',
      ),
    ),
  ]);

/** Taş köprü güvertesi: uzunluk boyunca (yerel +Z) korkuluklu, kemerli ayaklar. */
export const bridgeDeck = (length: number, width: number): BufferGeometry => {
  const parts = [paint(place(new BoxGeometry(width + 1, 0.8, length), 0, 0.4, 0), 'helmStone')];
  for (const s of [-1, 1])
    parts.push(
      paint(place(new BoxGeometry(0.6, 1.1, length), (s * (width + 0.4)) / 2, 1.2, 0), 'helmStoneDark'),
    );
  const piers = Math.max(2, Math.round(length / 9));
  for (let i = 0; i < piers; i++) {
    const z = -length / 2 + ((i + 0.5) * length) / piers;
    parts.push(paint(place(new BoxGeometry(width + 1.6, 4, 2), 0, -1.8, z), 'helmStoneDark'));
  }
  return verticalShade(merge(parts), 0.7, 1.0);
};

/**
 * Kale (Citadel) burcu — özgün FD haritalarının kalbi: kare taban, dört köşe kulesi, ortada
 * yüksek baş kule ve kurşun-mavi sivri çatılar, ön yüzde (+Z) büyük kapı ve sancaklar.
 * Taban ≈ 18 × 18 m, yükseklik ≈ 26 m.
 */
export const fortressKeep = (): BufferGeometry => {
  const parts: BufferGeometry[] = [
    paint(place(new BoxGeometry(19, 1.2, 19), 0, 0.6, 0), 'gondorStone'),
    paint(place(new BoxGeometry(15, 10, 15), 0, 6, 0), 'gondorWhite'),
    paint(place(new BoxGeometry(15.6, 0.8, 15.6), 0, 11.2, 0), 'gondorStone'),
    paint(place(new BoxGeometry(8, 9, 8), 0, 15.6, 0), 'gondorWhite'),
    paint(place(new ConeGeometry(6.4, 7, 4), 0, 23.6, 0, Math.PI / 4), 'gondorRoof'),
    paint(place(new CylinderGeometry(0.1, 0.1, 4, 4), 0, 28.6, 0), 'wood'),
    paint(place(new BoxGeometry(0.08, 1.6, 2.6), 0, 29.6, 1.3), 'team0'),
    // Kapı + kemer
    paint(place(new BoxGeometry(4.2, 5.2, 0.6), 0, 3.6, 7.6), 'woodDark'),
    paint(place(new BoxGeometry(5.4, 1, 1), 0, 6.6, 7.7), 'gondorStone'),
    paint(place(new BoxGeometry(4.4, 0.25, 0.7), 0, 4.4, 7.95), 'iron'),
  ];
  for (const [x, z] of [
    [-7.5, -7.5],
    [7.5, -7.5],
    [-7.5, 7.5],
    [7.5, 7.5],
  ] as const) {
    parts.push(paint(place(new CylinderGeometry(2.4, 2.8, 15, 8), x, 7.5, z), 'gondorWhite'));
    parts.push(paint(place(new CylinderGeometry(3, 2.4, 0.8, 8), x, 15.4, z), 'gondorStone'));
    parts.push(paint(place(new ConeGeometry(2.8, 4.6, 8), x, 18.1, z), 'gondorRoof'));
  }
  for (const x of [-6, 6]) parts.push(paint(place(new BoxGeometry(0.06, 3.4, 1.6), x, 8.2, 7.9), 'team0'));
  // Ön yüz pencereleri
  for (const x of [-4, 4]) parts.push(paint(place(new BoxGeometry(1, 2, 0.2), x, 8, 7.55), 'ironDark'));
  parts.push(...merlonRing(5.4, 20.6, 8, 'gondorWhite'));
  return verticalShade(merge(parts), 0.7, 1.0);
};

/** Mancınık (kule yuvası + kale yükseltmesi): ahşap şasi, karşı ağırlıklı kol, taş sepeti. */
export const catapultModel = (): BufferGeometry =>
  verticalShade(
    merge([
      paint(place(new CylinderGeometry(2.2, 2.6, 1.6, 8), 0, 0.8, 0), 'helmStone'),
      paint(place(new BoxGeometry(3.6, 0.4, 2.4), 0, 1.8, 0), 'wood'),
      ...[-1, 1].map((s) => paint(place(new BoxGeometry(0.3, 2.6, 0.3), 0, 3.1, s * 1.0), 'woodDark')),
      paint(place(new BoxGeometry(0.3, 0.3, 2.4), 0, 4.3, 0), 'woodDark'),
      paint(place(new BoxGeometry(5.2, 0.28, 0.28), 0.6, 4.6, 0, 0, 1, 1, 1).rotateZ(0), 'wood'),
      paint(place(new BoxGeometry(1.1, 1.1, 1.1), -1.9, 3.9, 0), 'ironDark'), // karşı ağırlık
      paint(place(new BoxGeometry(0.8, 0.35, 0.8), 3.0, 4.8, 0), 'leather'), // sepet
      paint(place(new DodecahedronGeometry(0.35, 0), 3.0, 5.15, 0), 'rockLight'),
    ]),
    0.72,
    1.0,
  );

/** Hazine yükseltmesi: altın kubbeli küçük taş hazine binası. */
export const treasuryHouse = (): BufferGeometry =>
  verticalShade(
    merge([
      paint(place(new BoxGeometry(5, 3.4, 4), 0, 1.7, 0), 'gondorStone'),
      paint(place(new CylinderGeometry(2.4, 2.6, 0.6, 8), 0, 3.7, 0), 'gondorWhite'),
      paint(place(new ConeGeometry(2.5, 2.4, 8), 0, 5.2, 0), 'gold'),
      paint(place(new BoxGeometry(1.4, 2, 0.2), 0, 1.1, 2.05), 'ironDark'),
    ]),
    0.72,
    1.05,
  );

/** Taş takviye: kale tabanını saran eğimli kalın etek (payandalar). */
export const keepSkirt = (): BufferGeometry =>
  verticalShade(
    merge([
      paint(place(new CylinderGeometry(12.2, 13.6, 3.2, 8), 0, 1.6, 0, Math.PI / 8), 'helmStoneDark'),
      ...[0, 1, 2, 3].map((i) =>
        paint(
          place(new BoxGeometry(2.2, 6, 3), 0, 3, 0)
            .translate(12.2, 0, 0)
            .rotateY((i * Math.PI) / 2 + Math.PI / 4),
          'helmStone',
        ),
      ),
    ]),
    0.65,
    0.95,
  );

/** Şifa sancağı direği (bayrak ayrı emissive batch'te: healingFlag). */
export const bannerPole = (): BufferGeometry =>
  merge([
    paint(place(new CylinderGeometry(0.5, 0.7, 0.8, 6), 0, 0.4, 0), 'gondorStone'),
    paint(place(new CylinderGeometry(0.1, 0.12, 8, 5), 0, 4.4, 0), 'wood'),
    paint(place(new ConeGeometry(0.25, 0.6, 5), 0, 8.7, 0), 'gold'),
  ]);

export const healingFlag = (): BufferGeometry =>
  merge([
    paint(place(new BoxGeometry(0.08, 2.6, 1.8), 0, 6.6, 0.95), 'magic'),
    paint(place(new BoxGeometry(0.1, 0.9, 0.5), 0, 6.8, 0.95), 'ember'),
  ]);
