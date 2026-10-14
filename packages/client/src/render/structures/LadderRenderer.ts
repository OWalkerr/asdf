import {
  type MapDef,
  SNAP_STRUCT_INTS,
  type SnapshotFrame,
  unpackStructKind,
  unpackStructSlot,
} from '@bulwark/shared';
import type { LadderSpot, NavGrid } from '@bulwark/sim';
import { ladderSpots } from '@bulwark/sim';
import {
  BoxGeometry,
  type BufferGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  type Texture,
  Vector3,
} from 'three/webgpu';
import { merge, paint, place, verticalShade } from '../geometry/lowpoly';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';

/**
 * Sura dayalı kuşatma merdivenleri (BFME2): snapshot'taki Ladder yapıları (kind 5, slot =
 * koridor × 8 + nokta) sim'in kullandığı aynı noktalardan (ladderSpots) yerleştirilir: dış
 * ayaktan sur tepesine eğik. `climb(x, z)`: merdiven geçidindeki birimin ek yüksekliği (dış
 * ayaktan sur tepesine tırmanır, içeride iner) — UnitRenderer zemin yüksekliğine eklenir.
 */
const LADDER_KIND = 5;

const ladderGeometry = (): BufferGeometry => {
  // Yerel: +x boyunca uzunluk 1 (ölçekle uzar), z genişlik.
  const parts: BufferGeometry[] = [];
  for (const z of [-0.45, 0.45]) parts.push(paint(place(new BoxGeometry(1, 0.14, 0.14), 0.5, 0, z), 'wood'));
  for (let k = 0; k < 12; k++)
    parts.push(paint(place(new BoxGeometry(0.015, 0.08, 0.9), 0.05 + k * 0.08, 0, 0), 'woodDark'));
  return verticalShade(merge(parts), 0.85, 1.05);
};

export class LadderRenderer {
  readonly mesh: InstancedMesh;
  private readonly spots: LadderSpot[][];
  private readonly active: LadderSpot[] = [];
  private lastTick = -1;
  private readonly m = new Matrix4();
  private readonly v = new Vector3();
  private readonly s = new Vector3();
  private readonly e = new Vector3();

  constructor(
    def: MapDef,
    grid: NavGrid,
    private readonly groundY: (x: number, z: number) => number,
    palette: Texture,
    params: ToonParams,
  ) {
    this.spots = ladderSpots(def, grid);
    this.mesh = new InstancedMesh(ladderGeometry(), createToonMaterial(palette, params), 24);
    this.mesh.name = 'ladders';
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(frame: SnapshotFrame): void {
    if (frame.tick === this.lastTick) return;
    this.lastTick = frame.tick;
    this.active.length = 0;
    const st = frame.structures;
    for (let i = 0; i < frame.structCount; i++) {
      const o = i * SNAP_STRUCT_INTS;
      const kp = st[o + 1] as number;
      if (unpackStructKind(kp) !== LADDER_KIND) continue;
      const slot = unpackStructSlot(kp);
      const spot = this.spots[slot >> 3]?.[slot & 7];
      if (spot) this.active.push(spot);
    }
    let n = 0;
    for (const sp of this.active) {
      if (n >= 24) break;
      // Dış ayak (sur ekseninden 5.5 m) → sur tepesi: belirgin eğimle yaslanır.
      const fx = sp.p[0] + sp.n[0] * 5.5;
      const fz = sp.p[1] + sp.n[1] * 5.5;
      const fy = this.groundY(fx, fz);
      const tx = sp.p[0] + sp.n[0] * 1.2;
      const tz = sp.p[1] + sp.n[1] * 1.2;
      const ty = this.groundY(sp.p[0], sp.p[1]) + sp.height + 1.4;
      this.e.set(tx - fx, ty - fy, tz - fz);
      const len = this.e.length();
      // Taban: X merdiven boyu, Z sur boyunca (basamak genişliği), Y = Z × X (sura dik).
      const X = this.e.normalize();
      const Z = this.s.set(-sp.n[1], 0, sp.n[0]).normalize();
      const Y = this.v.crossVectors(Z, X).normalize();
      this.m.makeBasis(X.clone().multiplyScalar(len), Y, Z).setPosition(fx, fy, fz);
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Merdiven geçidindeki noktanın ek yüksekliği (m): dış ayaktan tepeye çıkar, içeride iner. */
  climb(x: number, z: number): number {
    let h = 0;
    for (const sp of this.active) {
      const dx = x - sp.p[0];
      const dz = z - sp.p[1];
      const s = dx * sp.n[0] + dz * sp.n[1]; // +: dış taraf
      const lat = Math.abs(dx * sp.n[1] - dz * sp.n[0]);
      if (lat > 1.8 || s > 5.5 || s < -4.5) continue;
      const k = s >= 1.2 ? 1 - (s - 1.2) / 4.3 : s >= -1.2 ? 1 : 1 + (s + 1.2) / 3.3;
      h = Math.max(h, (sp.height + 0.6) * Math.max(0, k));
    }
    return h;
  }
}
