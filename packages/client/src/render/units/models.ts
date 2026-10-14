import {
  BoxGeometry,
  BufferAttribute,
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Matrix4,
  OctahedronGeometry,
} from 'three/webgpu';
import { merge, paint, verticalShade } from '../geometry/lowpoly';
import type { Swatch } from '../palette';

/**
 * Kodla üretilen low-poly birim modelleri (Phase 1 / Adım 6, GDD §3.2–3.3).
 *
 * Segmentli prosedürel animasyon (SPA) sözleşmesi: her köşe iki ek nitelik taşır:
 *   aPart  — parça kimliği (0 gövde, 1 baş, 2 sağ kol+silah, 3 sol kol+kalkan, 4 sol bacak, 5 sağ bacak)
 *   aPivot — parçanın döndüğü eklem noktası (omuz, kalça, boyun), model uzayında
 * UnitMaterial vertex shader'ı bu iki nitelikle parçaları döndürür; kemik/iskelet yoktur.
 *
 * Model uzayı: ayaklar y=0'da, ileri yön +X, sağ taraf +Z (ileri × yukarı), 1 birim = 1 m.
 * Takım rengi: 'team0*' swatch'ları; shader bunları takım satırına kaydırır (GDD §3.1).
 */
export const Part = { Body: 0, Head: 1, ArmR: 2, ArmL: 3, LegL: 4, LegR: 5 } as const;
type PartId = (typeof Part)[keyof typeof Part];
type V3 = [number, number, number];

interface Rig {
  hip: number;
  shoulder: number;
  neck: number;
  /** Omuzların yanal uzaklığı (z). */
  shoulderZ: number;
  hipZ: number;
}

const HUMAN: Rig = { hip: 0.9, shoulder: 1.38, neck: 1.5, shoulderZ: 0.3, hipZ: 0.13 };

const pivotOf = (rig: Rig, part: PartId): V3 => {
  switch (part) {
    case Part.Head:
      return [0, rig.neck, 0];
    case Part.ArmR:
      return [0, rig.shoulder, rig.shoulderZ];
    case Part.ArmL:
      return [0, rig.shoulder, -rig.shoulderZ];
    case Part.LegL:
      return [0, rig.hip, -rig.hipZ];
    case Part.LegR:
      return [0, rig.hip, rig.hipZ];
    default:
      return [0, rig.hip, 0];
  }
};

/** Bir model inşa edicisi: parçaları toplar, sonunda tek geometri üretir. */
class ModelBuilder {
  private parts: BufferGeometry[] = [];
  constructor(private readonly rig: Rig = HUMAN) {}

  /** Primitive'i ölçekler → döndürür (Euler, radyan) → konumlandırır, boyar ve parça niteliklerini ekler. */
  add(
    part: PartId,
    geo: BufferGeometry,
    swatch: Swatch,
    pos: V3,
    rot: V3 = [0, 0, 0],
    scale: V3 = [1, 1, 1],
    pivotOverride?: V3,
  ): this {
    geo.applyMatrix4(
      new Matrix4()
        .makeScale(...scale)
        .premultiply(new Matrix4().makeRotationFromEuler(new Euler(...rot)))
        .premultiply(new Matrix4().makeTranslation(...pos)),
    );
    const g = paint(geo, swatch);
    const n = g.getAttribute('position').count;
    const [px, py, pz] = pivotOverride ?? pivotOf(this.rig, part);
    const pivot = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pivot.set([px, py, pz], i * 3);
    g.setAttribute('aPart', new BufferAttribute(new Float32Array(n).fill(part), 1));
    g.setAttribute('aPivot', new BufferAttribute(pivot, 3));
    this.parts.push(g);
    return this;
  }

  build(scale = 1): BufferGeometry {
    const geo = verticalShade(merge(this.parts), 0.72, 1.05);
    if (scale !== 1) {
      geo.scale(scale, scale, scale);
      const pv = geo.getAttribute('aPivot') as BufferAttribute;
      for (let i = 0; i < pv.count; i++)
        pv.setXYZ(i, pv.getX(i) * scale, pv.getY(i) * scale, pv.getZ(i) * scale);
    }
    geo.computeBoundingSphere();
    return geo;
  }
}

const box = (x: number, y: number, z: number) => new BoxGeometry(x, y, z);
const cyl = (rt: number, rb: number, h: number, seg = 6) => new CylinderGeometry(rt, rb, h, seg);

/** İki bacak + bot (ortak insan alt gövdesi). */
const legs = (b: ModelBuilder, cloth: Swatch, boot: Swatch, hipZ = 0.13) => {
  for (const [part, z] of [
    [Part.LegL, -hipZ],
    [Part.LegR, hipZ],
  ] as const) {
    b.add(part, box(0.17, 0.72, 0.17), cloth, [0, 0.52, z]);
    b.add(part, box(0.26, 0.16, 0.19), boot, [0.04, 0.08, z]);
  }
};

/** Kol: omuzdan aşağı sarkan üst kol + el. Sağ kol z>0. */
const arm = (b: ModelBuilder, part: PartId, z: number, sleeve: Swatch, hand: Swatch, length = 0.62) => {
  b.add(part, box(0.15, length, 0.15), sleeve, [0, 1.38 - length / 2, z]);
  b.add(part, box(0.13, 0.13, 0.13), hand, [0.02, 1.38 - length - 0.04, z]);
};

/**
 * Soldiers of Gondor: siyah tabard + çelik göğüslük, Beyaz Ağaç amblemi, yuvarlak
 * burun korumalı miğfer, kılıç ve damla kalkan. Takım rengi: pelerin + kalkan kenarı.
 */
