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
  // Beyaz Ağaç arması: gövde, iki çift dal ve üstte taç.
  b.add(Part.ArmL, box(0.02, 0.26, 0.05), 'gondorWhite', [0.33, 1.04, -0.36]);
  for (const [y, w, ang] of [
    [1.12, 0.13, 0.55],
    [1.04, 0.1, 0.5],
  ] as const)
    for (const sz of [-1, 1])
      b.add(
        Part.ArmL,
        box(0.02, 0.025, w),
        'gondorWhite',
        [0.33, y, -0.36 + sz * w * 0.45],
        [sz * ang, 0, 0],
      );
  b.add(Part.ArmL, box(0.02, 0.05, 0.1), 'gondorWhite', [0.33, 1.25, -0.36]);
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
  // Sauron'un Gözü arması: kızıl badem göz, kor bebek.
  b.add(Part.ArmL, box(0.02, 0.1, 0.26), 'eyeRed', [0.3, 0.98, -0.38]);
  b.add(Part.ArmL, box(0.025, 0.16, 0.05), 'ember', [0.31, 0.98, -0.38]);
  b.add(Part.ArmL, box(0.03, 0.12, 0.02), 'sootBlack', [0.32, 0.98, -0.38]);
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
const wargRiderBuilder = (hero = false): ModelBuilder => {
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
  if (hero) {
    // Sharku: kemik omuzluklar, kafatası miğfer tüyü, kurdun yelesinde kemik takılar ve kırmızı bez.
    for (const z of [-0.26, 0.26]) {
      b.add(
        Part.Body,
        new ConeGeometry(0.1, 0.32, 4),
        'gondorWhite',
        [0.02, 1.98, z],
        [z > 0 ? 0.7 : -0.7, 0, 0],
      );
      b.add(Part.Body, box(0.22, 0.08, 0.16), 'gondorWhite', [0.02, 1.9, z]);
    }
    b.add(Part.Head, box(0.06, 0.24, 0.24), 'eyeRed', [-0.06, 2.34, 0], [0, 0, 0], [1, 1, 1], neck); // tüy
    b.add(Part.Head, box(0.14, 0.1, 0.18), 'gondorWhite', [0.18, 2.14, 0], [0, 0, 0], [1, 1, 1], neck); // kafatası maske
    for (const x of [0.36, 0.56, 0.76])
      b.add(Part.Body, new ConeGeometry(0.05, 0.22, 4), 'gondorWhite', [x, 1.5, 0], [0, 0, -0.3]); // yele takıları
    b.add(Part.Body, box(0.5, 0.3, 0.64), 'team0', [-0.2, 1.2, 0], [0, 0, 0.12]); // eyer örtüsü
  }
  return b;
};

export const wargRider = (): BufferGeometry => wargRiderBuilder().build();

/** Sharku (Isengard kahramanı): iri, yaşlı warg ve kemik zırhlı binicisi. */
export const sharku = (): BufferGeometry => wargRiderBuilder(true).build(1.25);

/**
 * Saruman (BFME2): Ak Divan'ın başı — yere değen beyaz cüppe, gümüş kuşak, uzun beyaz saç ve
 * sakal, sağda siyah-beyaz Orthanc asası (dört çatallı başlık içinde kristal küre).
 */
export const saruman = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'gondorWhite', 'sootBlack');
  b.add(Part.Body, cyl(0.26, 0.46, 0.98, 8), 'snow', [0, 0.5, 0]);
  b.add(Part.Body, box(0.38, 0.64, 0.5), 'snow', [0, 1.13, 0]);
  b.add(Part.Body, box(0.06, 0.66, 0.16), 'silver', [0.2, 1.1, 0]); // ön şerit
  b.add(Part.Body, box(0.42, 0.07, 0.54), 'silver', [0, 0.92, 0]); // kuşak
  b.add(Part.Body, box(0.08, 1.4, 0.7), 'gondorWhite', [-0.23, 0.84, 0]); // pelerin
  b.add(Part.Body, box(0.2, 0.1, 0.62), 'silver', [-0.04, 1.42, 0]); // omuz yakası
  b.add(Part.Head, box(0.2, 0.22, 0.2), 'sand', [0.02, 1.62, 0]);
  b.add(Part.Head, box(0.24, 0.26, 0.25), 'snow', [-0.05, 1.69, 0]); // saç
  b.add(Part.Head, box(0.1, 0.5, 0.26), 'snow', [-0.1, 1.42, 0]); // sırta dökülen saç
  b.add(Part.Head, box(0.08, 0.46, 0.18), 'snow', [0.13, 1.32, 0], [0, 0, 0.08]); // çatallı uzun sakal
  arm(b, Part.ArmR, 0.31, 'snow', 'sand');
  b.add(Part.ArmR, cyl(0.04, 0.04, 2.2, 5), 'sootBlack', [0.12, 1.12, 0.34]); // Orthanc asası
  for (const [dx, dz] of [
    [0.07, 0],
    [-0.07, 0],
    [0, 0.07],
    [0, -0.07],
  ] as const)
    b.add(Part.ArmR, box(0.03, 0.3, 0.03), 'sootBlack', [0.12 + dx, 2.32, 0.34 + dz], [dz * 4, 0, -dx * 4]);
  b.add(Part.ArmR, new OctahedronGeometry(0.09, 1), 'magic', [0.12, 2.3, 0.34]); // kristal
  arm(b, Part.ArmL, -0.31, 'snow', 'sand');
  b.add(Part.ArmL, box(0.04, 0.12, 0.08), 'eyeRed', [0.06, 0.74, -0.31]); // yüzük
  return b.build(1.12);
};

