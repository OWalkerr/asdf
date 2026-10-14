import { HELMS_DEEP, HORNBURG_CURTAIN, type MapDef, Rng, type Vec2 } from '@bulwark/shared';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicNodeMaterial,
  LineSegments,
  Matrix4,
  Quaternion,
  type Texture,
  Vector3,
} from 'three/webgpu';
import { StaticBatch } from '../render/geometry/StaticBatch';
import { createFlameMaterial } from '../render/map/emissive';
import type { MapScene } from '../render/map/MapScene';
import * as P from '../render/map/prefabs';
import { SlotMarkers } from '../render/map/SlotMarkers';
import {
  buildTerrainGeometry,
  fbm,
  type HeightFn,
  type PaintFn,
  smoothstep,
  valueNoise,
} from '../render/map/terrain';
import { createToonMaterial, type ToonParams } from '../render/materials/ToonMaterial';

/**
 * Helm's Deep render oluşturucusu (Phase 1 / Adım 4). Oynanış verisi
 * `@bulwark/shared` içindeki HELMS_DEEP tanımından okunur; burada yalnızca
 * görsel arazi şekli (dağlar, vadi) ve yapı yerleşimi üretilir.
 */

const DEG = Math.PI / 180;

/** Noktanın AB doğru parçasına izdüşümü: t ∈ [0,1] ve uzaklık. */
const projectOnSegment = (x: number, z: number, a: Vec2, b: Vec2) => {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * abx + (z - a[1]) * abz) / len2));
  const px = a[0] + abx * t;
  const pz = a[1] + abz * t;
  return { t, dist: Math.hypot(x - px, z - pz) };
};

const distToPolyline = (x: number, z: number, pts: readonly Vec2[]): number => {
  let d = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < pts.length; i++)
    d = Math.min(d, projectOnSegment(x, z, pts[i] as Vec2, pts[i + 1] as Vec2).dist);
  return d;
};

/**
 * Vadi "açıklık payı": pozitif = açık vadi tabanı, negatif = dağ.
 * Güney ovası + kuzeye doğru daralan Deeping-coomb birleşimi; z = -10 hattında dağlar
 * vadi ağzını iki yandan kapatır (Deeping Wall bu darboğazı tıkar).
 */
const valleyMargin = (x: number, z: number): number => {
  const south = Math.min(150 - Math.abs(x), (z + 10) * 2);
  const halfWidth = 75 - Math.max(0, -z - 10) * 0.25;
  const coomb = Math.min(halfWidth - Math.abs(x - 15), z + 152);
  return Math.max(south, coomb);
};

export const createHelmsDeepHeight = (def: MapDef): HeightFn => {
  const wall = def.walls[0];
  const plateau = def.terrain.plateaus[0];
  const ramp = def.terrain.ramps[0];
  const half = def.size / 2;
  return (x, z) => {
    // Vadi tabanı: hafif dalgalı ova; iç vadi mağaralara doğru yükselir.
    let h = (fbm(x / 45, z / 45, def.seed) - 0.5) * 5;
    if (z < -30) h += Math.min(1, (-z - 30) / 110) * 6;
    // Dağlar (Ered Nimrais): vadi dışında hızla yükselen, sırtlı kayalıklar.
    const m = valleyMargin(x, z);
    if (m < 0) {
      const rise = smoothstep(0, 24, -m);
      h += rise * 34 + -m * 0.12 + fbm(x / 22, z / 22, def.seed + 5) * 22 * smoothstep(0, 14, -m);
    }
    // Güney ucu: alçak tepelerle diorama çerçevesi.
    h += smoothstep(half - 24, half, z) * 10;
    // Sur tabanı düzlenir.
    if (wall) {
      const [a, b] = wall.points as [Vec2, Vec2];
      const p = projectOnSegment(x, z, a, b);
      const blend = 1 - smoothstep(wall.thickness * 0.8, wall.thickness * 1.8, p.dist);
      h += (0.5 - h) * blend;
    }
    // Hornburg kayası: dağa yaslanan düz plato.
    if (plateau) {
      const r = Math.hypot(x - plateau.center[0], z - plateau.center[1]);
      const blend = 1 - smoothstep(plateau.radius - 2, plateau.radius + 9, r);
      h += (plateau.height - h) * blend;
    }
    // Causeway: ovadan kapıya yükselen set.
    if (ramp) {
      const p = projectOnSegment(x, z, ramp.from, ramp.to);
      const target = ramp.fromHeight + (ramp.toHeight - ramp.fromHeight) * p.t;
      const blend = 1 - smoothstep(ramp.width / 2, ramp.width / 2 + 7, p.dist);
      h += (target - h) * blend;
    }
    return h;
  };
};