export const gondorSoldier = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'sootBlack', 'leather');
  b.add(Part.Body, box(0.36, 0.62, 0.5), 'sootBlack', [0, 1.13, 0]);
  b.add(Part.Body, box(0.08, 0.42, 0.42), 'steel', [0.18, 1.2, 0]);
  b.add(Part.Body, box(0.03, 0.22, 0.12), 'gondorWhite', [0.23, 1.2, 0]); // Beyaz Ağaç
  b.add(Part.Body, box(0.38, 0.32, 0.52), 'sootBlack', [0, 0.82, 0]); // etek
  b.add(Part.Body, box(0.05, 0.85, 0.5), 'team0', [-0.21, 1.0, 0]); // pelerin
  b.add(Part.Head, box(0.2, 0.2, 0.2), 'sand', [0.02, 1.6, 0]);
  b.add(Part.Head, cyl(0.12, 0.17, 0.2, 6), 'silver', [0, 1.73, 0]);
  b.add(Part.Head, cyl(0.21, 0.21, 0.03, 5), 'silver', [0, 1.64, 0]);
  b.add(Part.Head, box(0.03, 0.14, 0.04), 'silver', [0.13, 1.6, 0]); // burun koruması
  arm(b, Part.ArmR, 0.3, 'sootBlack', 'leather');
  b.add(Part.ArmR, box(0.07, 0.06, 0.18), 'gold', [0.06, 0.72, 0.3]); // balçak
  b.add(Part.ArmR, box(0.78, 0.07, 0.04), 'steel', [0.48, 0.72, 0.3], [0, 0, 0.35]); // kılıç
  arm(b, Part.ArmL, -0.3, 'sootBlack', 'leather');
  b.add(Part.ArmL, box(0.06, 0.78, 0.5), 'team0Dark', [0.27, 1.02, -0.36]); // kalkan kenarı
  b.add(Part.ArmL, box(0.05, 0.68, 0.42), 'sootBlack', [0.3, 1.04, -0.36]);
  b.add(Part.ArmL, box(0.02, 0.26, 0.06), 'gondorWhite', [0.33, 1.06, -0.36]);
  b.add(Part.ArmL, box(0.08, 0.36, 0.3), 'sootBlack', [0.28, 0.62, -0.36], [0.785, 0, 0], [1, 0.7, 0.7]); // damla ucu
  return b.build();
};

/**
 * Tower Guard (Citadel muhafızı): martı kanatlı yüksek miğfer — BFME2'nin en tanınır
 * Gondor silueti — gümüş plaka, uzun mızrak (pike), küçük kalkan.
 */
export const towerGuard = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'sootBlack', 'steel');
  b.add(Part.Body, box(0.38, 0.64, 0.52), 'steel', [0, 1.14, 0]);
  b.add(Part.Body, box(0.06, 0.44, 0.44), 'silver', [0.2, 1.2, 0]);
  b.add(Part.Body, box(0.03, 0.22, 0.06), 'gondorWhite', [0.24, 1.2, 0]);
  b.add(Part.Body, box(0.4, 0.36, 0.54), 'sootBlack', [0, 0.8, 0]);
  b.add(Part.Body, box(0.06, 0.95, 0.52), 'team0', [-0.22, 0.98, 0]); // uzun pelerin
  b.add(Part.Body, box(0.34, 0.1, 0.62), 'silver', [0, 1.42, 0]); // omuzluk
  b.add(Part.Head, box(0.2, 0.2, 0.2), 'sand', [0.02, 1.6, 0]);
  b.add(Part.Head, cyl(0.1, 0.16, 0.42, 7), 'silver', [0, 1.83, 0]); // yüksek miğfer
  b.add(Part.Head, box(0.22, 0.05, 0.05), 'silver', [0.03, 1.66, 0]);
  for (const side of [-1, 1]) {
    // Martı kanatları: yanlardan yukarı-dışa açılan ince plakalar.
    b.add(Part.Head, box(0.22, 0.4, 0.03), 'silver', [-0.02, 1.9, side * 0.2], [side * 0.55, 0, 0.2]);
    b.add(
      Part.Head,
      box(0.14, 0.26, 0.03),
      'gondorWhite',
      [-0.05, 2.06, side * 0.28],
      [side * 0.75, 0, 0.25],
    );
  }
  arm(b, Part.ArmR, 0.3, 'steel', 'sootBlack');
  // Pike: ele hafif yukarı açılı, ileri uzanan uzun mızrak (dürtme saldırısı için ileri-geri kayar).
  b.add(Part.ArmR, cyl(0.035, 0.035, 2.9, 5), 'wood', [0.55, 0.85, 0.3], [0, 0, -1.35]);
  b.add(Part.ArmR, new ConeGeometry(0.07, 0.36, 5), 'silver', [2.14, 1.21, 0.3], [0, 0, -1.35]);
  arm(b, Part.ArmL, -0.3, 'steel', 'sootBlack');
  b.add(Part.ArmL, box(0.05, 0.56, 0.38), 'team0Dark', [0.26, 0.98, -0.36]);
  b.add(Part.ArmL, box(0.04, 0.48, 0.3), 'sootBlack', [0.29, 0.99, -0.36]);
  return b.build(1.04);
};

/**
 * Mordor Orc Warrior: kambur, öne eğik gövde, uzun kollar, pas renkli dikenli miğfer,
 * eğri pala ve yamalı yuvarlak kalkan. Takım rengi: bez parçaları + kalkan kenarı.
 */