/** Uruk arbaletçisi: Uruk zırhı, açık miğfer, iki elde ağır arbalet, sırtta cıvata kılıfı. */
export const urukCrossbow = (): BufferGeometry => {
  const b = new ModelBuilder({ ...HUMAN, shoulderZ: 0.34 });
  legs(b, 'leather', 'ironDark', 0.15);
  b.add(Part.Body, box(0.42, 0.64, 0.58), 'ironDark', [0, 1.14, 0]);
  b.add(Part.Body, box(0.4, 0.34, 0.56), 'urukSkin', [0, 0.82, 0]);
  b.add(Part.Body, box(0.44, 0.08, 0.6), 'team0', [0, 0.98, 0]);
  b.add(Part.Body, box(0.14, 0.62, 0.16), 'leather', [-0.27, 1.22, 0.12], [-0.25, 0, 0]); // cıvata kılıfı
  b.add(Part.Head, box(0.22, 0.22, 0.22), 'urukSkin', [0.03, 1.62, 0]);
  b.add(Part.Head, box(0.02, 0.12, 0.06), 'whiteHand', [0.15, 1.62, 0.03]);
  b.add(Part.Head, box(0.24, 0.1, 0.24), 'ironDark', [0, 1.75, 0]);
  arm(b, Part.ArmR, 0.34, 'ironDark', 'urukSkin', 0.62);
  arm(b, Part.ArmL, -0.34, 'ironDark', 'urukSkin', 0.62);
  // Arbalet: sol elde gövde, üstte yay kolu.
  b.add(Part.ArmL, box(0.7, 0.08, 0.08), 'woodDark', [0.32, 0.82, -0.34]);
  b.add(Part.ArmL, box(0.06, 0.05, 0.7), 'iron', [0.6, 0.86, -0.34]);
  b.add(Part.ArmL, box(0.04, 0.03, 0.04), 'iron', [0.66, 0.9, -0.34]);
  return b.build(1.05);
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

/**
 * Beyaz Gandalf (BFME2): yere kadar beyaz cüppe, uzun beyaz saç ve sakal, sol elde başı parlayan
 * beyaz asa, sağ elde Glamdring. Siluet: konik cüppe eteği + uzun asa.
 */
export const gandalf = (): BufferGeometry => {
  const b = new ModelBuilder();
  // Cüppe eteği bacakları örter (bacaklar yine de yürüyüşte hafif görünür).
  legs(b, 'gondorWhite', 'silver');
  b.add(Part.Body, cyl(0.24, 0.42, 0.95, 7), 'gondorWhite', [0, 0.5, 0]);
  b.add(Part.Body, box(0.36, 0.62, 0.48), 'gondorWhite', [0, 1.13, 0]);
  b.add(Part.Body, box(0.4, 0.08, 0.52), 'silver', [0, 0.9, 0]); // kuşak
  b.add(Part.Body, box(0.07, 1.3, 0.62), 'snow', [-0.22, 0.82, 0]); // pelerin
  b.add(Part.Head, box(0.2, 0.22, 0.2), 'sand', [0.02, 1.61, 0]);
  b.add(Part.Head, box(0.24, 0.24, 0.24), 'snow', [-0.04, 1.68, 0]); // beyaz saç
  b.add(Part.Head, box(0.1, 0.42, 0.24), 'snow', [-0.1, 1.45, 0]); // omuza dökülen saç
  b.add(Part.Head, box(0.08, 0.32, 0.16), 'snow', [0.12, 1.42, 0]); // uzun sakal
  arm(b, Part.ArmR, 0.3, 'gondorWhite', 'sand');
  b.add(Part.ArmR, box(0.08, 0.06, 0.22), 'gold', [0.06, 0.72, 0.3]);
  b.add(Part.ArmR, box(0.9, 0.07, 0.04), 'magic', [0.55, 0.72, 0.3], [0, 0, 0.35]); // Glamdring
  arm(b, Part.ArmL, -0.3, 'gondorWhite', 'sand');
  b.add(Part.ArmL, cyl(0.035, 0.035, 2.0, 5), 'gondorWhite', [0.12, 1.1, -0.34]); // asa
  b.add(Part.ArmL, new OctahedronGeometry(0.11, 0), 'magic', [0.12, 2.14, -0.34]); // asa başı
  b.add(Part.ArmL, box(0.05, 0.22, 0.05), 'gondorWhite', [0.12, 2.0, -0.26], [0.5, 0, 0]);
  b.add(Part.ArmL, box(0.05, 0.22, 0.05), 'gondorWhite', [0.12, 2.0, -0.42], [-0.5, 0, 0]);
  return b.build(1.12);
};

/**
 * Legolas (BFME2): ince ve uzun elf siluet, uzun sarı saç, yeşil-kahve tunik, sırtta sadak ve iki
 * hançer, Galadhrim uzun yayı.
 */
export const legolas = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'woodDark', 'leather');
  b.add(Part.Body, box(0.3, 0.62, 0.42), 'rohanGreen', [0, 1.14, 0]);
  b.add(Part.Body, box(0.06, 0.44, 0.34), 'leather', [0.16, 1.18, 0]); // deri yelek
  b.add(Part.Body, box(0.32, 0.34, 0.44), 'rohanGreen', [0, 0.8, 0]);
  b.add(Part.Body, box(0.34, 0.07, 0.46), 'leather', [0, 0.97, 0]);
  b.add(Part.Body, cyl(0.06, 0.06, 0.64, 5), 'leather', [-0.22, 1.32, 0.12], [0.35, 0, 0]); // sadak
  b.add(Part.Body, box(0.08, 0.1, 0.08), 'silver', [-0.22, 1.7, 0.25], [0.35, 0, 0]);
  for (const z of [-0.08, 0.08])
    b.add(Part.Body, box(0.04, 0.42, 0.05), 'silver', [-0.22, 1.36, z], [z * 4, 0, 0]); // ikiz hançer
  b.add(Part.Head, box(0.19, 0.21, 0.18), 'sand', [0.02, 1.62, 0]);
  b.add(Part.Head, box(0.22, 0.1, 0.22), 'gold', [-0.01, 1.74, 0]);
  b.add(Part.Head, box(0.08, 0.46, 0.2), 'gold', [-0.11, 1.48, 0]); // uzun sarı saç
  arm(b, Part.ArmR, 0.28, 'rohanGreen', 'sand');
  arm(b, Part.ArmL, -0.28, 'rohanGreen', 'sand');
  const hx = 0.04;
  const hy = 0.72;
  const hz = -0.28;
  b.add(Part.ArmL, box(0.84, 0.045, 0.035), 'wood', [hx + 0.02, hy, hz]);
  b.add(Part.ArmL, box(0.7, 0.04, 0.035), 'wood', [hx + 0.75, hy - 0.13, hz], [0, 0, -0.4]);
  b.add(Part.ArmL, box(0.7, 0.04, 0.035), 'wood', [hx - 0.71, hy - 0.13, hz], [0, 0, 0.4]);
  b.add(Part.ArmL, box(2.0, 0.012, 0.012), 'silver', [hx + 0.02, hy - 0.28, hz]);
  return b.build(1.06);
};

