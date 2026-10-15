import { type MapDef, Rng, type Vec2 } from '@bulwark/shared';
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicNodeMaterial,
  LineSegments,
  Matrix4,
  PointLight,
  Quaternion,
  type Texture,
  Vector3,
} from 'three/webgpu';
import { paint } from '../render/geometry/lowpoly';
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
import type { Swatch } from '../render/palette';

/**
 * Veriye dayalı harita oluşturucu (özgün FD/TD haritaları): arazi, nehir ve köprüler, surlar,
 * kapı çerçeveleri (kanatlar GateRenderer'da), kale burcu, meşaleler ve dekor tamamen MapDef'ten
 * üretilir. Oynanış (nav, slotlar, dalgalar) sim tarafında aynı veriden kurulur.
 */
const DEG = Math.PI / 180;

const segDist = (x: number, z: number, a: Vec2, b: Vec2): { d: number; t: number } => {
  const abx = b[0] - a[0];
  const abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * abx + (z - a[1]) * abz) / len2)) : 0;
  return { d: Math.hypot(x - (a[0] + abx * t), z - (a[1] + abz * t)), t };
};
const polyDist = (x: number, z: number, pts: readonly Vec2[]): number => {
  let d = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < pts.length; i++)
    d = Math.min(d, segDist(x, z, pts[i] as Vec2, pts[i + 1] as Vec2).d);
  return d;
};
const inPolygon = (x: number, z: number, pts: readonly Vec2[]): boolean => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i] as Vec2;
    const [xj, zj] = pts[j] as Vec2;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};
/** Havzanın dışında kalan mesafe (içerideyse 0). */
const outside = (x: number, z: number, basins: readonly (readonly Vec2[])[]): number => {
  if (basins.length === 0) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const b of basins) {
    if (inPolygon(x, z, b)) return 0;
    best = Math.min(best, polyDist(x, z, [...b, b[0] as Vec2]));
  }
  return best;
};

const THEMES: Record<string, { grass: Swatch[]; low: Swatch }> = {
  meadow: { grass: ['grass', 'grassDark', 'grassDry'], low: 'grassDark' },
  autumn: { grass: ['grassDry', 'grass', 'grassDark'], low: 'grassDry' },
  dark: { grass: ['grassDark', 'rockDark', 'grassDark'], low: 'rockDark' },
  snow: { grass: ['snow', 'rockLight', 'snow'], low: 'snow' },
};

export const createGenericHeight = (def: MapDef): HeightFn => {
  const t = def.terrain;
  const basins = t.basins ?? [];
  const td = def.mode === 'TD';
  return (x, z) => {
    let h = (fbm(x / 50, z / 50, def.seed) - 0.5) * (td ? 2 : 3.5);
    const out = outside(x, z, basins);
    if (out > 0) {
      const rise = smoothstep(0, 22, out);
      h += rise * 28 + out * 0.12 + fbm(x / 20, z / 20, def.seed + 5) * 22 * smoothstep(0, 12, out);
    }
    for (const p of t.plateaus) {
      const r = Math.hypot(x - p.center[0], z - p.center[1]);
      h += (p.height - h) * (1 - smoothstep(p.radius - 2, p.radius + 9, r));
    }
    for (const r of t.ramps) {
      const s = segDist(x, z, r.from, r.to);
      const target = r.fromHeight + (r.toHeight - r.fromHeight) * s.t;
      h += (target - h) * (1 - smoothstep(r.width / 2, r.width / 2 + 6, s.d));
    }
    // TD: yollar çukur patika, aradaki alanlar hafif yüksek kule setleri.
    for (const road of t.roads ?? []) {
      const d = polyDist(x, z, road.points);
      if (td) h += smoothstep(road.width / 2, road.width / 2 + 5, d) * 1.6 - 0.4;
      else h += (Math.min(h, 0.4) - h) * (1 - smoothstep(road.width / 2 + 1, road.width / 2 + 5, d));
    }
    for (const river of t.rivers ?? []) {
      const d = polyDist(x, z, river.points);
      const onBridge = (t.bridges ?? []).some((b) => segDist(x, z, b.a, b.b).d < b.width / 2 + 1.5);
      const carve = 1 - smoothstep(river.width / 2 - 3, river.width / 2 + 4, d);
      if (onBridge) h = h * (1 - carve) + 0.2 * carve;
      else h -= carve * (3.6 + h * 0.5);
    }
    return h;
  };
};