export const orcWarrior = (): BufferGeometry => {
  const b = new ModelBuilder({ ...HUMAN, neck: 1.36, shoulder: 1.28 });
  legs(b, 'leather', 'dirtDark', 0.15);
  // Kamburluk: gövde öne yatık (z ekseni etrafında -0.35 rad).
  b.add(Part.Body, box(0.4, 0.55, 0.5), 'orcSkin', [0.06, 1.1, 0], [0, 0, -0.35]);
  b.add(Part.Body, box(0.3, 0.4, 0.54), 'rust', [0.02, 1.12, 0], [0, 0, -0.35]); // derme çatma zırh
  b.add(Part.Body, box(0.36, 0.28, 0.5), 'team0Dark', [0, 0.82, 0]); // bez etek
  b.add(Part.Body, box(0.2, 0.25, 0.6), 'orcSkin', [-0.08, 1.36, 0], [0, 0, -0.5]); // kambur sırt
  b.add(Part.Head, box(0.22, 0.2, 0.22), 'orcSkin', [0.16, 1.44, 0]);
  b.add(Part.Head, box(0.06, 0.04, 0.16), 'eyeRed', [0.27, 1.47, 0]);
  b.add(Part.Head, cyl(0.1, 0.16, 0.14, 5), 'rust', [0.14, 1.58, 0]);
  b.add(Part.Head, new ConeGeometry(0.04, 0.18, 4), 'iron', [0.12, 1.72, 0.06], [0.3, 0, 0]);
  b.add(Part.Head, new ConeGeometry(0.04, 0.16, 4), 'iron', [0.1, 1.7, -0.08], [-0.3, 0, 0]);
  arm(b, Part.ArmR, 0.32, 'orcSkin', 'orcSkin', 0.7);
  b.add(Part.ArmR, box(0.5, 0.08, 0.04), 'iron', [0.3, 0.64, 0.32], [0, 0, 0.2]); // pala gövdesi
  b.add(Part.ArmR, box(0.3, 0.1, 0.04), 'iron', [0.66, 0.74, 0.32], [0, 0, 0.6]); // eğri uç
  arm(b, Part.ArmL, -0.32, 'orcSkin', 'orcSkin', 0.7);
  b.add(Part.ArmL, cyl(0.31, 0.31, 0.05, 7), 'team0Dark', [0.24, 0.92, -0.38], [0, 0, Math.PI / 2]);
  b.add(Part.ArmL, cyl(0.26, 0.26, 0.06, 7), 'woodDark', [0.26, 0.92, -0.38], [0, 0, Math.PI / 2]);
  b.add(Part.ArmL, new OctahedronGeometry(0.06, 0), 'iron', [0.3, 0.92, -0.38]);
  return b.build(0.9);
};

/**
 * Uruk-hai: dik, geniş omuzlu, Beyaz El boyalı yüz, kapalı keskin miğfer, büyük siyah
 * kalkan üzerinde Beyaz El, geniş kılıç. Takım rengi: kuşak + kalkan kenarı.
 */
export const urukHai = (): BufferGeometry => {
  const b = new ModelBuilder({ ...HUMAN, shoulderZ: 0.34 });
  legs(b, 'leather', 'ironDark', 0.15);
  b.add(Part.Body, box(0.42, 0.66, 0.6), 'ironDark', [0, 1.14, 0]);
  b.add(Part.Body, box(0.36, 0.14, 0.78), 'iron', [0, 1.42, 0]); // geniş omuzluk
  b.add(Part.Body, box(0.4, 0.34, 0.58), 'urukSkin', [0, 0.82, 0]);
  b.add(Part.Body, box(0.44, 0.08, 0.62), 'team0', [0, 0.98, 0]); // kuşak
  b.add(Part.Body, box(0.06, 0.3, 0.2), 'team0', [0.21, 0.82, 0]);
  b.add(Part.Head, box(0.22, 0.22, 0.22), 'urukSkin', [0.03, 1.62, 0]);
  b.add(Part.Head, box(0.02, 0.12, 0.06), 'whiteHand', [0.15, 1.62, 0.03]); // yüzde Beyaz El
  b.add(Part.Head, box(0.26, 0.14, 0.26), 'ironDark', [0, 1.76, 0]);
  b.add(Part.Head, box(0.14, 0.05, 0.24), 'ironDark', [0.13, 1.7, 0]); // siper
  b.add(Part.Head, new ConeGeometry(0.06, 0.16, 4), 'ironDark', [-0.02, 1.9, 0]);
  arm(b, Part.ArmR, 0.34, 'ironDark', 'urukSkin', 0.64);
  b.add(Part.ArmR, box(0.07, 0.08, 0.2), 'iron', [0.06, 0.7, 0.34]);
  b.add(Part.ArmR, box(0.82, 0.1, 0.05), 'iron', [0.5, 0.76, 0.34], [0, 0, 0.3]); // geniş kılıç
  arm(b, Part.ArmL, -0.34, 'ironDark', 'urukSkin', 0.64);
  b.add(Part.ArmL, box(0.06, 1.0, 0.62), 'team0Dark', [0.28, 0.98, -0.42]); // kalkan kenarı
  b.add(Part.ArmL, box(0.05, 0.9, 0.54), 'sootBlack', [0.31, 1.0, -0.42]);
  // Beyaz El: avuç + 4 parmak + başparmak
  b.add(Part.ArmL, box(0.02, 0.2, 0.18), 'whiteHand', [0.34, 0.98, -0.42]);
  for (let f = 0; f < 4; f++)
    b.add(Part.ArmL, box(0.02, 0.16, 0.035), 'whiteHand', [0.34, 1.16, -0.48 + f * 0.042]);
  b.add(Part.ArmL, box(0.02, 0.12, 0.035), 'whiteHand', [0.34, 1.02, -0.32], [0.7, 0, 0]);
  return b.build(1.08);
};

/**
 * Gondor Archers: Gondor askerinin hafif zırhlı hali — siyah tabard, Beyaz Ağaç, açık miğfer,
 * sırtta sadak, sol elde uzun yay. Yay, kol öne kalktığında (yay germe pozunda) dik durur;
 * dinlenme pozunda kolla birlikte ileri yatık taşınır. Takım rengi: pelerin.
 */