/**
 * Balrog (BFME2, Moria): ~6 m kambur ateş iblisi — kömür karası gövde, kızgın çatlaklar, boynuzlar,
 * alevli yele, geniş gölge kanatlar; sağ elde alev kılıcı, sol elde kırbaç.
 */
export const balrog = (): BufferGeometry => {
  const b = new ModelBuilder({ hip: 2.0, shoulder: 3.7, neck: 3.8, shoulderZ: 1.05, hipZ: 0.5 });
  for (const [part, z] of [
    [Part.LegL, -0.5],
    [Part.LegR, 0.5],
  ] as const) {
    b.add(part, box(0.6, 1.1, 0.6), 'sootBlack', [0, 1.45, z]);
    b.add(part, box(0.5, 0.9, 0.5), 'sootBlack', [0.12, 0.5, z], [0, 0, 0.15]);
    b.add(part, box(0.8, 0.16, 0.5), 'ember', [0.25, 0.08, z]); // kızgın pençe
  }
  b.add(Part.Body, box(1.2, 1.0, 1.4), 'sootBlack', [0, 2.3, 0]);
  b.add(Part.Body, box(1.3, 1.2, 1.9), 'sootBlack', [0.2, 3.1, 0], [0, 0, -0.25]);
  b.add(Part.Body, box(0.1, 0.9, 1.2), 'fire', [0.86, 3.0, 0], [0, 0, -0.25]); // göğüs çatlağı
  b.add(Part.Body, box(0.08, 0.5, 0.2), 'ember', [0.6, 2.3, 0.3]);
  b.add(Part.Body, box(0.08, 0.5, 0.2), 'ember', [0.6, 2.3, -0.3]);
  // Gölge kanatlar
  for (const sz of [-1, 1]) {
    b.add(Part.Body, box(0.12, 1.6, 2.4), 'ironDark', [-0.6, 4.2, sz * 1.9], [sz * 0.5, 0, 0.3]);
    b.add(Part.Body, box(0.1, 1.1, 1.6), 'sootBlack', [-0.9, 3.4, sz * 2.8], [sz * 0.8, 0, 0.3]);
  }
  // Baş, boynuzlar, alevli yele
  b.add(Part.Head, box(0.6, 0.6, 0.62), 'sootBlack', [0.7, 3.95, 0]);
  b.add(Part.Head, box(0.1, 0.1, 0.42), 'fire', [1.0, 4.02, 0]); // gözler
  b.add(Part.Head, box(0.12, 0.16, 0.36), 'ember', [1.0, 3.72, 0]); // ağız
  for (const z of [-0.26, 0.26]) {
    b.add(Part.Head, new ConeGeometry(0.11, 0.9, 5), 'ironDark', [0.55, 4.5, z * 1.5], [z * 2, 0, -0.5]);
  }
  b.add(Part.Head, new ConeGeometry(0.45, 1.3, 6), 'fire', [0.2, 4.55, 0], [0, 0, 0.6]);
  b.add(Part.Head, new ConeGeometry(0.3, 0.9, 5), 'ember', [-0.1, 4.4, 0], [0, 0, 0.9]);
  // Kollar
  const armB = (part: PartId, z: number) => {
    b.add(part, box(0.5, 0.9, 0.5), 'sootBlack', [0, 3.2, z]);
    b.add(part, box(0.42, 0.9, 0.42), 'sootBlack', [0.06, 2.35, z]);
    b.add(part, box(0.46, 0.3, 0.46), 'ember', [0.08, 1.8, z]);
  };
  armB(Part.ArmR, 1.05);
  b.add(Part.ArmR, box(2.4, 0.16, 0.08), 'fire', [1.1, 1.85, 1.1], [0, 0, 0.35]); // alev kılıcı
  b.add(Part.ArmR, box(1.6, 0.3, 0.06), 'ember', [1.3, 2.0, 1.1], [0, 0, 0.35]);
  armB(Part.ArmL, -1.05);
  for (let k = 0; k < 4; k++)
    b.add(
      Part.ArmL,
      box(0.6, 0.06, 0.06),
      'fire',
      [0.3 + k * 0.5, 1.7 - k * 0.32, -1.1],
      [0, 0, -0.6 + k * 0.1],
    ); // kırbaç
  return b.build(1.15);
};

/**
 * Uruk merdiven takımı (BFME2 Isengard, Helm's Deep): dört Uruk omuzlarında uzun ahşap kuşatma
 * merdivenini taşır. SPA: merdiven gövde (sabit), taşıyıcı bacakları kendi kalçalarında döner.
 */
