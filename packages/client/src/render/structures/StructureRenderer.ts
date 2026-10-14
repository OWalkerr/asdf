import {
  BUILDING_DEFS,
  BUILDING_KINDS,
  BUILDING_LEVEL,
  type MapDef,
  SNAP_STRUCT_INTS,
  type SnapshotFrame,
  unpackQueueLen,
  unpackQueuePct,
  unpackQueueUnit,
  unpackStructKind,
  unpackStructLevel,
  unpackStructSlot,
} from '@bulwark/shared';
import { type BufferGeometry, InstancedMesh, Matrix4, Quaternion, type Texture, Vector3 } from 'three/webgpu';
import { catapultModel } from '../map/prefabs';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';
import { arrowTowerModel, barracksModel, farmModel, forgeModel, scaffoldModel } from './buildingModels';

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
  /** Seviye (1–3) ve süren yükseltmenin ilerlemesi [0, 1) (−1 = yükseltme yok). */
  level: number;
  upgrading: number;
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
  forge: { build: forgeModel, height: 7.5, footprint: [4.6, 3.6] },
  catapult: { build: catapultModel, height: 5.5, footprint: [2.6, 2.6] },
  farm: { build: farmModel, height: 5.8, footprint: [4.6, 4.2] },
};

/**
 * İnşa edilmiş yapıların render'ı (GDD §13.5): yapı türü başına bir InstancedMesh + ortak
 * iskele InstancedMesh'i. İnşa sürerken yapı aşağıdan yukarı "yükselir" ve iskele görünür.
 */
export class StructureRenderer {
  readonly meshes: InstancedMesh[] = [];
  /** slot indeksi → yapı (son snapshot). */
  readonly bySlot = new Map<number, StructInfo>();
  /** Kapı indeksi → kalan onarım tick'i (0 = onarılmıyor). */
  readonly gateRepair: number[] = [];
  /** Kale (kind 9) canı. */
  fortress: { hp: number; max: number } | null = null;
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
    this.gateRepair.length = 0;
    for (let i = 0; i < frame.structCount; i++) {
      const o = i * SNAP_STRUCT_INTS;
      const kp = st[o + 1] as number;
      const kind = unpackStructKind(kp) - 1;
      const slot = unpackStructSlot(kp);
      if (kind < 0) {
        this.gateRepair[slot] = st[o + 4] as number;
        continue;
      }
      if (kind === 8) {
        this.fortress = { hp: st[o + 2] as number, max: st[o + 3] as number };
        continue;
      }
      const kindKey = BUILDING_KINDS[kind];
      const slotDef = this.def.slots[slot];
      const mesh = this.kindMeshes[kind];
      if (!kindKey || !slotDef || !mesh) continue;
      const bdef = BUILDING_DEFS[kindKey];
      const model = MODELS[kindKey] as (typeof MODELS)[string];
      const [x, z] = slotDef.pos;
      const y = this.heightAt(x, z) + slotDef.elevation;
      const buildLeft = st[o + 4] as number;
      const level = unpackStructLevel(kp);
      // Seviye > 1 iken buildLeft yükseltme süresidir: bina tam boy kalır, iskele görünür.
      const upgrading =
        level > 1 && buildLeft > 0 ? 1 - Math.min(1, buildLeft / (BUILDING_LEVEL.upgradeTime * 20)) : -1;
      const built = upgrading >= 0 ? 1 : 1 - Math.min(1, buildLeft / (bdef.buildTime * 20));
      const queue = st[o + 5] as number;
      const info: StructInfo = {
        eid: st[o] as number,
        kind,
        slot,
        hp: st[o + 2] as number,
        max: st[o + 3] as number,
        built,
        level,
        upgrading,
        queueLen: unpackQueueLen(queue),
        queueUnit: unpackQueueUnit(queue),
        queuePct: unpackQueuePct(queue) / 100,
        x,
        y,
        z,
        top: y + model.height * Math.max(0.15, built) * (1 + 0.09 * (level - 1)),
      };
      this.bySlot.set(slot, info);
      // Yükselme: alttan büyür; tamamlanınca hafif "oturma" yok, doğrudan tam boy.
      const rise = built >= 1 ? 1 : 0.08 + 0.92 * built;
      // Seviye: her seviyede biraz daha iri ve yüksek (BFME2'de yükseltilen yapı büyür).
      const grow = 1 + 0.09 * (level - 1);
      this.m.compose(this.p.set(x, y, z), this.q.identity(), this.s.set(grow, rise * grow, grow));
      mesh.setMatrixAt(counts[kind] as number, this.m);
      counts[kind] = (counts[kind] as number) + 1;
      if (built < 1 || upgrading >= 0) {
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
