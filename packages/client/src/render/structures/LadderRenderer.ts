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
const TOWER_KIND = 6;

const ladderGeometry = (): BufferGeometry => {
  // Yerel: +x boyunca uzunluk 1 (ölçekle uzar), z genişlik.
  const parts: BufferGeometry[] = [];
  for (const z of [-0.45, 0.45]) parts.push(paint(place(new BoxGeometry(1, 0.14, 0.14), 0.5, 0, z), 'wood'));
  for (let k = 0; k < 12; k++)
    parts.push(paint(place(new BoxGeometry(0.015, 0.08, 0.9), 0.05 + k * 0.08, 0, 0), 'woodDark'));
  return verticalShade(merge(parts), 0.85, 1.05);
};

/** Sura yanaşmış kuşatma kulesi: yerel +x sura doğru, yükseklik 1 → ölçekle sur boyuna uzar. */
const towerGeometry = (): BufferGeometry => {
  const parts: BufferGeometry[] = [];
  for (const x of [-1.3, 1.3])
    for (const z of [-1.3, 1.3]) parts.push(paint(place(new BoxGeometry(0.24, 1, 0.24), x, 0.5, z), 'wood'));
  for (const y of [0.25, 0.5, 0.75])
    parts.push(paint(place(new BoxGeometry(2.9, 0.025, 2.8), 0, y, 0), 'woodDark'));
  parts.push(paint(place(new BoxGeometry(0.12, 0.9, 2.7), -1.4, 0.5, 0), 'leather'));
  for (const z of [-1.35, 1.35])
    parts.push(paint(place(new BoxGeometry(2.7, 0.9, 0.1), 0, 0.5, z), 'leather'));
  parts.push(paint(place(new BoxGeometry(2.6, 0.03, 2.4), 2.4, 0.98, 0), 'woodDark')); // indirilmiş köprü
  for (const x of [-1.2, 1.2])
    for (const z of [-1.5, 1.5])
      parts.push(paint(place(new BoxGeometry(1.1, 0.12, 0.25), x, 0.06, z), 'woodDark'));
  return verticalShade(merge(parts), 0.75, 1.05);
};

export class LadderRenderer {
  readonly mesh: InstancedMesh;
  readonly towers: InstancedMesh;
  private readonly spots: LadderSpot[][];
  private readonly active: { spot: LadderSpot; tower: boolean }[] = [];
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
    this.towers = new InstancedMesh(towerGeometry(), createToonMaterial(palette, params), 12);
    this.towers.name = 'siege-towers';
    this.towers.castShadow = true;
    this.towers.frustumCulled = false;
    this.towers.count = 0;
  }

  update(frame: SnapshotFrame): void {
    if (frame.tick === this.lastTick) return;
    this.lastTick = frame.tick;
    this.active.length = 0;
    const st = frame.structures;
    for (let i = 0; i < frame.structCount; i++) {
      const o = i * SNAP_STRUCT_INTS;
      const kp = st[o + 1] as number;
      const kind = unpackStructKind(kp);
      if (kind !== LADDER_KIND && kind !== TOWER_KIND) continue;
      const slot = unpackStructSlot(kp);
      const spot = this.spots[slot >> 3]?.[slot & 7];
      if (spot) this.active.push({ spot, tower: kind === TOWER_KIND });
    }
    let n = 0;
    let nt = 0;
    for (const { spot: sp, tower } of this.active) {
      if (tower) {
        if (nt >= 12) continue;
        // Kule gövdesi surun dışında, köprüsü sur tepesine iner.
        const cx = sp.p[0] + sp.n[0] * 4.6;
        const cz = sp.p[1] + sp.n[1] * 4.6;
        const h = sp.height + 2.2;
        const X = this.e.set(-sp.n[0], 0, -sp.n[1]);
        const Y = this.v.set(0, h, 0);
        const Z = this.s.set(sp.n[1], 0, -sp.n[0]); // sağ el tabanı (det > 0)
        this.m.makeBasis(X, Y, Z).setPosition(cx, this.groundY(cx, cz), cz);
        this.towers.setMatrixAt(nt++, this.m);
        continue;
      }
      if (n >= 24) continue;
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
    this.towers.count = nt;
    this.towers.instanceMatrix.needsUpdate = true;
  }

  /** Merdiven geçidindeki noktanın ek yüksekliği (m): dış ayaktan tepeye çıkar, içeride iner. */
  climb(x: number, z: number): number {
    let h = 0;
    for (const { spot: sp, tower } of this.active) {
      const dx = x - sp.p[0];
      const dz = z - sp.p[1];
      const s = dx * sp.n[0] + dz * sp.n[1]; // +: dış taraf
      const lat = Math.abs(dx * sp.n[1] - dz * sp.n[0]);
      if (lat > (tower ? 2.6 : 1.8) || s > (tower ? 6.5 : 5.5) || s < -4.5) continue;
      const k = s >= 1.2 ? 1 - (s - 1.2) / 4.3 : s >= -1.2 ? 1 : 1 + (s + 1.2) / 3.3;
      h = Math.max(h, (sp.height + 0.6) * Math.max(0, k));
    }
    return h;
  }
}