const createGenericPaint = (def: MapDef): PaintFn => {
  const t = def.terrain;
  const theme = THEMES[t.theme ?? 'meadow'] ?? (THEMES.meadow as (typeof THEMES)['meadow']);
  return (avgY, slope, x, z) => {
    if (avgY < -1.6) return avgY < -2.6 ? 'waterDeep' : 'water';
    if (slope > 0.6) return avgY > 26 ? 'rockLight' : 'rock';
    if (slope > 0.4) return 'rockDark';
    if (avgY > 34) return 'snow';
    if (avgY > 16) return 'rockDark';
    for (const b of t.bridges ?? []) if (segDist(x, z, b.a, b.b).d < b.width / 2) return 'helmStone';
    for (const p of t.plateaus)
      if (Math.hypot(x - p.center[0], z - p.center[1]) < p.radius - 4) return 'rockLight';
    const n = valueNoise(x / 16, z / 16, def.seed + 99);
    return n > 0.6
      ? (theme.grass[2] as Swatch)
      : n < 0.25
        ? (theme.grass[1] as Swatch)
        : (theme.grass[0] as Swatch);
  };
};

export const buildGenericMap = (palette: Texture, params: ToonParams, def: MapDef, faction = 0): MapScene => {
  const heightAt = createGenericHeight(def);
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
  const torches: [number, number, number][] = [];
  const brazier = P.brazierBase();
  const flame = P.brazierFlame(rand);
  const post = P.torchPost();
  const torch = P.torchFlame(rand);

  // --- Arazi -------------------------------------------------------------------
  const grid = { size: def.size, segments: Math.round(def.size / 2.5) };
  solid.add(buildTerrainGeometry(grid, heightAt, createGenericPaint(def)), new Matrix4(), true);

  // --- Yollar: araziye oturan pürüzsüz şeritler (üçgen boyamasındaki basamaklanma olmasın) ----
  for (const road of def.terrain.roads ?? [])
    solid.add(
      roadRibbon(road.points, road.width, heightAt, def.mode === 'TD' ? 'dirt' : 'dirtDark'),
      new Matrix4(),
    );

  // --- Surlar ------------------------------------------------------------------
  const nearGate = (x: number, z: number, pad: number) =>
    def.gates.some((g) => Math.hypot(x - g.pos[0], z - g.pos[1]) < g.width / 2 + pad);
  for (const wall of def.walls) {
    const pts = wall.points;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i] as Vec2;
      const [bx, bz] = pts[i + 1] as Vec2;
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / 8));
      const segLen = len / n;
      const dx = (bx - ax) / len;
      const dz = (bz - az) / len;
      // Dış yüz (+Z yerel) merkezden uzağa baksın.
      let rot = -Math.atan2(dz, dx);
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      if (-dz * (mx - cx) + dx * (mz - cz) < 0) rot += Math.PI;
      const seg = P.deepingWallSegment(segLen + 0.05, wall.height, wall.thickness);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        if (nearGate(x, z, 1.5)) continue;
        const y =
          Math.min(
            heightAt(x - dx * segLen * 0.5, z - dz * segLen * 0.5),
            heightAt(x + dx * segLen * 0.5, z + dz * segLen * 0.5),
          ) - 0.6;
        solid.add(seg, at(x, z, rot, 1, y), true);
        if (k % 2 === 0 && !nearGate(x, z, 6)) {
          const ix = x + Math.sin(rot) * -(wall.thickness / 2 - 0.7);
          const iz = z + Math.cos(rot) * -(wall.thickness / 2 - 0.7);
          solid.add(post, at(ix, iz, 0, 1, y + wall.height + 0.6));
          glow.add(torch, at(ix, iz, rand() * 6, 1, y + wall.height + 0.6));
          torches.push([ix, y + wall.height + 2.6, iz]);
        }
      }
    }
    const tower = P.wallTower(wall.height + 3);
    for (let i = 1; i + 1 < pts.length; i++) {
      const [x, z] = pts[i] as Vec2;
      if (nearGate(x, z, 4) || outside(x, z, def.terrain.basins ?? []) > 2) continue;
      solid.add(tower, at(x, z, rand() * 6, 0.62, heightAt(x, z) - 0.6), true);
    }
  }

  // --- Kapı çerçeveleri + mangallar ------------------------------------------------
  const frame = P.gateFrame('helmStone');
  for (const g of def.gates) {
    const rot = Math.PI / 2 - g.facing * DEG;
    const s = Math.max(0.8, (g.width + 4) / 9);
    const y = heightAt(g.pos[0], g.pos[1]) - 0.3;
    solid.add(frame, at(g.pos[0], g.pos[1], rot, s, y), true);
    const fx = Math.cos(g.facing * DEG);
    const fz = Math.sin(g.facing * DEG);
    for (const side of [-1, 1]) {
      const bx = g.pos[0] + fx * 5.5 - fz * side * (g.width / 2 + 3);
      const bz = g.pos[1] + fz * 5.5 + fx * side * (g.width / 2 + 3);
      solid.add(brazier, at(bx, bz));
      glow.add(flame, at(bx, bz, rand() * 6));
    }
    torches.push([g.pos[0] + fx * 6, y + 4, g.pos[1] + fz * 6]);
  }

  // --- Köprüler -----------------------------------------------------------------
  for (const b of def.terrain.bridges ?? []) {
    const len = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]);
    const rot = Math.atan2(b.b[0] - b.a[0], b.b[1] - b.a[1]);
    const cx = (b.a[0] + b.b[0]) / 2;
    const cz = (b.a[1] + b.b[1]) / 2;
    solid.add(P.bridgeDeck(len, b.width), at(cx, cz, rot, 1, 0.05), true);
  }

  // --- Kale -----------------------------------------------------------------------
  const c = def.citadel;
  const keepRot = Math.PI / 2 - (c.facing ?? 90) * DEG;
  const keepY = heightAt(c.pos[0], c.pos[1]) + (c.elevation ?? 0) - 0.4;
  // Kale: Gondor taş kalesi, Rohan'ın Altın Salonu, Lórien'in mallorn kalesi veya Orthanc (taraf seçimi).
  const keep =
    faction === 1
      ? P.rohanKeep()
      : faction === 2
        ? P.elfKeep()
        : faction === 3
          ? P.isengardKeep()
          : P.fortressKeep();
  solid.add(keep, at(c.pos[0], c.pos[1], keepRot, def.mode === 'TD' ? 0.7 : 1, keepY), true);
  if (c.door) {
    for (const side of [-1, 1]) {
      const dx = Math.cos((c.facing ?? 90) * DEG);
      const dz = Math.sin((c.facing ?? 90) * DEG);
      const bx = c.door[0] - dz * side * 5;
      const bz = c.door[1] + dx * side * 5;
      solid.add(brazier, at(bx, bz));
      glow.add(flame, at(bx, bz, rand() * 6));
    }
    torches.push([c.door[0], heightAt(c.door[0], c.door[1]) + 4, c.door[1]]);
  }

  // --- Dekor ----------------------------------------------------------------------
  const pines = [P.pineTree(rand), P.pineTree(rand), P.pineTree(rand)];
  const broads = [P.broadleafTree(rand), P.broadleafTree(rand)];
  const rocks = [P.rock(rand, 1.2), P.rock(rand, 2.2), P.rock(rand, 3.6)];
  // Uç bölge (Tower Wars): mangallı taş çember.
  const zone = def.endZone;
  const zoneAt = def.lanes[0]?.points.at(-1);
  if (zone && zoneAt) {
    const r = zone.radius + 1;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = zoneAt[0] + Math.cos(a) * r;
      const z = zoneAt[1] + Math.sin(a) * r;
      if (i % 3 === 0) {
        solid.add(brazier, at(x, z));
        glow.add(flame, at(x, z, rand() * 6));
        if (i % 6 === 0) torches.push([x, heightAt(x, z) + 3, z]);
      } else solid.add(rocks[0] as BufferGeometry, at(x, z, rand() * 6, 0.6));
    }
  }

  const tufts = [P.grassTuft(rand, 'grass'), P.grassTuft(rand, 'grassDark'), P.grassTuft(rand, 'grassDry')];
  const half = def.size / 2 - 4;
  const basins = def.terrain.basins ?? [];
  const clear = (x: number, z: number, pad: number) => {
    for (const r of def.terrain.roads ?? []) if (polyDist(x, z, r.points) < r.width / 2 + pad) return false;
    for (const r of def.terrain.rivers ?? []) if (polyDist(x, z, r.points) < r.width / 2 + pad) return false;
    for (const w of def.walls) if (polyDist(x, z, w.points) < w.thickness + pad + 2) return false;
    for (const s of def.slots) if (Math.hypot(x - s.pos[0], z - s.pos[1]) < 7 + pad) return false;
    for (const g of def.gates) if (Math.hypot(x - g.pos[0], z - g.pos[1]) < 12 + pad) return false;
    for (const l of def.lanes) if (def.mode === 'FD' && polyDist(x, z, l.points) < 7 + pad) return false;
    if (Math.hypot(x - c.pos[0], z - c.pos[1]) < c.radius + 12 + pad) return false;
    for (const p of def.terrain.plateaus)
      if (Math.hypot(x - p.center[0], z - p.center[1]) < p.radius + pad) return false;
    return true;
  };
  const insideWalls = (x: number, z: number) =>
    def.walls.some((w) => {
      const pts = w.points;
      return pts.length > 3 && inPolygon(x, z, pts);
    });
  for (let i = 0; i < 2200; i++) {
    const x = (rand() * 2 - 1) * half;
    const z = (rand() * 2 - 1) * half;
    const out = outside(x, z, basins);
    const y = heightAt(x, z);
    if (out > 0) {
      if (y > 30) continue;
      const slope = Math.abs(heightAt(x + 1.5, z) - y) + Math.abs(heightAt(x, z + 1.5) - y);
      solid.add(
        slope > 1.4 ? pick(rocks) : pick(pines),
        at(x, z, rand() * 6.28, 0.8 + rand() * 0.7, y - 0.3),
      );
      continue;
    }
    if (!clear(x, z, 2) || insideWalls(x, z)) continue;
    const r = rand();
    if (def.mode === 'TD' ? r < 0.35 : r < 0.18)
      solid.add(
        r < 0.12 ? pick(rocks) : rand() < 0.5 ? pick(broads) : pick(pines),
        at(x, z, rand() * 6.28, 0.8 + rand() * 0.6, y - 0.2),
      );
  }
  for (let i = 0; i < 5000; i++) {
    const x = (rand() * 2 - 1) * half;
    const z = (rand() * 2 - 1) * half;
    if (outside(x, z, basins) > 0 || !clear(x, z, 0)) continue;
    const y = heightAt(x, z);
    if (y < -1) continue;
    solid.add(pick(tufts), at(x, z, rand() * 6.28, 0.8 + rand() * 0.9, y - 0.05));
  }

  // --- Batch'ler + ışıklar ----------------------------------------------------------
  const root = new Group();
  root.name = def.id;
  const collider = solid.buildCollider();
  const instances = solid.instanceCount + glow.instanceCount;
  root.add(solid.build(createToonMaterial(palette, params), 'static-toon'));
  const flameMat = createFlameMaterial(palette);
  const glowMesh = glow.build(flameMat.material, 'static-glow');
  glowMesh.castShadow = false;
  root.add(glowMesh);
  const lightSpots = [
    ...def.gates.map(
      (g) => [g.pos[0], heightAt(g.pos[0], g.pos[1]) + 5, g.pos[1]] as [number, number, number],
    ),
  ];
  if (c.door) lightSpots.push([c.door[0], heightAt(c.door[0], c.door[1]) + 5, c.door[1]]);
  for (const k of [0.25, 0.75]) {
    const tp = torches[Math.floor(torches.length * k)];
    if (tp) lightSpots.push(tp);
  }
  for (const [x, y, z] of lightSpots.slice(0, 7)) {
    const l = new PointLight('#ff9a48', 55, 32, 1.6);
    l.position.set(x, y, z);
    root.add(l);
  }
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
    terrainGrid: grid,
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

