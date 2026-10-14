import { BoxGeometry, type BufferGeometry, ConeGeometry, CylinderGeometry } from 'three/webgpu';
import { merge, paint, place, verticalShade } from '../geometry/lowpoly';
import { merlonRing } from '../map/prefabs';

/**
 * İnşa edilebilir yapıların low-poly modelleri (GDD §3.4, §7.5). Orijin = slot merkezi,
 * taban y = 0; ön yüz +Z (güney, düşmanın geldiği yön).
 */

/**
 * Okçu kulesi: BFME2 Gondor kulesi silueti — beyaz taş gövde, mazgallı atış platformu,
 * kurşun-mavi sivri çatı ve takım sancağı. Sur soketine sığacak kadar ince (taban ≈ 4.4 m).
 */
export const arrowTowerModel = (): BufferGeometry =>
  verticalShade(
    merge([
      paint(place(new CylinderGeometry(2.0, 2.3, 0.8, 8), 0, 0.4, 0), 'gondorStone'),
      paint(place(new CylinderGeometry(1.55, 1.9, 5.2, 8), 0, 3.4, 0), 'gondorWhite'),
      // Atış platformu (dışa taşan konsol) + mazgallar
      paint(place(new CylinderGeometry(2.25, 1.6, 0.8, 8), 0, 6.3, 0), 'gondorStone'),
      ...merlonRing(1.95, 7.1, 8, 'gondorWhite'),
      // Dört direkli çatı
      ...[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return paint(
          place(new BoxGeometry(0.22, 2.0, 0.22), Math.cos(a) * 1.4, 7.6, Math.sin(a) * 1.4),
          'wood',
        );
      }),
      paint(place(new ConeGeometry(2.3, 2.6, 8), 0, 9.9, 0), 'gondorRoof'),
      paint(place(new CylinderGeometry(0.05, 0.05, 1.6, 4), 0, 11.9, 0), 'wood'),
      paint(place(new BoxGeometry(0.05, 0.7, 1.1), 0, 12.2, 0.55), 'team0'),
      // Ok yarıkları ve kapı
      paint(place(new BoxGeometry(0.3, 1.1, 0.2), 0, 4.2, 1.72), 'ironDark'),
      paint(place(new BoxGeometry(0.2, 1.1, 0.3), 1.72, 4.2, 0), 'ironDark'),
      paint(place(new BoxGeometry(0.2, 1.1, 0.3), -1.72, 4.2, 0), 'ironDark'),
      paint(place(new BoxGeometry(1.0, 1.7, 0.3), 0, 1.25, -1.8), 'woodDark'),
    ]),
    0.7,
    1.0,
  );

/**
 * Kışla: Gondor taş salonu — beyaz duvarlar, kurşun-mavi beşik çatı, payandalı köşeler,
 * ön cephede kemerli kapı ve iki yanında sancak direkleri. Taban ≈ 10 × 7 m.
 */
export const barracksModel = (): BufferGeometry => {
  const parts: BufferGeometry[] = [
    paint(place(new BoxGeometry(10.6, 0.7, 7.6), 0, 0.35, 0), 'gondorStone'),
    paint(place(new BoxGeometry(9.6, 4.2, 6.4), 0, 2.8, 0), 'gondorWhite'),
    // Beşik çatı: 4 kenarlı koni 45° döndürülüp X'te uzatılır.
    paint(place(new ConeGeometry(4.9, 3.2, 4), 0, 6.5, 0, Math.PI / 4, 1, 1, 1), 'gondorRoof'),
    paint(place(new BoxGeometry(10.2, 0.35, 0.35), 0, 7.95, 0), 'gondorStone'),
    // Ön giriş bloğu (kule-kapı)
    paint(place(new BoxGeometry(3.6, 5.6, 1.6), 0, 3.5, 3.6), 'gondorStone'),
    paint(place(new ConeGeometry(2.6, 2.0, 4), 0, 7.3, 3.6, Math.PI / 4), 'gondorRoof'),
    paint(place(new BoxGeometry(1.8, 2.8, 0.3), 0, 2.1, 4.45), 'woodDark'),
    paint(place(new BoxGeometry(2.0, 0.25, 0.35), 0, 3.6, 4.5), 'iron'),
    // Pencereler
    ...[-3.4, -1.9, 1.9, 3.4].map((x) =>
      paint(place(new BoxGeometry(0.6, 1.2, 0.2), x, 3.2, 3.22), 'ironDark'),
    ),
    // Ön cephede altın kalkan arması
    paint(place(new CylinderGeometry(0.6, 0.6, 0.15, 6).rotateX(Math.PI / 2), 0, 5.2, 4.45), 'gold'),
  ];
  // Köşe payandaları
  for (const [x, z] of [
    [-4.8, -3.2],
    [4.8, -3.2],
    [-4.8, 3.2],
    [4.8, 3.2],
  ] as const)
    parts.push(paint(place(new BoxGeometry(0.9, 4.8, 0.9), x, 2.4, z), 'gondorStone'));
  // Sancak direkleri
  for (const x of [-3.2, 3.2]) {
    parts.push(paint(place(new CylinderGeometry(0.07, 0.09, 5.2, 4), x, 2.6, 4.6), 'wood'));
    parts.push(paint(place(new BoxGeometry(0.06, 2.0, 1.1), x, 4.0, 5.15), 'team0'));
  }
  return verticalShade(merge(parts), 0.7, 1.0);
};