export const gondorArcher = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'sootBlack', 'leather');
  b.add(Part.Body, box(0.34, 0.6, 0.48), 'sootBlack', [0, 1.13, 0]);
  b.add(Part.Body, box(0.06, 0.38, 0.4), 'leather', [0.17, 1.18, 0]);
  b.add(Part.Body, box(0.03, 0.2, 0.1), 'gondorWhite', [0.21, 1.2, 0]);
  b.add(Part.Body, box(0.36, 0.3, 0.5), 'sootBlack', [0, 0.82, 0]);
  b.add(Part.Body, box(0.05, 0.75, 0.46), 'team0', [-0.2, 1.02, 0]); // pelerin
  // Sadak: sırtta çapraz, ok uçları omuz üstünden görünür.
  b.add(Part.Body, cyl(0.07, 0.07, 0.6, 5), 'leather', [-0.24, 1.3, 0.12], [0.35, 0, 0]);
  b.add(Part.Body, box(0.1, 0.12, 0.1), 'gondorWhite', [-0.24, 1.66, 0.24], [0.35, 0, 0]);
  b.add(Part.Head, box(0.2, 0.2, 0.2), 'sand', [0.02, 1.6, 0]);
  b.add(Part.Head, cyl(0.13, 0.17, 0.16, 6), 'steel', [0, 1.72, 0]);
  b.add(Part.Head, cyl(0.2, 0.2, 0.025, 6), 'steel', [0, 1.65, 0]);
  arm(b, Part.ArmR, 0.3, 'sootBlack', 'leather');
  arm(b, Part.ArmL, -0.3, 'sootBlack', 'leather');
  // Uzun yay: elden ileri uzanan, uçları yukarı-aşağı kıvrık üç parça + kiriş.
  const hx = 0.04;
  const hy = 0.72;
  const hz = -0.3;
  b.add(Part.ArmL, box(0.7, 0.05, 0.04), 'woodDark', [hx + 0.02, hy, hz]);
  b.add(Part.ArmL, box(0.55, 0.045, 0.04), 'woodDark', [hx + 0.62, hy - 0.08, hz], [0, 0, -0.3]);
  b.add(Part.ArmL, box(0.55, 0.045, 0.04), 'woodDark', [hx - 0.58, hy - 0.08, hz], [0, 0, 0.3]);
  b.add(Part.ArmL, box(1.6, 0.012, 0.012), 'sand', [hx + 0.02, hy - 0.2, hz]);
  return b.build();
};

/**
 * Isengard koçbaşı (GDD §7.4, Helm's Deep): demir kurt başlı kalın kütük, Uruk taşıyıcılar ve
 * üstte deri kaplı koruma çatısı. SPA: kütük = sağ kol (dürtme animasyonu ileri vurur),
 * taşıyıcı bacakları kendi kalçalarında döner (pivot override), kollar = sol kol.
 */
export const batteringRam = (): BufferGeometry => {
  const b = new ModelBuilder();
  const logY = 1.05;
  // Kütük + demir başlık
  b.add(
    Part.ArmR,
    cyl(0.32, 0.36, 5.6, 7),
    'woodDark',
    [0.4, logY, 0],
    [0, 0, Math.PI / 2],
    [1, 1, 1],
    [0, logY, 0],
  );
  b.add(Part.ArmR, box(0.7, 0.62, 0.62), 'iron', [3.35, logY, 0], [0, 0, 0], [1, 1, 1], [0, logY, 0]);
  b.add(
    Part.ArmR,
    new ConeGeometry(0.3, 0.7, 5),
    'ironDark',
    [3.95, logY, 0],
    [0, 0, -Math.PI / 2],
    [1, 1, 1],
    [0, logY, 0],
  );
  for (const z of [-0.22, 0.22])
    b.add(
      Part.ArmR,
      new ConeGeometry(0.07, 0.4, 4),
      'iron',
      [3.3, logY + 0.42, z],
      [0, 0, -0.5],
      [1, 1, 1],
      [0, logY, 0],
    );
  for (const x of [-1.6, 0.2, 1.8])
    b.add(
      Part.ArmR,
      cyl(0.38, 0.38, 0.14, 7),
      'iron',
      [x, logY, 0],
      [0, 0, Math.PI / 2],
      [1, 1, 1],
      [0, logY, 0],
    );
  // Koruma çatısı: dört direk + iki eğimli deri panel (Body)
  for (const x of [-1.6, 1.6])
    for (const z of [-1.0, 1.0]) b.add(Part.Body, box(0.12, 2.1, 0.12), 'wood', [x, 1.25, z]);
  for (const side of [-1, 1])
    b.add(Part.Body, box(3.8, 0.08, 1.25), 'leather', [0, 2.45, side * 0.55], [side * 0.45, 0, 0]);
  b.add(Part.Body, box(3.9, 0.1, 0.12), 'woodDark', [0, 2.72, 0]);
  // Ak El sancağı (Head: başlık sallanması küçük bir dalgalanma verir)
  b.add(Part.Head, cyl(0.04, 0.04, 1.2, 4), 'wood', [-1.7, 3.2, 0], [0, 0, 0], [1, 1, 1], [-1.7, 2.6, 0]);
  b.add(Part.Head, box(0.5, 0.6, 0.03), 'sootBlack', [-1.45, 3.45, 0], [0, 0, 0], [1, 1, 1], [-1.7, 2.6, 0]);
  b.add(
    Part.Head,
    box(0.16, 0.2, 0.035),
    'whiteHand',
    [-1.45, 3.45, 0],
    [0, 0, 0],
    [1, 1, 1],
    [-1.7, 2.6, 0],
  );
  // Uruk taşıyıcılar: iki yanda ikişer
  for (const cx of [-0.9, 1.1]) {
    for (const side of [-1, 1]) {
      const cz = side * 0.62;
      b.add(Part.Body, box(0.36, 0.55, 0.4), 'urukSkin', [cx, 1.12, cz]);
      b.add(Part.Body, box(0.3, 0.32, 0.44), 'sootBlack', [cx, 0.86, cz]);
      b.add(Part.Body, box(0.22, 0.22, 0.22), 'urukSkin', [cx + 0.06, 1.5, cz]);
      b.add(Part.Body, box(0.24, 0.12, 0.24), 'sootBlack', [cx + 0.04, 1.63, cz]);
      // Kütüğe uzanan kol
      b.add(
        Part.ArmL,
        box(0.13, 0.13, 0.42),
        'urukSkin',
        [cx + 0.15, 1.1, cz - side * 0.3],
        [0, 0, 0],
        [1, 1, 1],
        [cx, 1.25, cz],
      );
      for (const [part, dz] of [
        [Part.LegL, -0.1],
        [Part.LegR, 0.1],
      ] as const) {
        b.add(
          part,
          box(0.15, 0.7, 0.15),
          'sootBlack',
          [cx, 0.38, cz + dz],
          [0, 0, 0],
          [1, 1, 1],
          [cx, 0.72, cz + dz],
        );
      }
    }
  }
  return b.build();
};