/**
 * Yol şeridi: çoklu çizgi boyunca ~2.5 m'de bir örneklenen, kenarları araziye oturan düz
 * dörtgen şerit (vertex color ile kenarları koyulaşır). Statik batch'e eklenir, gölge almaz değil.
 */
const roadRibbon = (
  points: readonly Vec2[],
  width: number,
  heightAt: HeightFn,
  swatch: Swatch,
): BufferGeometry => {
  const samples: [number, number, number, number][] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const [ax, az] = points[i] as Vec2;
    const [bx, bz] = points[i + 1] as Vec2;
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / 2.5));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      samples.push([ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / len, (bz - az) / len]);
    }
  }
  const pos: number[] = [];
  const col: number[] = [];
  const hw = width / 2;
  const edge = (x: number, z: number, nx: number, nz: number, s: number): [number, number, number] => {
    const px = x + nx * s;
    const pz = z + nz * s;
    return [px, heightAt(px, pz) + 0.45, pz];
  };
  for (let i = 0; i + 1 < samples.length; i++) {
    const [x0, z0, dx0, dz0] = samples[i] as [number, number, number, number];
    const [x1, z1, dx1, dz1] = samples[i + 1] as [number, number, number, number];
    // Köşelerde normal ortalaması (birleşim yerinde boşluk kalmasın).
    const n0 = [-dz0, dx0];
    const n1 = [-dz1, dx1];
    const lanes = [-hw, -hw * 0.45, hw * 0.45, hw];
    const shade = [0.78, 1, 1, 0.78];
    for (let k = 0; k + 1 < lanes.length; k++) {
      const a = edge(x0, z0, n0[0] as number, n0[1] as number, lanes[k] as number);
      const b = edge(x0, z0, n0[0] as number, n0[1] as number, lanes[k + 1] as number);
      const c = edge(x1, z1, n1[0] as number, n1[1] as number, lanes[k] as number);
      const d = edge(x1, z1, n1[0] as number, n1[1] as number, lanes[k + 1] as number);
      pos.push(...a, ...b, ...c, ...b, ...d, ...c);
      const sa = shade[k] as number;
      const sb = shade[k + 1] as number;
      col.push(sa, sa, sa, sb, sb, sb, sa, sa, sa, sb, sb, sb, sb, sb, sb, sa, sa, sa);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const geo = paint(g, swatch);
  geo.setAttribute('color', new Float32BufferAttribute(col, 3));
  return geo;
};

const buildLaneOverlay = (def: MapDef, heightAt: HeightFn): LineSegments => {
  const pts: number[] = [];
  for (const lane of def.lanes)
    for (let i = 0; i + 1 < lane.points.length; i++) {
      const [ax, az] = lane.points[i] as Vec2;
      const [bx, bz] = lane.points[i + 1] as Vec2;
      pts.push(ax, heightAt(ax, az) + 1.2, az, bx, heightAt(bx, bz) + 1.2, bz);
    }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
  const lines = new LineSegments(geo, new LineBasicNodeMaterial({ color: '#ff3b2f', depthTest: false }));
  lines.name = 'lane-overlay';
  return lines;
};
