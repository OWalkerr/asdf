import { Rng } from '@bulwark/shared';
import { float, positionWorld, sin, texture, time, uniform, uv } from 'three/tsl';
import {
  type BatchedMesh,
  Group,
  Matrix4,
  MeshToonNodeMaterial,
  Quaternion,
  type Texture,
  Vector3,
} from 'three/webgpu';
import { StaticBatch } from '../geometry/StaticBatch';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';
import { type FloatUniform, setEmissiveNode } from '../tsl-types';
import * as P from './prefabs';
import { buildTerrainGeometry, createHeightField, DEFAULT_TERRAIN, type TerrainSpec } from './terrain';

/**
 * Look-dev sahnesi (Phase 1 / Adım 3): ışık, toon shader ve palet ayarı için
 * küçük bir kale dioraması. Tüm statik geometri 2 BatchedMesh'te (toon + emissive).
 * Adım 4'te yerini sadeleştirilmiş Helm's Deep alacak.
 */
export interface LookdevScene {
  root: Group;
  heightAt: (x: number, z: number) => number;
  spec: TerrainSpec;
  stats: { instances: number; batches: number };
  flameIntensity: FloatUniform;
}

const FORT_CENTER = { x: 0, z: -10 };

export const buildLookdevScene = (palette: Texture, params: ToonParams): LookdevScene => {
  const spec = DEFAULT_TERRAIN;
  const heightAt = createHeightField(spec);
  const rng = new Rng(2026);
  const rand = () => rng.nextU32() / 4294967296;

  const solid = new StaticBatch();
  const glow = new StaticBatch();
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const at = (x: number, z: number, rotY = 0, s = 1, y = heightAt(x, z)) =>
    m.compose(new Vector3(x, y, z), q.setFromAxisAngle(up, rotY), new Vector3(s, s, s));

  // --- Arazi -----------------------------------------------------------------
  solid.add(buildTerrainGeometry(spec, heightAt), new Matrix4());

  // --- Kale: güneye açılan yay şeklinde sur, kapı, kuleler, ana kale -------------
  const plateauY = spec.plateauHeight;
  const wall = P.wallSegment('helmStone');
  const tower = P.gondorTower();
  const wallRadius = 27;
  const gateAngle = Math.PI / 2; // +Z (güney) yönü
  const segAngle = 8 / wallRadius; // 8 m segment
  const towerAngles: number[] = [];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 7; i++) {
      const a = gateAngle + side * (0.24 + (i + 0.5) * segAngle);
      const x = FORT_CENTER.x + Math.cos(a) * wallRadius;
      const z = FORT_CENTER.z + Math.sin(a) * wallRadius;
      solid.add(wall, at(x, z, -a + Math.PI / 2, 1, plateauY - 0.4));
      if (i === 2 || i === 6) towerAngles.push(gateAngle + side * (0.24 + (i + 1) * segAngle));
    }
  }
  for (const a of towerAngles) {
    solid.add(
      tower,
      at(
        FORT_CENTER.x + Math.cos(a) * wallRadius,
        FORT_CENTER.z + Math.sin(a) * wallRadius,
        0,
        1,
        plateauY - 0.4,
      ),
    );
  }
  const gateZ = FORT_CENTER.z + wallRadius;
  solid.add(P.gateHouse(), at(0, gateZ, 0, 1, plateauY - 0.4));
  solid.add(tower, at(-8.5, gateZ + 1, 0, 0.85, plateauY - 0.4));
  solid.add(tower, at(8.5, gateZ + 1, 0, 0.85, plateauY - 0.4));
  solid.add(P.keep(), at(0, FORT_CENTER.z - 8, 0, 1, plateauY - 0.2));

  // Kapı önünde mangallar (bloom testi)
  const brazier = P.brazierBase();
  const flame = P.brazierFlame(rand);
  for (const [x, z] of [
    [-4, gateZ + 4],
    [4, gateZ + 4],
    [-6, FORT_CENTER.z + 2],
    [6, FORT_CENTER.z + 2],
  ] as const) {
    solid.add(brazier, at(x, z, 0, 1, plateauY));
    glow.add(flame, at(x, z, rand() * 6, 1, plateauY));
  }

  // --- Dekor: ağaçlar ve kayalar (plato, yol ve dik yamaçlardan kaçınarak) --------
  const pines = [P.pineTree(rand), P.pineTree(rand), P.pineTree(rand)];
  const broads = [P.broadleafTree(rand), P.broadleafTree(rand)];
  const rocks = [P.rock(rand, 1), P.rock(rand, 1.6), P.rock(rand, 2.6)];
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;
  const half = spec.size / 2 - 6;
  const free = (x: number, z: number) => {
    const fort = Math.hypot(x - FORT_CENTER.x, z - FORT_CENTER.z) > spec.plateauRadius + 10;
    const road = !(z > 0 && Math.abs(x) < spec.roadWidth + 3);
    return fort && road;
  };
  for (let i = 0; i < 520; i++) {
    const x = (rand() * 2 - 1) * half;
    const z = (rand() * 2 - 1) * half;
    if (!free(x, z)) continue;
    const y = heightAt(x, z);
    const slope = Math.abs(heightAt(x + 1.5, z) - y) + Math.abs(heightAt(x, z + 1.5) - y);
    const s = 0.8 + rand() * 0.5;
    if (slope > 2.2 || rand() < 0.25) {
      solid.add(pick(rocks), at(x, z, rand() * 6.28, s, y - 0.2));
    } else if (y < 20) {
      // Orman kümelenmesi: çamlar yüksekte, yapraklılar alçakta.
      const list = y > 4 ? pines : broads;
      solid.add(pick(list), at(x, z, rand() * 6.28, s, y - 0.1));
    }
  }

  // --- Materyaller ve batch'ler ---------------------------------------------
  const root = new Group();
  root.name = 'lookdev';
  const instances = solid.instanceCount + glow.instanceCount;
  const solidMesh = solid.build(createToonMaterial(palette, params), 'static-toon');
  root.add(solidMesh);

  const flameIntensity = uniform(4.0);
  const glowMat = new MeshToonNodeMaterial();
  const flameColor = texture(palette, uv());
  glowMat.colorNode = flameColor;
  // Titreşen alev: dünya konumuna göre faz kaydırma ile her mangal farklı titrer.
  const flicker = sin(time.mul(11).add(positionWorld.x.mul(3.1)).add(positionWorld.z))
    .mul(0.18)
    .add(float(1));
  setEmissiveNode(glowMat, flameColor.rgb.mul(flameIntensity).mul(flicker));
  const glowMesh: BatchedMesh = glow.build(glowMat, 'static-glow');
  glowMesh.castShadow = false;
  root.add(glowMesh);

  return { root, heightAt, spec, stats: { instances, batches: 2 }, flameIntensity };
};