export const ladderTeam = (): BufferGeometry => {
  const b = new ModelBuilder();
  const y = 1.72;
  // Merdiven: iki uzun direk + basamaklar, ileri (+x) uzanır.
  for (const z of [-0.36, 0.36]) b.add(Part.Body, box(6.4, 0.12, 0.12), 'wood', [0.2, y, z]);
  for (let k = 0; k < 11; k++) b.add(Part.Body, box(0.08, 0.08, 0.72), 'woodDark', [-2.8 + k * 0.6, y, 0]);
  b.add(Part.Body, box(0.2, 0.2, 0.9), 'iron', [3.45, y, 0]); // demir kancalar
  for (const cx of [-1.6, 1.4]) {
    for (const side of [-1, 1]) {
      const cz = side * 0.7;
      b.add(Part.Body, box(0.36, 0.55, 0.4), 'urukSkin', [cx, 1.12, cz]);
      b.add(Part.Body, box(0.3, 0.32, 0.44), 'sootBlack', [cx, 0.86, cz]);
      const neck: V3 = [cx, 1.38, cz];
      b.add(Part.Head, box(0.22, 0.22, 0.22), 'urukSkin', [cx + 0.06, 1.5, cz], [0, 0, 0], [1, 1, 1], neck);
      b.add(Part.Head, box(0.24, 0.12, 0.24), 'sootBlack', [cx + 0.04, 1.63, cz], [0, 0, 0], [1, 1, 1], neck);
      b.add(Part.Head, box(0.03, 0.08, 0.06), 'whiteHand', [cx + 0.18, 1.5, cz], [0, 0, 0], [1, 1, 1], neck);
      b.add(
        side < 0 ? Part.ArmL : Part.ArmR,
        box(0.13, 0.42, 0.13),
        'urukSkin',
        [cx, 1.45, cz - side * 0.24],
        [side * 0.6, 0, 0],
        [1, 1, 1],
        [cx, 1.3, cz],
      );
      for (const [part, dz] of [
        [Part.LegL, -0.1],
        [Part.LegR, 0.1],
      ] as const)
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
  return b.build();
};

/**
 * Su Gözcüsü (BFME2, Moria kapısı): yarı suya gömülü iri gövde, tek büyük kızıl göz, yayılan
 * dokunaçlar. SPA: ön dokunaç çiftleri kol (vuruş), yan dokunaçlar bacak (kıvranma).
 */
export const watcher = (): BufferGeometry => {
  const b = new ModelBuilder({ hip: 1.2, shoulder: 2.6, neck: 2.9, shoulderZ: 1.4, hipZ: 1.2 });
  b.add(Part.Body, cyl(1.6, 2.2, 2.4, 8), 'waterDeep', [0, 1.2, 0]);
  b.add(Part.Body, cyl(1.0, 1.6, 1.0, 8), 'water', [0, 2.8, 0]);
  b.add(Part.Head, new OctahedronGeometry(1.0, 0), 'waterDeep', [0.5, 3.6, 0]);
  b.add(Part.Head, box(0.3, 0.55, 0.7), 'eyeRed', [1.3, 3.7, 0]); // tek göz
  b.add(Part.Head, box(0.32, 0.2, 0.2), 'sootBlack', [1.42, 3.7, 0]);
  // Dokunaçlar: üç parçalı kavisli kollar, çevreye yayılır.
  const tentacle = (part: PartId, a: number, lift: number, pivot: V3) => {
    const c = Math.cos(a);
    const sn = Math.sin(a);
    for (let k = 0; k < 3; k++) {
      const r = 2.0 + k * 1.1;
      b.add(
        part,
        box(1.3, 0.36 - k * 0.08, 0.36 - k * 0.08),
        k === 2 ? 'orcSkin' : 'waterDeep',
        [c * r, 1.2 + lift + k * 0.5 * (k === 2 ? -1 : 1), sn * r],
        [0, -a, 0.35 - k * 0.3],
        [1, 1, 1],
        pivot,
      );
    }
  };
  tentacle(Part.ArmR, 0.5, 1.2, [1.2, 2.6, 1.0]);
  tentacle(Part.ArmL, -0.5, 1.2, [1.2, 2.6, -1.0]);
  tentacle(Part.ArmR, 1.2, 0.6, [0.6, 2.2, 1.4]);
  tentacle(Part.ArmL, -1.2, 0.6, [0.6, 2.2, -1.4]);
  tentacle(Part.LegL, 2.1, 0.4, [-0.6, 1.2, 1.2]);
  tentacle(Part.LegR, -2.1, 0.4, [-0.6, 1.2, -1.2]);
  tentacle(Part.LegL, Math.PI, 0.4, [-1.4, 1.2, 0]);
  return b.build(1.1);
};

/**
 * Ateş Ejderi (BFME2 Goblin "Fire Drake"): dört ayaklı kızıl-pas pullu ejder, uzun boyun ve
 * kuyruk, deri kanatlar, ağzında kor. SPA: boyun+baş = Head (püskürtme sallanması), kanatlar
 * kol, çapraz bacak çiftleri LegL/LegR.
 */
export const wyrm = (): BufferGeometry => {
  const b = new ModelBuilder({ hip: 1.3, shoulder: 2.2, neck: 2.3, shoulderZ: 0.9, hipZ: 0.6 });
  b.add(Part.Body, box(3.4, 1.3, 1.5), 'rust', [0, 1.7, 0]);
  b.add(Part.Body, box(3.0, 0.3, 1.2), 'ember', [0, 1.05, 0]); // karın
  for (let k = 0; k < 6; k++)
    b.add(Part.Body, new ConeGeometry(0.18, 0.5, 4), 'sootBlack', [1.3 - k * 0.55, 2.55, 0]); // sırt dikenleri
  // Kuyruk
  for (let k = 0; k < 3; k++)
    b.add(
      Part.Body,
      box(1.4, 0.6 - k * 0.15, 0.6 - k * 0.15),
      'rust',
      [-2.2 - k * 1.2, 1.6 - k * 0.3, 0],
      [0, 0, 0.15],
    );
  // Boyun + baş
  const neck: V3 = [1.5, 2.2, 0];
  b.add(Part.Head, box(1.6, 0.7, 0.7), 'rust', [2.3, 2.7, 0], [0, 0, 0.6], [1, 1, 1], neck);
  b.add(Part.Head, box(1.1, 0.6, 0.7), 'rust', [3.3, 3.25, 0], [0, 0, 0], [1, 1, 1], neck);
  b.add(Part.Head, box(0.7, 0.18, 0.55), 'ember', [3.7, 3.0, 0], [0, 0, 0], [1, 1, 1], neck); // kor ağız
  b.add(Part.Head, box(0.12, 0.12, 0.6), 'fire', [3.55, 3.45, 0], [0, 0, 0], [1, 1, 1], neck); // gözler
  for (const z of [-0.25, 0.25])
    b.add(
      Part.Head,
      new ConeGeometry(0.1, 0.7, 4),
      'sootBlack',
      [3.0, 3.75, z],
      [0, 0, 0.9],
      [1, 1, 1],
      neck,
    );
  // Kanatlar
  for (const [part, z] of [
    [Part.ArmR, 1],
    [Part.ArmL, -1],
  ] as const) {
    const sh: V3 = [0.6, 2.3, z * 0.7];
    b.add(part, box(0.2, 0.2, 2.4), 'rust', [0.6, 2.8, z * 1.8], [z * -0.5, 0, 0], [1, 1, 1], sh);
    b.add(part, box(2.0, 0.08, 2.4), 'sootBlack', [-0.3, 2.7, z * 1.9], [z * -0.45, 0, 0], [1, 1, 1], sh);
  }
  for (const [part, x, z] of [
    [Part.LegL, 1.1, -0.6],
    [Part.LegR, -1.1, -0.6],
    [Part.LegR, 1.1, 0.6],
    [Part.LegL, -1.1, 0.6],
  ] as const) {
    const hip: V3 = [x, 1.4, z];
    b.add(part, box(0.4, 1.3, 0.4), 'rust', [x, 0.7, z], [0, 0, 0], [1, 1, 1], hip);
    b.add(part, box(0.6, 0.14, 0.45), 'sootBlack', [x + 0.15, 0.07, z], [0, 0, 0], [1, 1, 1], hip);
  }
  return b.build(1.1);
};

/**
 * Isengard kuşatma kulesi (BFME2): tekerlekli, üç katlı ahşap kule; ön yüzü deri kaplı, tepede
 * kalkık köprü ve Ak El sancağı; arkada iten Uruk'lar. Model ~6.5 m (UNIT_SCALE ile ~8 m).
 */
export const siegeTower = (): BufferGeometry => {
  const b = new ModelBuilder({ hip: 0.7, shoulder: 1.3, neck: 6.4, shoulderZ: 0.5, hipZ: 0.4 });
  // Şasi ve tekerlekler
  b.add(Part.Body, box(3.2, 0.4, 2.8), 'woodDark', [0, 0.8, 0]);
  for (const x of [-1.2, 1.2])
    for (const z of [-1.5, 1.5])
      b.add(Part.Body, cyl(0.55, 0.55, 0.25, 8), 'woodDark', [x, 0.55, z], [Math.PI / 2, 0, 0]);
  // Gövde: dört köşe direği, katlar, deri kaplama
  for (const x of [-1.3, 1.3])
    for (const z of [-1.2, 1.2]) b.add(Part.Body, box(0.22, 5.6, 0.22), 'wood', [x, 3.6, z]);
  for (const y of [2.2, 3.9, 5.6]) b.add(Part.Body, box(2.9, 0.18, 2.7), 'woodDark', [0, y, 0]);
  b.add(Part.Body, box(0.12, 4.8, 2.6), 'leather', [1.4, 3.7, 0]); // ön deri kaplama
  for (const z of [-1.3, 1.3]) b.add(Part.Body, box(2.6, 4.8, 0.1), 'leather', [0, 3.7, z]);
  for (let k = 0; k < 4; k++) b.add(Part.Body, box(0.14, 0.08, 2.7), 'iron', [1.47, 1.8 + k * 1.2, 0]);
  // Tepe: mazgal + kalkık köprü + sancak (Head: hafif sallanır)
  for (const z of [-1.1, 0, 1.1]) b.add(Part.Body, box(0.5, 0.5, 0.4), 'wood', [1.1, 6.0, z]);
  b.add(Part.ArmR, box(0.12, 2.4, 2.4), 'woodDark', [1.6, 6.5, 0], [0, 0, -0.25], [1, 1, 1], [1.4, 5.6, 0]);
  b.add(Part.Head, cyl(0.05, 0.05, 1.8, 4), 'wood', [-1.0, 6.9, 0], [0, 0, 0], [1, 1, 1], [-1.0, 6.0, 0]);
  b.add(Part.Head, box(0.06, 0.8, 0.9), 'sootBlack', [-1.0, 7.3, 0.45], [0, 0, 0], [1, 1, 1], [-1.0, 6.0, 0]);
  b.add(
    Part.Head,
    box(0.07, 0.3, 0.25),
    'whiteHand',
    [-1.0, 7.3, 0.45],
    [0, 0, 0],
    [1, 1, 1],
    [-1.0, 6.0, 0],
  );
  // İten Uruk'lar (arkada)
  for (const z of [-0.8, 0.8]) {
    b.add(Part.Body, box(0.36, 0.55, 0.4), 'urukSkin', [-1.95, 1.12, z]);
    b.add(Part.Body, box(0.22, 0.22, 0.22), 'urukSkin', [-1.9, 1.5, z]);
    b.add(
      Part.ArmL,
      box(0.4, 0.12, 0.12),
      'urukSkin',
      [-1.65, 1.25, z],
      [0, 0, 0],
      [1, 1, 1],
      [-1.9, 1.3, z],
    );
    for (const [part, dz] of [
      [Part.LegL, -0.1],
      [Part.LegR, 0.1],
    ] as const)
      b.add(
        part,
        box(0.15, 0.7, 0.15),
        'sootBlack',
        [-1.95, 0.38, z + dz],
        [0, 0, 0],
        [1, 1, 1],
        [-1.95, 0.72, z + dz],
      );
  }
  return b.build();
};

/**
 * Rohan mızrakçısı (BFME2): yeşil tunik, zincir zırh, burun korumalı konik miğfer ve at kılı
 * sorguç, yuvarlak yeşil kalkanda altın at, uzun mızrak. Takım rengi: tunik + kalkan.
 */
export const rohanSpearman = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'leather', 'woodDark');
  b.add(Part.Body, box(0.34, 0.6, 0.48), 'steel', [0, 1.13, 0]); // zincir zırh
  b.add(Part.Body, box(0.36, 0.42, 0.5), 'team0', [0, 0.84, 0]); // tunik eteği
  b.add(Part.Body, box(0.38, 0.07, 0.52), 'leather', [0, 1.0, 0]);
  b.add(Part.Body, box(0.05, 0.7, 0.44), 'team0Dark', [-0.2, 1.05, 0]); // pelerin
  b.add(Part.Head, box(0.2, 0.2, 0.2), 'sand', [0.02, 1.6, 0]);
  b.add(Part.Head, new ConeGeometry(0.16, 0.3, 6), 'silver', [0, 1.8, 0]); // konik miğfer
  b.add(Part.Head, box(0.04, 0.14, 0.04), 'silver', [0.13, 1.62, 0]); // burun koruması
  b.add(Part.Head, box(0.3, 0.06, 0.06), 'sand', [-0.16, 1.88, 0], [0, 0, 0.6]); // at kılı sorguç
  arm(b, Part.ArmR, 0.3, 'steel', 'leather');
  b.add(Part.ArmR, cyl(0.025, 0.025, 2.4, 4), 'wood', [0.45, 0.85, 0.3], [0, 0, -1.25]); // mızrak
  b.add(Part.ArmR, new ConeGeometry(0.05, 0.25, 4), 'silver', [1.6, 1.2, 0.3], [0, 0, -1.25]);
  arm(b, Part.ArmL, -0.3, 'steel', 'leather');
  b.add(Part.ArmL, cyl(0.32, 0.32, 0.05, 8), 'team0', [0.2, 0.95, -0.38], [0, 0, Math.PI / 2]);
  b.add(Part.ArmL, box(0.02, 0.22, 0.12), 'gold', [0.23, 0.97, -0.38]); // altın at
  b.add(Part.ArmL, box(0.02, 0.06, 0.2), 'gold', [0.23, 1.08, -0.42]);
  return b.build();
};