/**
 * Aragorn (GDD §8.2): miğfersiz, uzun koyu saç ve sakal, eskimiş yeşil-kahve korucu pelerini,
 * deri yelek, uzun Andúril (parlak çelik + altın balçak). Kalkan yok; sol el boş/hançer.
 * Kahraman okunurluğu için %12 büyük.
 */
export const aragorn = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'woodDark', 'sootBlack');
  b.add(Part.Body, box(0.36, 0.62, 0.48), 'leather', [0, 1.13, 0]);
  b.add(Part.Body, box(0.06, 0.5, 0.4), 'woodDark', [0.18, 1.18, 0]); // yelek
  b.add(Part.Body, box(0.4, 0.1, 0.52), 'sootBlack', [0, 0.86, 0]); // kemer
  b.add(Part.Body, box(0.07, 1.25, 0.6), 'rohanGreen', [-0.22, 0.86, 0]); // uzun pelerin
  b.add(Part.Body, box(0.3, 0.14, 0.62), 'rohanGreen', [-0.05, 1.42, 0]); // pelerin omzu
  b.add(Part.Body, box(0.36, 0.38, 0.5), 'leather', [-0.02, 0.66, 0]); // palto eteği
  b.add(Part.Head, box(0.2, 0.22, 0.2), 'sand', [0.02, 1.61, 0]);
  b.add(Part.Head, box(0.24, 0.26, 0.24), 'urukSkin', [-0.04, 1.66, 0]); // koyu saç
  b.add(Part.Head, box(0.1, 0.32, 0.22), 'urukSkin', [-0.1, 1.48, 0]); // omuza dökülen saç
  b.add(Part.Head, box(0.05, 0.08, 0.16), 'urukSkin', [0.12, 1.53, 0]); // sakal
  arm(b, Part.ArmR, 0.3, 'leather', 'sand');
  b.add(Part.ArmR, box(0.08, 0.06, 0.24), 'gold', [0.06, 0.72, 0.3]); // balçak
  b.add(Part.ArmR, box(1.02, 0.07, 0.04), 'silver', [0.6, 0.72, 0.3], [0, 0, 0.35]); // Andúril
  arm(b, Part.ArmL, -0.3, 'leather', 'sand');
  b.add(Part.ArmL, box(0.32, 0.05, 0.03), 'steel', [0.16, 0.68, -0.3], [0, 0, 0.3]); // hançer
  return b.build(1.12);
};

/**
 * Lurtz (GDD §8.2): miğfersiz Uruk kaptanı — kel kafa, yüzde boydan boya Ak El, çıplak kaslı kollar,
 * deri kemerler, sırtta uzun siyah yay ve sadak, iri pala. Boss okunurluğu için %25 büyük.
 */
export const lurtz = (): BufferGeometry => {
  const b = new ModelBuilder({ ...HUMAN, shoulderZ: 0.36 });
  legs(b, 'leather', 'ironDark', 0.15);
  b.add(Part.Body, box(0.44, 0.64, 0.62), 'urukSkin', [0, 1.14, 0]);
  b.add(Part.Body, box(0.06, 0.66, 0.1), 'leather', [0.23, 1.14, 0.12], [0.6, 0, 0]); // çapraz kayış
  b.add(Part.Body, box(0.42, 0.34, 0.6), 'ironDark', [0, 0.82, 0]); // zırh etek
  b.add(Part.Body, box(0.46, 0.08, 0.64), 'leather', [0, 0.98, 0]);
  b.add(Part.Body, box(0.06, 1.5, 0.06), 'sootBlack', [-0.26, 1.2, 0], [0.4, 0, 0]); // sırtta yay
  b.add(Part.Body, box(0.14, 0.6, 0.14), 'leather', [-0.26, 1.25, -0.12], [-0.3, 0, 0]); // sadak
  b.add(Part.Head, box(0.24, 0.24, 0.24), 'urukSkin', [0.03, 1.63, 0]);
  b.add(Part.Head, box(0.02, 0.2, 0.18), 'whiteHand', [0.16, 1.63, 0]); // yüzde Ak El
  for (let f = 0; f < 3; f++)
    b.add(Part.Head, box(0.02, 0.1, 0.03), 'whiteHand', [0.16, 1.78, -0.05 + f * 0.05]);
  b.add(Part.Head, box(0.05, 0.05, 0.14), 'eyeRed', [0.15, 1.66, 0]);
  arm(b, Part.ArmR, 0.36, 'urukSkin', 'urukSkin', 0.66);
  b.add(Part.ArmR, box(0.1, 0.12, 0.12), 'leather', [0, 1.1, 0.36]); // bileklik
  b.add(Part.ArmR, box(0.08, 0.08, 0.22), 'iron', [0.06, 0.68, 0.36]);
  b.add(Part.ArmR, box(0.95, 0.13, 0.05), 'iron', [0.58, 0.76, 0.36], [0, 0, 0.3]); // iri pala
  arm(b, Part.ArmL, -0.36, 'urukSkin', 'urukSkin', 0.66);
  b.add(Part.ArmL, box(0.1, 0.12, 0.12), 'leather', [0, 1.1, -0.36]);
  b.add(Part.ArmL, box(0.3, 0.06, 0.04), 'iron', [0.15, 0.68, -0.36], [0, 0, 0.4]); // hançer
  return b.build(1.25);
};

/**
 * Lothlórien okçusu (GDD §7.2): miğfersiz, uzun altın saç, gri-yeşil elf pelerini, gümüş
 * tunik, insan yayından uzun zarif yay. Gondor okçusundan ince ve uzun siluet.
 */
