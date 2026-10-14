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
  ): this {
    geo.applyMatrix4(
      new Matrix4()
        .makeScale(...scale)
        .premultiply(new Matrix4().makeRotationFromEuler(new Euler(...rot)))
        .premultiply(new Matrix4().makeTranslation(...pos)),
    );
    const g = paint(geo, swatch);
    const n = g.getAttribute('position').count;
    const [px, py, pz] = pivotOf(this.rig, part);
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

/** Birim tipi id → model üreticisi (UNIT_DEFS ile aynı sıra). */
export const UNIT_MODELS: Record<number, () => BufferGeometry> = {
  0: gondorSoldier,
  1: orcWarrior,
  2: towerGuard,
  3: urukHai,
};