/** İnşaat iskelesi: ahşap direk ve kirişler (inşa süresince yapının çevresinde). */
export const scaffoldModel = (): BufferGeometry => {
  const parts: BufferGeometry[] = [];
  const h = 6;
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    parts.push(paint(place(new BoxGeometry(0.16, h, 0.16), x, h / 2, z), 'wood'));
  }
  for (const y of [1.8, 3.8, 5.8]) {
    parts.push(paint(place(new BoxGeometry(2.1, 0.12, 0.12), 0, y, 1), 'woodDark'));
    parts.push(paint(place(new BoxGeometry(2.1, 0.12, 0.12), 0, y, -1), 'woodDark'));
    parts.push(paint(place(new BoxGeometry(0.12, 0.12, 2.1), 1, y, 0), 'woodDark'));
    parts.push(paint(place(new BoxGeometry(0.12, 0.12, 2.1), -1, y, 0), 'woodDark'));
  }
  // Çapraz destekler
  parts.push(paint(place(new BoxGeometry(0.1, 3, 0.1).rotateZ(0.6), 0, 2.4, 1.02), 'wood'));
  parts.push(paint(place(new BoxGeometry(0.1, 3, 0.1).rotateX(0.6), 1.02, 2.4, 0), 'wood'));
  // Taş yığını
  parts.push(paint(place(new BoxGeometry(0.8, 0.5, 0.6), 1.5, 0.25, 1.4, 0.4), 'gondorStone'));
  return merge(parts);
};

/**
 * Demirhane: alçak taş atölye, ahşap sundurma, tüten baca ve önünde örs; ocak ağzı
 * kor rengindedir (emissive değil — sade). Taban ≈ 8 × 6 m.
 */
export const forgeModel = (): BufferGeometry => {
  const parts: BufferGeometry[] = [
    paint(place(new BoxGeometry(8.6, 0.6, 6.6), 0, 0.3, 0), 'gondorStone'),
    paint(place(new BoxGeometry(6.2, 3.4, 5.2), -0.9, 2.3, -0.4), 'helmStone'),
    paint(place(new ConeGeometry(4.3, 2.4, 4), -0.9, 5.2, -0.4, Math.PI / 4, 1, 1, 0.85), 'gondorRoof'),
    // Baca
    paint(place(new BoxGeometry(1.1, 5.2, 1.1), -2.8, 4.6, -1.8), 'helmStoneDark'),
    paint(place(new BoxGeometry(1.3, 0.3, 1.3), -2.8, 7.3, -1.8), 'rockDark'),
    // Ocak ağzı
    paint(place(new BoxGeometry(1.4, 1.2, 0.2), -0.9, 1.3, 2.25), 'fire'),
    paint(place(new BoxGeometry(1.8, 0.25, 0.3), -0.9, 2.05, 2.3), 'ironDark'),
    // Sundurma (ön sağ)
    paint(place(new BoxGeometry(3.0, 0.12, 3.0), 2.9, 3.0, 1.2, 0, 1, 1, 1), 'wood'),
    // Örs + kütük
    paint(place(new CylinderGeometry(0.35, 0.4, 0.7, 6), 2.6, 0.95, 1.4), 'woodDark'),
    paint(place(new BoxGeometry(0.9, 0.3, 0.4), 2.6, 1.45, 1.4), 'iron'),
    paint(place(new BoxGeometry(0.3, 0.2, 0.3), 3.1, 1.45, 1.4), 'iron'),
    // Silah rafı
    paint(place(new BoxGeometry(1.6, 0.1, 0.3), 3.4, 1.6, -1.2), 'woodDark'),
    ...[3.0, 3.4, 3.8].map((x) => paint(place(new BoxGeometry(0.06, 1.3, 0.12), x, 1.3, -1.05), 'steel')),
  ];
  for (const [x, z] of [
    [1.5, -0.2],
    [4.3, -0.2],
    [1.5, 2.6],
    [4.3, 2.6],
  ] as const)
    parts.push(paint(place(new BoxGeometry(0.18, 2.5, 0.18), x, 1.85, z), 'wood'));
  return verticalShade(merge(parts), 0.7, 1.0);
};