const createHelmsDeepPaint = (def: MapDef): PaintFn => {
  const ramp = def.terrain.ramps[0];
  const plateau = def.terrain.plateaus[0];
  return (avgY, slope, x, z) => {
    // Hornburg avlusu: taş döşeme.
    if (plateau && Math.hypot(x - plateau.center[0], z - plateau.center[1]) < plateau.radius - 3)
      return 'rockLight';
    if (slope > 0.6) return avgY > 30 ? 'rockLight' : 'rock';
    if (slope > 0.4) return 'rockDark';
    if (avgY > 40) return 'snow';
    if (ramp && projectOnSegment(x, z, ramp.from, ramp.to).dist < ramp.width / 2 - 0.5) return 'dirt';
    if (def.lanes.some((l) => distToPolyline(x, z, l.points) < 2.6)) return 'dirtDark';
    if (avgY > 18) return 'rockDark';
    const n = valueNoise(x / 16, z / 16, def.seed + 99);
    // Rohan ovası: kuru, sarımsı çimen ağırlıklı.
    if (z > -10) return n > 0.55 ? 'grassDry' : n < 0.25 ? 'grassDark' : 'grass';
    return n > 0.6 ? 'grass' : n < 0.18 ? 'dirtDark' : 'grassDark';
  };
};

export const buildHelmsDeep = (palette: Texture, params: ToonParams, def: MapDef = HELMS_DEEP): MapScene => {
  const heightAt = createHelmsDeepHeight(def);
  const rng = new Rng(def.seed);
  const rand = () => rng.nextU32() / 4294967296;
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;

  const solid = new StaticBatch();
  const glow = new StaticBatch();
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const at = (x: number, z: number, rotY = 0, s = 1, y = heightAt(x, z)) =>
    m.compose(new Vector3(x, y, z), q.setFromAxisAngle(up, rotY), new Vector3(s, s, s));

  // --- Arazi -----------------------------------------------------------------
  const grid = { size: def.size, segments: 96 };
  solid.add(buildTerrainGeometry(grid, heightAt, createHelmsDeepPaint(def)), new Matrix4(), true);

  // --- Deeping Wall ------------------------------------------------------------
  const wall = def.walls[0];
  if (wall) {
    for (let i = 0; i + 1 < wall.points.length; i++) {
      const [ax, az] = wall.points[i] as Vec2;
      const [bx, bz] = wall.points[i + 1] as Vec2;
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.ceil(len / 8);
      const segLen = len / n;
      // Sağ el kuralı: ilerleme yönünün sağı dış yüz → yerel +Z.
      const rot = -Math.atan2(bz - az, bx - ax);
      const seg = P.deepingWallSegment(segLen + 0.02, wall.height, wall.thickness);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        solid.add(seg, at(ax + (bx - ax) * t, az + (bz - az) * t, rot, 1, 0.4), true);
      }
      // Merdiven kuleleri: sur boyunca iki adet.
      const tower = P.wallTower(wall.height + 3);
      for (const t of [0.38, 0.72])
        solid.add(tower, at(ax + (bx - ax) * t, az + (bz - az) * t - 1, 0, 1, 0.3), true);
    }
  }

  // --- Hornburg: plato, sur halkası, kapı, kale --------------------------------
  const plateau = def.terrain.plateaus[0];
  const gate = def.gates[0];
  if (plateau && gate) {
    const [cx, cz] = plateau.center;
    const baseY = plateau.height - 0.4;
    const ringWall = P.wallSegment('helmStone');
    const R = HORNBURG_CURTAIN.radius;
    const segAngle = 8 / R;
    // Batı/kuzeybatı dağa yaslanır (160°–290° arası sur yok); kapı çevresinde boşluk.
    for (let a = -70 * DEG; a <= 160 * DEG; a += segAngle) {
      if (Math.abs(a - gate.facing * DEG) < 0.3) continue;
      solid.add(ringWall, at(cx + Math.cos(a) * R, cz + Math.sin(a) * R, -a + Math.PI / 2, 1, baseY), true);
    }
    const gateRot = Math.PI / 2 - gate.facing * DEG;
    solid.add(P.gateHouse(), at(gate.pos[0], gate.pos[1], gateRot, 1, baseY), true);
    // Ana kale (Hornburg kulesi) platonun arkasında, kapıya bakar.
    const keepPos: Vec2 = [cx - 6, cz - 7];
    solid.add(P.keep(), at(keepPos[0], keepPos[1], gateRot, 1, plateau.height - 0.2), true);
    // Kapı önü mangalları
    const brazier = P.brazierBase();
    const flame = P.brazierFlame(rand);
    const g = gate.facing * DEG;
    for (const side of [-1, 1]) {
      const bx = gate.pos[0] + Math.cos(g) * 4 + Math.cos(g + Math.PI / 2) * 4 * side;
      const bz = gate.pos[1] + Math.sin(g) * 4 + Math.sin(g + Math.PI / 2) * 4 * side;
      solid.add(brazier, at(bx, bz, 0, 1));
      glow.add(flame, at(bx, bz, rand() * 6));
    }
  }

  // --- Glittering Caves (Citadel) ------------------------------------------------
  const [ccx, ccz] = def.citadel.pos;
  solid.add(P.caveMouth(rand), at(ccx, ccz - 7, 0, 1.3, heightAt(ccx, ccz - 4) - 0.5), true);
  {
    const brazier = P.brazierBase();
    const flame = P.brazierFlame(rand);
    for (const dx of [-9, 9]) {
      solid.add(brazier, at(ccx + dx, ccz + 1));
      glow.add(flame, at(ccx + dx, ccz + 1, rand() * 6));
    }
  }

  // --- Dekor: dağ eteklerinde kayalar, yamaçlarda çamlar, ovada seyrek ağaç --------
  const pines = [P.pineTree(rand), P.pineTree(rand), P.pineTree(rand)];
  const broads = [P.broadleafTree(rand), P.broadleafTree(rand)];
  const rocks = [P.rock(rand, 1.2), P.rock(rand, 2.2), P.rock(rand, 3.6)];
  const half = def.size / 2 - 4;
  const blocked = (x: number, z: number) => {
    if (def.lanes.some((l) => distToPolyline(x, z, l.points) < 9)) return true;
    if (wall && Math.abs(z - (wall.points[0] as Vec2)[1]) < 12 && x > -60 && x < 100) return true;
    if (plateau && Math.hypot(x - plateau.center[0], z - plateau.center[1]) < plateau.radius + 8) return true;
    if (Math.hypot(x - ccx, z - ccz) < 22) return true;
    return def.slots.some((s) => Math.hypot(x - s.pos[0], z - s.pos[1]) < 8);
  };
  for (let i = 0; i < 900; i++) {
    const x = (rand() * 2 - 1) * half;
    const z = (rand() * 2 - 1) * half;
    if (blocked(x, z)) continue;
    const y = heightAt(x, z);
    const margin = valleyMargin(x, z);
    const slope = Math.abs(heightAt(x + 1.5, z) - y) + Math.abs(heightAt(x, z + 1.5) - y);
    const s = 0.8 + rand() * 0.6;
    if (margin < -6 && y > 34) continue; // yüksek zirveler çıplak
    if (margin < 4 && slope > 1.2) {
      solid.add(pick(rocks), at(x, z, rand() * 6.28, s * (1 + rand()), y - 0.4));
    } else if (margin < 0 && slope < 4) {
      solid.add(pick(pines), at(x, z, rand() * 6.28, s, y - 0.2));
    } else if (margin >= 0 && rand() < 0.22) {
      solid.add(rand() < 0.5 ? pick(broads) : pick(rocks), at(x, z, rand() * 6.28, s, y - 0.2));
    }
  }

  // --- Batch'ler ---------------------------------------------------------------
  const root = new Group();
  root.name = def.id;
  const collider = solid.buildCollider();
  const instances = solid.instanceCount + glow.instanceCount;
  root.add(solid.build(createToonMaterial(palette, params), 'static-toon'));
  const flameMat = createFlameMaterial(palette);
  const glowMesh = glow.build(flameMat.material, 'static-glow');
  glowMesh.castShadow = false;
  root.add(glowMesh);

  const slots = new SlotMarkers(def.slots, heightAt, palette, params);
  root.add(slots.mesh);

  const debugOverlay = buildLaneOverlay(def, heightAt);
  debugOverlay.visible = false;
  root.add(debugOverlay);

  return {
    name: def.name,
    root,
    heightAt,
    size: def.size,
    collider,
    home: {
      x: def.camera.home[0],
      z: def.camera.home[1],
      yaw: def.camera.yaw,
      distance: def.camera.distance,
    },
    stats: { instances: instances + def.slots.length, batches: 3 },
    flameIntensity: flameMat.intensity,
    def,
    slots,
    debugOverlay,
  };
};