/** Rohan okçusu: yeşil kukuletalı pelerin, deri yelek, sırtta sadak, uzun yay. */
export const rohanArcher = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'leather', 'woodDark');
  b.add(Part.Body, box(0.32, 0.6, 0.46), 'leather', [0, 1.13, 0]);
  b.add(Part.Body, box(0.34, 0.4, 0.48), 'team0', [0, 0.82, 0]);
  b.add(Part.Body, box(0.05, 0.9, 0.5), 'team0Dark', [-0.2, 1.0, 0]); // pelerin
  b.add(Part.Body, cyl(0.06, 0.06, 0.6, 5), 'leather', [-0.23, 1.3, 0.12], [0.35, 0, 0]);
  b.add(Part.Body, box(0.08, 0.1, 0.08), 'sand', [-0.23, 1.66, 0.24], [0.35, 0, 0]);
  b.add(Part.Head, box(0.2, 0.2, 0.2), 'sand', [0.02, 1.6, 0]);
  b.add(Part.Head, box(0.26, 0.24, 0.26), 'team0Dark', [-0.03, 1.66, 0]); // kukuleta
  b.add(Part.Head, box(0.06, 0.2, 0.18), 'gold', [-0.12, 1.5, 0]); // sarı saç
  arm(b, Part.ArmR, 0.28, 'leather', 'sand');
  arm(b, Part.ArmL, -0.28, 'leather', 'sand');
  const hx = 0.04;
  const hy = 0.72;
  const hz = -0.28;
  b.add(Part.ArmL, box(0.72, 0.05, 0.04), 'woodDark', [hx + 0.02, hy, hz]);
  b.add(Part.ArmL, box(0.56, 0.045, 0.04), 'woodDark', [hx + 0.64, hy - 0.09, hz], [0, 0, -0.32]);
  b.add(Part.ArmL, box(0.56, 0.045, 0.04), 'woodDark', [hx - 0.6, hy - 0.09, hz], [0, 0, 0.32]);
  b.add(Part.ArmL, box(1.65, 0.012, 0.012), 'sand', [hx + 0.02, hy - 0.21, hz]);
  return b.build();
};

