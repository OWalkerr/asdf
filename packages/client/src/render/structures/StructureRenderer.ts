import {
  BUILDING_DEFS,
  BUILDING_KINDS,
  type MapDef,
  SNAP_STRUCT_INTS,
  type SnapshotFrame,
  unpackQueueLen,
  unpackQueuePct,
  unpackQueueUnit,
  unpackStructKind,
  unpackStructSlot,
} from '@bulwark/shared';
import { type BufferGeometry, InstancedMesh, Matrix4, Quaternion, type Texture, Vector3 } from 'three/webgpu';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';
import { arrowTowerModel, barracksModel, scaffoldModel } from './buildingModels';

/** Snapshot'tan çözülmüş yapı durumu (komut paneli ve can çubukları için). */
export interface StructInfo {
  eid: number;
  /** BUILDING_KINDS indeksi. */
  kind: number;
  slot: number;
  hp: number;
  max: number;
  /** İnşa ilerlemesi [0, 1] (1 = tamam). */
  built: number;
  queueLen: number;
  queueUnit: number;
  /** Baştaki birimin eğitim ilerlemesi [0, 1]. */
  queuePct: number;
  x: number;
  y: number;
  z: number;
  /** Yapının üst noktası (can çubuğu yüksekliği). */
  top: number;
}

const MODELS: Record<string, { build: () => BufferGeometry; height: number; footprint: [number, number] }> = {
  arrow_tower: { build: arrowTowerModel, height: 12.5, footprint: [2.2, 2.2] },
  barracks: { build: barracksModel, height: 8.2, footprint: [5.4, 4.2] },
};

/**
 * İnşa edilmiş yapıların render'ı (GDD §13.5): yapı türü başına bir InstancedMesh + ortak
 * iskele InstancedMesh'i. İnşa sürerken yapı aşağıdan yukarı "yükselir" ve iskele görünür.
 */
export class StructureRenderer {
  readonly meshes: InstancedMesh[] = [];
  /** slot indeksi → yapı (son snapshot). */
  readonly bySlot = new Map<number, StructInfo>();
  private readonly kindMeshes: InstancedMesh[] = [];
  private readonly scaffold: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private lastTick = -2;

  constructor(
    private readonly def: MapDef,
    private readonly heightAt: (x: number, z: number) => number,
    palette: Texture,
    params: ToonParams,
  ) {
    const mat = createToonMaterial(palette, params);
    const cap = Math.max(1, def.slots.length);
    for (const kind of BUILDING_KINDS) {
      const model = MODELS[kind];
      if (!model) throw new Error(`Yapı modeli yok: ${kind}`);
      const mesh = new InstancedMesh(model.build(), mat, cap);
      mesh.name = `structures:${kind}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.kindMeshes.push(mesh);
      this.meshes.push(mesh);
    }
    this.scaffold = new InstancedMesh(scaffoldModel(), mat, cap);
    this.scaffold.name = 'structures:scaffold';
    this.scaffold.castShadow = true;
    this.scaffold.frustumCulled = false;
    this.scaffold.count = 0;
    this.meshes.push(this.scaffold);
  }

  update(frame: SnapshotFrame): void {
    if (frame.tick === this.lastTick) return;
    this.lastTick = frame.tick;
    this.bySlot.clear();
    const counts = this.kindMeshes.map(() => 0);
    let scaffolds = 0;
    const st = frame.structures;
    for (let i = 0; i < frame.structCount; i++) {
      const o = i * SNAP_STRUCT_INTS;
      const kp = st[o + 1] as number;
      const kind = unpackStructKind(kp) - 1;
      const slot = unpackStructSlot(kp);
      const kindKey = BUILDING_KINDS[kind];
      const slotDef = this.def.slots[slot];
      const mesh = this.kindMeshes[kind];
      if (!kindKey || !slotDef || !mesh) continue;
      const bdef = BUILDING_DEFS[kindKey];
      const model = MODELS[kindKey] as (typeof MODELS)[string];
      const [x, z] = slotDef.pos;
      const y = this.heightAt(x, z) + slotDef.elevation;
      const buildLeft = st[o + 4] as number;
      const built = 1 - Math.min(1, buildLeft / (bdef.buildTime * 20));
      const queue = st[o + 5] as number;
      const info: StructInfo = {
        eid: st[o] as number,
        kind,
        slot,
        hp: st[o + 2] as number,
        max: st[o + 3] as number,
        built,
        queueLen: unpackQueueLen(queue),
        queueUnit: unpackQueueUnit(queue),
        queuePct: unpackQueuePct(queue) / 100,
        x,
        y,
        z,
        top: y + model.height * Math.max(0.15, built),
      };
      this.bySlot.set(slot, info);
      // Yükselme: alttan büyür; tamamlanınca hafif "oturma" yok, doğrudan tam boy.
      const rise = built >= 1 ? 1 : 0.08 + 0.92 * built;
      this.m.compose(this.p.set(x, y, z), this.q.identity(), this.s.set(1, rise, 1));
      mesh.setMatrixAt(counts[kind] as number, this.m);
      counts[kind] = (counts[kind] as number) + 1;
      if (built < 1) {
        const [fx, fz] = model.footprint;
        this.m.compose(this.p.set(x, y, z), this.q.identity(), this.s.set(fx, model.height / 6, fz));
        this.scaffold.setMatrixAt(scaffolds++, this.m);
      }
    }
    this.kindMeshes.forEach((mesh, k) => {
      mesh.count = counts[k] as number;
      mesh.instanceMatrix.needsUpdate = true;
    });
    this.scaffold.count = scaffolds;
    this.scaffold.instanceMatrix.needsUpdate = true;
  }
}