export const lorienArcher = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'rohanGreen', 'leather');
  b.add(Part.Body, box(0.3, 0.62, 0.44), 'silver', [0, 1.14, 0]);
  b.add(Part.Body, box(0.06, 0.4, 0.36), 'steel', [0.16, 1.2, 0]);
  b.add(Part.Body, box(0.32, 0.36, 0.46), 'rohanGreen', [0, 0.8, 0]);
  b.add(Part.Body, box(0.05, 1.05, 0.52), 'rohanGreen', [-0.2, 0.95, 0]); // uzun pelerin
  b.add(Part.Body, cyl(0.06, 0.06, 0.62, 5), 'leather', [-0.23, 1.32, 0.12], [0.35, 0, 0]); // sadak
  b.add(Part.Body, box(0.08, 0.1, 0.08), 'silver', [-0.23, 1.68, 0.24], [0.35, 0, 0]);
  b.add(Part.Head, box(0.19, 0.21, 0.18), 'sand', [0.02, 1.62, 0]);
  b.add(Part.Head, box(0.22, 0.12, 0.22), 'gold', [-0.01, 1.74, 0]); // altın saç
  b.add(Part.Head, box(0.08, 0.36, 0.2), 'gold', [-0.1, 1.52, 0]); // omuza dökülen saç
  arm(b, Part.ArmR, 0.28, 'silver', 'sand');
  arm(b, Part.ArmL, -0.28, 'silver', 'sand');
  const hx = 0.04;
  const hy = 0.72;
  const hz = -0.28;
  b.add(Part.ArmL, box(0.8, 0.045, 0.035), 'wood', [hx + 0.02, hy, hz]);
  b.add(Part.ArmL, box(0.66, 0.04, 0.035), 'wood', [hx + 0.72, hy - 0.12, hz], [0, 0, -0.38]);
  b.add(Part.ArmL, box(0.66, 0.04, 0.035), 'wood', [hx - 0.68, hy - 0.12, hz], [0, 0, 0.38]);
  b.add(Part.ArmL, box(1.9, 0.012, 0.012), 'silver', [hx + 0.02, hy - 0.26, hz]);
  return b.build(1.04);
};

/**
 * Rohirrim (GDD §7.1): kahverengi at, siyah yele; üstünde yeşil tunikli, zincir zırhlı, at kılı
 * sorguçlu miğferli süvari, uzun mızrak ve yeşil yuvarlak kalkan. Atın çapraz bacak çiftleri
 * LegL/LegR olarak kendi omuz/kalçalarında döner (dörtnal); mızrak sağ kol (dürtme).
 */
export const rohirrim = (): BufferGeometry => {
  const b = new ModelBuilder();
  // At gövdesi, boyun, baş, kuyruk
  b.add(Part.Body, box(1.9, 0.72, 0.56), 'woodDark', [0, 1.38, 0]);
  b.add(Part.Body, box(0.5, 0.95, 0.36), 'woodDark', [0.95, 1.8, 0], [0, 0, -0.55]);
  b.add(Part.Body, box(0.62, 0.3, 0.3), 'woodDark', [1.42, 2.08, 0], [0, 0, 0.35]);
  b.add(Part.Body, box(0.5, 0.18, 0.1), 'sootBlack', [0.88, 2.05, 0], [0, 0, -0.55]); // yele
  b.add(Part.Body, box(0.18, 0.7, 0.14), 'sootBlack', [-1.05, 1.2, 0], [0, 0, 0.35]); // kuyruk
  b.add(Part.Body, box(0.7, 0.08, 0.64), 'team0', [-0.05, 1.76, 0]); // eyer örtüsü
  // Atın bacakları: ön-sol + arka-sağ = LegL, ön-sağ + arka-sol = LegR
  for (const [part, x, z] of [
    [Part.LegL, 0.72, -0.18],
    [Part.LegR, -0.72, -0.18],
    [Part.LegR, 0.72, 0.18],
    [Part.LegL, -0.72, 0.18],
  ] as const) {
    b.add(part, box(0.16, 1.05, 0.16), 'woodDark', [x, 0.55, z], [0, 0, 0], [1, 1, 1], [x, 1.1, z]);
    b.add(part, box(0.2, 0.1, 0.2), 'sootBlack', [x, 0.05, z], [0, 0, 0], [1, 1, 1], [x, 1.1, z]);
  }
  // Süvari
  b.add(Part.Body, box(0.34, 0.58, 0.42), 'rohanGreen', [-0.05, 2.2, 0]);
  b.add(Part.Body, box(0.36, 0.3, 0.44), 'steel', [-0.05, 2.32, 0]); // zincir zırh
  b.add(Part.Body, box(0.05, 0.75, 0.44), 'team0', [-0.24, 2.05, 0]); // pelerin
  for (const z of [-0.3, 0.3])
    b.add(Part.Body, box(0.4, 0.16, 0.14), 'leather', [0.1, 1.85, z], [0, 0, -0.4]); // bacaklar
  const neck: V3 = [-0.05, 2.5, 0];
  b.add(Part.Head, box(0.2, 0.2, 0.2), 'sand', [-0.03, 2.62, 0], [0, 0, 0], [1, 1, 1], neck);
  b.add(Part.Head, cyl(0.12, 0.15, 0.2, 6), 'silver', [-0.05, 2.76, 0], [0, 0, 0], [1, 1, 1], neck);
  b.add(Part.Head, box(0.36, 0.08, 0.06), 'sand', [-0.24, 2.84, 0], [0, 0, 0.5], [1, 1, 1], neck); // at kılı sorguç
  const shR: V3 = [-0.05, 2.42, 0.26];
  const shL: V3 = [-0.05, 2.42, -0.26];
  b.add(Part.ArmR, box(0.13, 0.5, 0.13), 'rohanGreen', [0, 2.2, 0.26], [0, 0, 0], [1, 1, 1], shR);
  b.add(Part.ArmR, cyl(0.03, 0.03, 3.2, 5), 'wood', [0.75, 2.05, 0.3], [0, 0, -1.45], [1, 1, 1], shR); // mızrak
  b.add(
    Part.ArmR,
    new ConeGeometry(0.06, 0.32, 4),
    'silver',
    [2.36, 2.1, 0.3],
    [0, 0, -1.45],
    [1, 1, 1],
    shR,
  );
  b.add(Part.ArmL, box(0.13, 0.5, 0.13), 'rohanGreen', [0, 2.2, -0.26], [0, 0, 0], [1, 1, 1], shL);
  b.add(
    Part.ArmL,
    cyl(0.3, 0.3, 0.05, 7),
    'rohanGreen',
    [0.05, 2.15, -0.4],
    [Math.PI / 2, 0, 0],
    [1, 1, 1],
    shL,
  );
  b.add(
    Part.ArmL,
    cyl(0.08, 0.08, 0.07, 6),
    'gold',
    [0.05, 2.15, -0.43],
    [Math.PI / 2, 0, 0],
    [1, 1, 1],
    shL,
  );
  return b.build();
};