/**
 * Kral Théoden (BFME2): altın işlemeli pul zırh, yeşil pelerin, at kılı sorguçlu altın taç-miğfer,
 * gri sakal, Herugrim kılıcı ve yeşil-altın kalkan. Kahraman okunurluğu için %12 büyük.
 */
export const theoden = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'woodDark', 'leather');
  b.add(Part.Body, box(0.36, 0.62, 0.5), 'gold', [0, 1.13, 0]); // altın pul zırh
  b.add(Part.Body, box(0.06, 0.44, 0.4), 'steel', [0.18, 1.18, 0]);
  b.add(Part.Body, box(0.38, 0.4, 0.52), 'team0', [0, 0.82, 0]);
  b.add(Part.Body, box(0.07, 1.2, 0.62), 'team0Dark', [-0.22, 0.88, 0]); // kraliyet pelerini
  b.add(Part.Body, box(0.3, 0.14, 0.64), 'gold', [-0.05, 1.42, 0]);
  b.add(Part.Head, box(0.2, 0.22, 0.2), 'sand', [0.02, 1.61, 0]);
  b.add(Part.Head, box(0.06, 0.2, 0.16), 'rockLight', [0.12, 1.5, 0]); // gri sakal
  b.add(Part.Head, cyl(0.14, 0.17, 0.18, 6), 'gold', [0, 1.75, 0]); // taç-miğfer
  b.add(Part.Head, box(0.42, 0.08, 0.06), 'snow', [-0.2, 1.88, 0], [0, 0, 0.5]); // beyaz sorguç
  arm(b, Part.ArmR, 0.3, 'gold', 'sand');
  b.add(Part.ArmR, box(0.08, 0.06, 0.22), 'gold', [0.06, 0.72, 0.3]);
  b.add(Part.ArmR, box(0.95, 0.07, 0.04), 'silver', [0.55, 0.72, 0.3], [0, 0, 0.35]); // Herugrim
  arm(b, Part.ArmL, -0.3, 'gold', 'sand');
  b.add(Part.ArmL, cyl(0.3, 0.3, 0.05, 8), 'team0', [0.2, 0.95, -0.38], [0, 0, Math.PI / 2]);
  b.add(Part.ArmL, cyl(0.1, 0.1, 0.06, 6), 'gold', [0.23, 0.95, -0.4], [0, 0, Math.PI / 2]);
  return b.build(1.12);
};

