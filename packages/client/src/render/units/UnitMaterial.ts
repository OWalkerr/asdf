import {
  abs,
  attribute,
  cameraViewMatrix,
  clamp,
  cos,
  dot,
  Fn,
  float,
  fract,
  max,
  min,
  mix,
  normalGeometry,
  normalize,
  positionGeometry,
  positionViewDirection,
  pow,
  saturate,
  sin,
  smoothstep,
  step,
  texture,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { MeshToonNodeMaterial, type Node, type Texture } from 'three/webgpu';

type FloatNode = Node<'float'>;
type Vec3Node = Node<'vec3'>;

import type { ToonParams } from '../materials/ToonMaterial';
import { PALETTE_SIZE } from '../palette';
import { setEmissiveNode } from '../tsl-types';
import { Part } from './models';

/**
 * Birim materyali — Segmentli Prosedürel Animasyon (SPA, GDD §2.3 yaklaşım A).
 *
 * Instance başına iki vec4 (CPU'dan 32 bayt):
 *   iPose = (x, y, z, yaw)          dünya konumu ve yön (radyan, 0 = +X, π/2 = +Z)
 *   iAnim = (state, t, flash, team) animasyon durumu, durumdaki süre (s), vurulma parıltısı, takım
 *
 * InstancedMesh matrisleri birim (identity) kalır: konum/yön ve animasyon burada,
 * `positionNode` içinde hesaplanır. Böylece gölge geçişi (positionNode'u yeniden kullanır)
 * de animasyonlu pozu görür; CPU instance başına 64 bayt matris yerine 32 bayt yükler.
 * Not: three r186'da instancing positionNode'dan önce uygulanır; identity matris bunu etkisiz kılar.
 */
export const ANIM_IDLE = 0;
export const ANIM_WALK = 1;
export const ANIM_ATTACK = 2;
export const ANIM_DIE = 3;

export interface UnitMaterialOptions {
  /** 0 = kılıç savurma, 1 = mızrak dürtme, 2 = yay germe. */
  attackStyle: number;
  /** Yürüme adım frekansı (Hz). */
  stepRate?: number;
}

/** a ≈ v ise 1, değilse 0 (bool yerine float maske; dallanmasız shader). */
const isEq = (a: FloatNode, v: number): FloatNode => step(abs(a.sub(v)), float(0.5));

/** Z ekseni (yanal eksen) etrafında döndürme: +açı ileri (+X) kaldırır. */
const rotZ = (v: Vec3Node, a: FloatNode): Vec3Node => {
  const c = cos(a);
  const s = sin(a);
  return vec3(v.x.mul(c).sub(v.y.mul(s)), v.x.mul(s).add(v.y.mul(c)), v.z);
};

/** Y ekseni etrafında sim yönüne çevirme: model +X → (cos yaw, sin yaw) yönü. */
const rotYaw = (v: Vec3Node, a: FloatNode): Vec3Node => {
  const c = cos(a);
  const s = sin(a);
  return vec3(v.x.mul(c).sub(v.z.mul(s)), v.y, v.x.mul(s).add(v.z.mul(c)));
};

export const createUnitMaterial = (
  palette: Texture,
  params: ToonParams,
  opts: UnitMaterialOptions,
): MeshToonNodeMaterial => {
  const mat = new MeshToonNodeMaterial();
  mat.gradientMap = params.ramp;
  mat.vertexColors = true;

  const style = uniform(opts.attackStyle);
  const stepRate = uniform(opts.stepRate ?? 1.7);

  const iPose = attribute('iPose', 'vec4');
  const iAnim = attribute('iAnim', 'vec4');
  const part = attribute('aPart', 'float');
  const pivot = attribute('aPivot', 'vec3');

  const state = iAnim.x;
  const t = iAnim.y;
  const walk = isEq(state, ANIM_WALK);
  const attack = isEq(state, ANIM_ATTACK);
  const die = isEq(state, ANIM_DIE);
  const idle = isEq(state, ANIM_IDLE);

  // --- Parça açıları (radyan) -------------------------------------------------------
  const cycle = sin(t.mul(stepRate).mul(Math.PI * 2));
  const legSwing = cycle.mul(0.55).mul(walk);

  // Kılıç: kaldır (0–0.35) → indir (0.35–0.5) → toparlan (0.5–1), döngü 0.9 s.
  const ph = fract(t.div(0.9));
  const raise = smoothstep(0, 0.35, ph);
  const strike = smoothstep(0.35, 0.5, ph);
  const recover = smoothstep(0.55, 1, ph);
  const slashAngle = mix(mix(mix(0.2, 2.5, raise), -0.25, strike), 0.2, recover);
  // Mızrak: kol hafif sabit, silah ileri-geri kayar (dürtme), döngü 0.8 s.
  const thrustPulse = pow(sin(fract(t.div(0.8)).mul(Math.PI)), 3);
  // Yay: iki kol öne kalkar, sağ el kirişi geri çeker (0–0.7), bırakır (0.85–1), döngü 1.6 s.
  const bowPh = fract(t.div(1.6));
  const bowDraw = smoothstep(0, 0.7, bowPh).mul(float(1).sub(step(0.85, bowPh)));
  const isSlash = isEq(style, 0);
  const isThrust = isEq(style, 1);
  const isBow = isEq(style, 2);
  const armRAttack = isSlash.mul(slashAngle).add(isThrust.mul(0.12)).add(isBow.mul(1.38));
  const armLAttack = isSlash.add(isThrust).mul(0.45).add(isBow.mul(1.5));

  const armR = walk
    .mul(cycle.mul(-0.32))
    .add(attack.mul(armRAttack))
    .add(idle.mul(sin(t.mul(1.7)).mul(0.04)));
  const armL = walk.mul(cycle.mul(0.28)).add(attack.mul(armLAttack)).add(idle.mul(0.06));
  const headNod = idle.mul(sin(t.mul(0.9)).mul(0.05)).add(attack.mul(strike.sub(recover).mul(0.12)));

  const angle = isEq(part, Part.LegL)
    .mul(legSwing)
    .sub(isEq(part, Part.LegR).mul(legSwing))
    .add(isEq(part, Part.ArmR).mul(armR))
    .add(isEq(part, Part.ArmL).mul(armL))
    .add(isEq(part, Part.Head).mul(headNod));

  // --- Parça dönüşümü (eklem etrafında) ----------------------------------------------
  const local = rotZ(positionGeometry.sub(pivot), angle).add(pivot);
  // Sağ kol: mızrakta ileri dürtme, yayda kirişi geri çekme.
  const thrust = isEq(part, Part.ArmR)
    .mul(attack)
    .mul(isThrust.mul(thrustPulse).mul(0.5).sub(isBow.mul(bowDraw).mul(0.32)));
  const bob = abs(cycle).mul(0.05).mul(walk);
  const posPart = local.add(vec3(thrust, bob, 0));
  const nrmPart = rotZ(normalGeometry, angle);

  // --- Ölüm: ayak hizasından geriye devrilme, 3 sn sonra yere batma ---------------------
  const fall = min(t.div(0.6), 1).mul(1.45).mul(die);
  const sink = max(t.sub(3), 0).mul(0.35).mul(die);
  const posDead = rotZ(posPart, fall).sub(vec3(0, sink, 0));
  const nrmDead = rotZ(nrmPart, fall);

  // --- Dünya uzayı -------------------------------------------------------------------
  const yaw = iPose.w;
  mat.positionNode = Fn(() => rotYaw(posDead, yaw).add(iPose.xyz))();
  const normalWorld = rotYaw(nrmDead, yaw);
  const normalView = varying(normalize(cameraViewMatrix.mul(vec4(normalWorld, 0)).xyz));
  mat.normalNode = normalView;

  // --- Renk: takım satırı kaydırma (GDD §3.1: palet satırları 12–15 = takımlar) ----------
  const row = 1 / PALETTE_SIZE;
  const team = varying(iAnim.w);
  const baseUv = uv();
  const inTeamRow = step(12 * row, baseUv.y).mul(step(baseUv.y, 13 * row));
  mat.colorNode = texture(palette, baseUv.add(vec2(0, team.mul(row).mul(inTeamRow))));

  // --- Emissive: rim (toon materyalle aynı parametreler) + vurulma parıltısı ------------
  const facing = saturate(dot(normalView, positionViewDirection));
  const rim = params.rimColor.mul(pow(float(1).sub(facing), params.rimPower)).mul(params.rimStrength);
  const flash = varying(clamp(iAnim.z, 0, 1));
  setEmissiveNode(mat, rim.add(vec3(1, 0.92, 0.75).mul(flash).mul(0.9)));
  return mat;
};