/**
 * Mordor Ork okçusu (BFME2): ork savaşçısının kambur silueti, paçavra başlık, kalkansız;
 * sol elde kaba kısa yay, sırtta sadak. Takım rengi: bez etek + başlık.
 */
export const orcArcher = (): BufferGeometry => {
  const b = new ModelBuilder({ ...HUMAN, neck: 1.36, shoulder: 1.28 });
  legs(b, 'leather', 'dirtDark', 0.15);
  b.add(Part.Body, box(0.38, 0.55, 0.48), 'orcSkin', [0.06, 1.1, 0], [0, 0, -0.35]);
  b.add(Part.Body, box(0.28, 0.38, 0.5), 'leather', [0.02, 1.12, 0], [0, 0, -0.35]); // deri yelek
  b.add(Part.Body, box(0.36, 0.28, 0.5), 'team0Dark', [0, 0.82, 0]);
  b.add(Part.Body, box(0.2, 0.25, 0.56), 'orcSkin', [-0.08, 1.36, 0], [0, 0, -0.5]);
  b.add(Part.Body, cyl(0.07, 0.07, 0.55, 5), 'woodDark', [-0.2, 1.3, 0.12], [0.35, 0, -0.3]); // sadak
  b.add(Part.Body, box(0.08, 0.12, 0.1), 'rust', [-0.28, 1.6, 0.22], [0.35, 0, -0.3]); // ok yeleleri
  b.add(Part.Head, box(0.22, 0.2, 0.22), 'orcSkin', [0.16, 1.44, 0]);
  b.add(Part.Head, box(0.06, 0.04, 0.16), 'eyeRed', [0.27, 1.47, 0]);
  b.add(Part.Head, box(0.26, 0.16, 0.28), 'team0', [0.1, 1.58, 0], [0, 0, 0.25]); // paçavra başlık
  b.add(Part.Head, box(0.16, 0.08, 0.06), 'orcSkin', [0.12, 1.5, 0.15], [0, 0.4, 0]); // sivri kulak
  b.add(Part.Head, box(0.16, 0.08, 0.06), 'orcSkin', [0.12, 1.5, -0.15], [0, -0.4, 0]);
  arm(b, Part.ArmR, 0.3, 'orcSkin', 'orcSkin', 0.68);
  arm(b, Part.ArmL, -0.3, 'orcSkin', 'orcSkin', 0.68);
  // Kaba kısa yay: iki eğri kol + kiriş.
  const hx = 0.04;
  const hy = 0.66;
  const hz = -0.3;
  b.add(Part.ArmL, box(0.42, 0.06, 0.05), 'woodDark', [hx + 0.24, hy - 0.04, hz], [0, 0, -0.25]);
  b.add(Part.ArmL, box(0.42, 0.06, 0.05), 'woodDark', [hx - 0.2, hy - 0.04, hz], [0, 0, 0.25]);
  b.add(Part.ArmL, box(0.9, 0.012, 0.012), 'sand', [hx + 0.02, hy - 0.14, hz]);
  return b.build(0.9);
};

/**
 * Isengard Warg binicisi (BFME2): iri, kamburlu gri-kahve kurt (kısa bacak, uzun gövde, büyük
 * çene, dik kulaklar) ve üstünde eğri kılıçlı ork binici. Kurdun çapraz bacak çiftleri
 * LegL/LegR (koşu); binici kılıcı sağ kol.
 */
export const wargRider = (): BufferGeometry => {
  const b = new ModelBuilder();
  // Kurt: omuzda yüksek, kalçada alçak (sırt eğimi), kalın boyun, iri baş.
  b.add(Part.Body, box(1.5, 0.66, 0.6), 'rockDark', [0, 1.0, 0], [0, 0, 0.12]);
  b.add(Part.Body, box(0.6, 0.62, 0.66), 'dirtDark', [0.5, 1.14, 0], [0, 0, 0.12]); // yeleli omuz
  b.add(Part.Body, box(0.5, 0.42, 0.4), 'rockDark', [0.98, 1.22, 0], [0, 0, 0.3]); // boyun
  b.add(Part.Body, box(0.46, 0.34, 0.36), 'rockDark', [1.3, 1.24, 0]); // kafa
  b.add(Part.Body, box(0.36, 0.14, 0.26), 'rockDark', [1.6, 1.16, 0]); // üst çene
  b.add(Part.Body, box(0.3, 0.08, 0.22), 'sootBlack', [1.56, 1.04, 0], [0, 0, -0.2]); // alt çene
  b.add(Part.Body, box(0.04, 0.06, 0.2), 'gondorWhite', [1.66, 1.09, 0]); // dişler
  b.add(Part.Body, box(0.06, 0.04, 0.3), 'eyeRed', [1.42, 1.32, 0]);
  for (const z of [-0.12, 0.12]) b.add(Part.Body, new ConeGeometry(0.07, 0.2, 4), 'dirtDark', [1.2, 1.48, z]); // kulak
  b.add(Part.Body, box(0.6, 0.12, 0.12), 'rockDark', [-0.94, 1.04, 0], [0, 0, 0.6]); // kuyruk
  b.add(Part.Body, box(0.56, 0.06, 0.62), 'team0Dark', [0.05, 1.36, 0], [0, 0, 0.12]); // eyer postu
  for (const [part, x, z] of [
    [Part.LegL, 0.52, -0.2],
    [Part.LegR, -0.55, -0.2],
    [Part.LegR, 0.52, 0.2],
    [Part.LegL, -0.55, 0.2],
  ] as const) {
    const hip: V3 = [x, 0.92, z];
    b.add(part, box(0.18, 0.84, 0.18), 'rockDark', [x, 0.44, z], [0, 0, 0], [1, 1, 1], hip);
    b.add(part, box(0.24, 0.08, 0.2), 'sootBlack', [x + 0.04, 0.04, z], [0, 0, 0], [1, 1, 1], hip);
  }
  // Ork binici
  b.add(Part.Body, box(0.32, 0.5, 0.4), 'orcSkin', [0, 1.7, 0], [0, 0, -0.2]);
  b.add(Part.Body, box(0.34, 0.26, 0.42), 'rust', [0, 1.78, 0], [0, 0, -0.2]);
  b.add(Part.Body, box(0.05, 0.5, 0.4), 'team0', [-0.2, 1.62, 0]); // pelerin
  for (const z of [-0.28, 0.28])
    b.add(Part.Body, box(0.36, 0.14, 0.13), 'leather', [0.12, 1.4, z], [0, 0, -0.5]);
  const neck: V3 = [0.06, 1.98, 0];
  b.add(Part.Head, box(0.2, 0.19, 0.2), 'orcSkin', [0.12, 2.06, 0], [0, 0, 0], [1, 1, 1], neck);
  b.add(Part.Head, cyl(0.1, 0.15, 0.14, 5), 'iron', [0.1, 2.18, 0], [0, 0, 0], [1, 1, 1], neck);
  b.add(Part.Head, new ConeGeometry(0.04, 0.18, 4), 'iron', [0.08, 2.32, 0], [0, 0, 0], [1, 1, 1], neck);
  const shR: V3 = [0.02, 1.9, 0.24];
  const shL: V3 = [0.02, 1.9, -0.24];
  b.add(Part.ArmR, box(0.12, 0.48, 0.12), 'orcSkin', [0.02, 1.68, 0.24], [0, 0, 0], [1, 1, 1], shR);
  b.add(Part.ArmR, box(0.7, 0.08, 0.04), 'iron', [0.3, 1.46, 0.28], [0, 0, 0.35], [1, 1, 1], shR); // pala
  b.add(Part.ArmR, box(0.26, 0.1, 0.04), 'iron', [0.66, 1.62, 0.28], [0, 0, 0.8], [1, 1, 1], shR);
  b.add(Part.ArmL, box(0.12, 0.44, 0.12), 'orcSkin', [0.06, 1.7, -0.24], [0, 0, -0.5], [1, 1, 1], shL); // dizgin
  return b.build();
};