/**
 * Éowyn (BFME2): uzun sarı saç, zincir zırh üstüne yeşil-beyaz giysi, miğfer yok, yuvarlak kalkan
 * ve ince kılıç. İnce, Rohan askerinden belirgin siluet.
 */
export const eowyn = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'leather', 'woodDark');
  b.add(Part.Body, box(0.3, 0.6, 0.42), 'steel', [0, 1.14, 0]);
  b.add(Part.Body, box(0.06, 0.44, 0.34), 'snow', [0.15, 1.16, 0]);
  b.add(Part.Body, box(0.34, 0.46, 0.46), 'team0', [0, 0.8, 0]);
  b.add(Part.Body, box(0.05, 0.95, 0.5), 'team0Dark', [-0.2, 0.98, 0]);
  b.add(Part.Head, box(0.19, 0.21, 0.18), 'sand', [0.02, 1.62, 0]);
  b.add(Part.Head, box(0.22, 0.12, 0.22), 'gold', [-0.01, 1.74, 0]);
  b.add(Part.Head, box(0.08, 0.56, 0.22), 'gold', [-0.11, 1.44, 0]); // uzun sarı saç
  arm(b, Part.ArmR, 0.28, 'steel', 'sand');
  b.add(Part.ArmR, box(0.08, 0.06, 0.2), 'gold', [0.06, 0.72, 0.28]);
  b.add(Part.ArmR, box(0.8, 0.06, 0.035), 'silver', [0.48, 0.72, 0.28], [0, 0, 0.35]);
  arm(b, Part.ArmL, -0.28, 'steel', 'sand');
  b.add(Part.ArmL, cyl(0.28, 0.28, 0.05, 8), 'team0', [0.2, 0.95, -0.36], [0, 0, Math.PI / 2]);
  b.add(Part.ArmL, box(0.02, 0.2, 0.1), 'gold', [0.23, 0.97, -0.36]);
  return b.build(1.06);
};

/**
 * Galadhrim savaşçısı (BFME2 Lothlórien): altın-gümüş pul zırh, uzun sivri elf miğferi, yaprak
 * biçimli uzun kılıç, uzun pelerin. İnce ve uzun siluet. Takım rengi: pelerin.
 */
export const galadhrim = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'rohanGreen', 'leather');
  b.add(Part.Body, box(0.3, 0.62, 0.44), 'gold', [0, 1.14, 0]); // pul zırh
  b.add(Part.Body, box(0.06, 0.46, 0.36), 'silver', [0.16, 1.18, 0]);
  b.add(Part.Body, box(0.32, 0.4, 0.46), 'silver', [0, 0.8, 0]);
  b.add(Part.Body, box(0.05, 1.05, 0.52), 'team0', [-0.2, 0.95, 0]); // uzun pelerin
  b.add(Part.Head, box(0.19, 0.21, 0.18), 'sand', [0.02, 1.62, 0]);
  b.add(Part.Head, new ConeGeometry(0.15, 0.5, 6), 'gold', [-0.02, 1.88, 0], [0, 0, 0.25]); // sivri miğfer
  b.add(Part.Head, box(0.07, 0.36, 0.2), 'gold', [-0.11, 1.5, 0]); // sarı saç
  arm(b, Part.ArmR, 0.28, 'gold', 'sand');
  b.add(Part.ArmR, box(0.07, 0.06, 0.22), 'gold', [0.06, 0.72, 0.28]);
  b.add(Part.ArmR, box(1.0, 0.08, 0.035), 'silver', [0.6, 0.74, 0.28], [0, 0, 0.45]); // yaprak kılıç
  b.add(Part.ArmR, new ConeGeometry(0.05, 0.22, 4), 'silver', [1.12, 0.98, 0.28], [0, 0, -1.1]);
  arm(b, Part.ArmL, -0.28, 'gold', 'sand');
  return b.build(1.04);
};

/** Haldir (BFME2): gri-yeşil pelerin, sarı saç, elf yayı ve sırtta kılıç; okçu kahraman. */
export const haldir = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'rohanGreen', 'leather');
  b.add(Part.Body, box(0.3, 0.62, 0.44), 'silver', [0, 1.14, 0]);
  b.add(Part.Body, box(0.06, 0.44, 0.36), 'gold', [0.16, 1.18, 0]);
  b.add(Part.Body, box(0.32, 0.38, 0.46), 'rohanGreen', [0, 0.8, 0]);
  b.add(Part.Body, box(0.06, 1.1, 0.56), 'team0Dark', [-0.21, 0.95, 0]);
  b.add(Part.Body, box(0.04, 0.8, 0.06), 'silver', [-0.25, 1.25, -0.1], [0.5, 0, 0]); // sırtta kılıç
  b.add(Part.Body, cyl(0.06, 0.06, 0.62, 5), 'leather', [-0.23, 1.32, 0.12], [0.35, 0, 0]);
  b.add(Part.Head, box(0.19, 0.21, 0.18), 'sand', [0.02, 1.62, 0]);
  b.add(Part.Head, box(0.22, 0.12, 0.22), 'gold', [-0.01, 1.74, 0]);
  b.add(Part.Head, box(0.08, 0.5, 0.2), 'gold', [-0.11, 1.46, 0]);
  arm(b, Part.ArmR, 0.28, 'silver', 'sand');
  arm(b, Part.ArmL, -0.28, 'silver', 'sand');
  const hx = 0.04;
  const hy = 0.72;
  const hz = -0.28;
  b.add(Part.ArmL, box(0.84, 0.045, 0.035), 'wood', [hx + 0.02, hy, hz]);
  b.add(Part.ArmL, box(0.7, 0.04, 0.035), 'gold', [hx + 0.75, hy - 0.13, hz], [0, 0, -0.4]);
  b.add(Part.ArmL, box(0.7, 0.04, 0.035), 'gold', [hx - 0.71, hy - 0.13, hz], [0, 0, 0.4]);
  b.add(Part.ArmL, box(2.0, 0.012, 0.012), 'silver', [hx + 0.02, hy - 0.28, hz]);
  return b.build(1.1);
};