/** Koridorlar (kırmızı) ve spawn işaretleri — debug panelinden açılır. */
const buildLaneOverlay = (def: MapDef, heightAt: HeightFn): LineSegments => {
  const pts: number[] = [];
  const y = (x: number, z: number) => heightAt(x, z) + 1.2;
  for (const lane of def.lanes) {
    for (let i = 0; i + 1 < lane.points.length; i++) {
      const [ax, az] = lane.points[i] as Vec2;
      const [bx, bz] = lane.points[i + 1] as Vec2;
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 4);
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps;
        const t1 = (k + 1) / steps;
        const x0 = ax + (bx - ax) * t0;
        const z0 = az + (bz - az) * t0;
        const x1 = ax + (bx - ax) * t1;
        const z1 = az + (bz - az) * t1;
        pts.push(x0, y(x0, z0), z0, x1, y(x1, z1), z1);
      }
    }
  }
  for (const s of def.spawns) {
    const [x, z] = s.pos;
    const h = y(x, z);
    pts.push(x - 4, h, z, x + 4, h, z, x, h, z - 4, x, h, z + 4, x, h, z, x, h + 10, z);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
  const lines = new LineSegments(geo, new LineBasicNodeMaterial({ color: '#ff3b2f', depthTest: false }));
  lines.renderOrder = 10;
  lines.name = 'lane-overlay';
  return lines;
};