/**
 * Mordor mağara trolü (BFME2): ~4 m, kambur, gri taşsı deri, küçük baş, uzun kollar,
 * iri dikenli sopa, belde zincir ve bez. Takım rengi: bel bezi + kol bağı.
 */
export const caveTroll = (): BufferGeometry => {
  const b = new ModelBuilder({ hip: 1.3, shoulder: 2.45, neck: 2.5, shoulderZ: 0.72, hipZ: 0.38 });
  for (const [part, z] of [
    [Part.LegL, -0.38],
    [Part.LegR, 0.38],
  ] as const) {
    b.add(part, box(0.46, 0.8, 0.46), 'rock', [0, 0.92, z]); // kalın uyluk
    b.add(part, box(0.4, 0.6, 0.4), 'rock', [0.02, 0.36, z]);
    b.add(part, box(0.58, 0.14, 0.46), 'rockDark', [0.1, 0.07, z]); // geniş ayak
  }
  b.add(Part.Body, box(1.0, 0.62, 1.1), 'rock', [0, 1.5, 0]); // göbek
  b.add(Part.Body, box(1.0, 0.9, 1.4), 'rock', [0.1, 2.1, 0], [0, 0, -0.3]); // öne yatık gövde
  b.add(Part.Body, box(0.6, 0.5, 1.0), 'rockDark', [-0.3, 2.5, 0], [0, 0, -0.5]); // kambur sırt
  b.add(Part.Body, box(1.06, 0.4, 1.16), 'team0Dark', [0, 1.26, 0]); // bel bezi
  b.add(Part.Body, box(1.1, 0.08, 1.2), 'iron', [0, 1.48, 0]); // zincir kuşak
  b.add(Part.Head, box(0.42, 0.38, 0.44), 'rock', [0.42, 2.58, 0]);
  b.add(Part.Head, box(0.2, 0.16, 0.34), 'rockDark', [0.62, 2.48, 0]); // çene
  b.add(Part.Head, box(0.06, 0.05, 0.28), 'eyeRed', [0.63, 2.64, 0]);
  for (const z of [-0.2, 0.2])
    b.add(Part.Head, new ConeGeometry(0.04, 0.12, 4), 'gondorWhite', [0.7, 2.5, z * 0.5], [0, 0, -1.2]); // diş
  const armT = (part: PartId, z: number) => {
    b.add(part, box(0.42, 0.72, 0.42), 'rock', [0, 2.06, z]);
    b.add(part, box(0.36, 0.72, 0.36), 'rock', [0.04, 1.36, z]);
    b.add(part, box(0.42, 0.3, 0.42), 'rockDark', [0.06, 0.88, z]); // iri el
  };
  armT(Part.ArmR, 0.72);
  b.add(Part.ArmR, box(0.2, 0.12, 0.44), 'team0', [0, 2.22, 0.72]); // kol bağı
  b.add(Part.ArmR, cyl(0.12, 0.22, 1.7, 6), 'woodDark', [0.7, 0.98, 0.76], [0, 0, -1.25]); // sopa
  for (let k = 0; k < 3; k++)
    b.add(
      Part.ArmR,
      new ConeGeometry(0.05, 0.18, 4),
      'iron',
      [1.2 + k * 0.16, 1.18 - k * 0.04, 0.76],
      [0, 0, 0.3],
    );
  armT(Part.ArmL, -0.72);
  return b.build();
};

/** Birim tipi id → model üreticisi (UNIT_DEFS ile aynı sıra). */
export const UNIT_MODELS: Record<number, () => BufferGeometry> = {
  0: gondorSoldier,
  1: orcWarrior,
  2: towerGuard,
  3: urukHai,
  4: gondorArcher,
  5: batteringRam,
  6: aragorn,
  7: lurtz,
  8: lorienArcher,
  9: rohirrim,
  // Ölüler Ordusu: Gondor askeri silueti, hayalet materyaliyle (UnitRenderer).
  10: gondorSoldier,
  11: orcArcher,
  12: wargRider,
  13: caveTroll,
};