/** Elrond (BFME2): koyu uzun saç, gümüş taç, şarap rengi uzun cüppe, elf kılıcı. */
export const elrond = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'rust', 'leather');
  b.add(Part.Body, cyl(0.24, 0.4, 0.95, 7), 'rust', [0, 0.5, 0]); // cüppe eteği
  b.add(Part.Body, box(0.34, 0.62, 0.46), 'rust', [0, 1.13, 0]);
  b.add(Part.Body, box(0.06, 0.5, 0.2), 'gold', [0.17, 1.15, 0]);
  b.add(Part.Body, box(0.38, 0.08, 0.5), 'gold', [0, 0.9, 0]);
  b.add(Part.Body, box(0.07, 1.25, 0.6), 'team0Dark', [-0.22, 0.86, 0]);
  b.add(Part.Head, box(0.2, 0.22, 0.2), 'sand', [0.02, 1.61, 0]);
  b.add(Part.Head, box(0.24, 0.24, 0.24), 'sootBlack', [-0.04, 1.67, 0]); // koyu saç
  b.add(Part.Head, box(0.1, 0.46, 0.24), 'sootBlack', [-0.1, 1.44, 0]);
  b.add(Part.Head, cyl(0.14, 0.14, 0.04, 8), 'silver', [0, 1.74, 0]); // taç
  arm(b, Part.ArmR, 0.3, 'rust', 'sand');
  b.add(Part.ArmR, box(0.08, 0.06, 0.22), 'gold', [0.06, 0.72, 0.3]);
  b.add(Part.ArmR, box(0.95, 0.07, 0.04), 'silver', [0.56, 0.72, 0.3], [0, 0, 0.35]);
  arm(b, Part.ArmL, -0.3, 'rust', 'sand');
  return b.build(1.12);
};

/** Birim tipi id → model üreticisi (UNIT_DEFS ile aynı sıra). */
/**
 * İşçi (BFME2 inşaatçısı): deri önlüklü usta — sarı keçe şapka, kısa sakal, sağ elde çekiç,
 * sırtında bağlı kereste ve testere, belde alet kemeri.
 */
export const worker = (): BufferGeometry => {
  const b = new ModelBuilder();
  legs(b, 'woodDark', 'leather');
  b.add(Part.Body, box(0.36, 0.58, 0.48), 'rust', [0, 1.12, 0]); // tunik
  b.add(Part.Body, box(0.06, 0.62, 0.38), 'leather', [0.19, 1.02, 0]); // önlük
  b.add(Part.Body, box(0.38, 0.08, 0.5), 'woodDark', [0, 0.88, 0]); // kemer
  b.add(Part.Body, box(0.1, 0.14, 0.1), 'iron', [0.16, 0.86, 0.2]); // alet kesesi
  b.add(Part.Body, box(0.08, 0.12, 0.08), 'wood', [0.16, 0.86, -0.2]);
  // Sırtta kereste demeti ve testere.
  for (const dz of [-0.1, 0, 0.1])
    b.add(Part.Body, box(0.08, 1.1, 0.08), 'wood', [-0.3, 1.25, dz], [0, 0, 0.18]);
  b.add(Part.Body, box(0.1, 0.06, 0.36), 'leather', [-0.28, 1.3, 0]); // bağ
  b.add(Part.Body, box(0.03, 0.5, 0.16), 'steel', [-0.38, 1.12, 0.16], [0, 0, 0.18]); // testere
  b.add(Part.Head, box(0.2, 0.2, 0.2), 'sand', [0.02, 1.6, 0]);
  b.add(Part.Head, box(0.08, 0.1, 0.18), 'woodDark', [0.1, 1.52, 0]); // sakal
  b.add(Part.Head, cyl(0.13, 0.15, 0.14, 7), 'gold', [0, 1.74, 0]); // keçe şapka
  b.add(Part.Head, cyl(0.24, 0.24, 0.03, 8), 'gold', [0, 1.67, 0]); // şapka kenarı
  arm(b, Part.ArmR, 0.3, 'rust', 'sand');
  b.add(Part.ArmR, box(0.05, 0.5, 0.05), 'wood', [0.12, 0.8, 0.3], [0, 0, 0.5]); // çekiç sapı
  b.add(Part.ArmR, box(0.12, 0.12, 0.22), 'iron', [0.26, 1.0, 0.3], [0, 0, 0.5]); // çekiç başı
  arm(b, Part.ArmL, -0.3, 'rust', 'sand');
  return b.build();
};

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
  14: gandalf,
  15: legolas,
  16: balrog,
  17: ladderTeam,
  18: watcher,
  19: wyrm,
  20: siegeTower,
  21: rohanSpearman,
  22: rohanArcher,
  23: theoden,
  24: eowyn,
  // Kışladan yetişen Rohirrim: çağrılan Rohirrim ile aynı siluet.
  25: rohirrim,
  26: galadhrim,
  // Kışladan yetişen Lórien okçuları: büyüyle gelenlerle aynı siluet.
  27: lorienArcher,
  28: haldir,
  29: elrond,
  30: worker,
  31: lurtz,
  32: saruman,
  33: sharku,
  34: urukCrossbow,
};
