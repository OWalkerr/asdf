import {
  BUILDING_DEFS,
  BUILDING_KINDS,
  BUILDING_LEVEL,
  FREE_BUILD,
  type MapDef,
  SNAP_STRUCT_INTS,
  type SnapshotFrame,
  unpackQueueLen,
  unpackQueuePct,
  unpackQueueUnit,
  unpackStructKind,
  unpackStructLevel,
  unpackStructSlot,
  unpackStructTeam,
} from '@bulwark/shared';
import { type BufferGeometry, InstancedMesh, Matrix4, Quaternion, type Texture, Vector3 } from 'three/webgpu';
import { catapultModel } from '../map/prefabs';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';
import { retintTeam } from '../teamTint';
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
  /** İşçiyle serbest inşa edildi (harita slotu değil). */
  free: boolean;
  /** Sahip takım (eşlenmiş; 0 = biz). */
  team: number;
  /** Yapının üst noktası (can çubuğu yüksekliği). */
  top: number;
}

export const MODELS: Record<
  string,
  { build: () => BufferGeometry; height: number; footprint: [number, number] }
> = {
  arrow_tower: { build: arrowTowerModel, height: 12.5, footprint: [2.2, 2.2] },
  barracks: { build: barracksModel, height: 8.2, footprint: [5.4, 4.2] },
  forge: { build: forgeModel, height: 7.5, footprint: [4.6, 3.6] },
  catapult: { build: catapultModel, height: 5.5, footprint: [2.6, 2.6] },
  farm: { build: farmModel, height: 5.8, footprint: [4.6, 4.2] },
};

const UP = new Vector3(0, 1, 0);
/** Serbest yapının yönü: ön yüzü (+Z) kaleye dönük. */
export const faceYaw = (def: MapDef, x: number, z: number): number =>
  Math.atan2(def.citadel.pos[0] - x, def.citadel.pos[1] - z);

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
  /** Takım (eşlenmiş, 0 = biz) × yapı türü; rakip yapılar kendi takım renginde. */
  private readonly kindMeshes: InstancedMesh[][] = [];
  /** Bütün kaleler (çatışmada birden çok): takım, can, konum. */
  readonly fortresses: { eid: number; team: number; hp: number; max: number; x: number; z: number }[] = [];
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
    // Harita slotları + serbest inşa edilen yapılar (işçiyle).
    const cap = Math.max(1, def.slots.length) + FREE_BUILD.max;
    const teams = def.mode === 'VS' ? 4 : 1;
    for (let t = 0; t < teams; t++) {
      const row: InstancedMesh[] = [];
      for (const kind of BUILDING_KINDS) {
        const model = MODELS[kind];
        if (!model) throw new Error(`Yapı modeli yok: ${kind}`);
        const mesh = new InstancedMesh(retintTeam(model.build(), t), mat, cap);
        mesh.name = `structures:${kind}:${t}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.count = 0;
        row.push(mesh);
        this.meshes.push(mesh);
      }
      this.kindMeshes.push(row);
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
    const counts = this.kindMeshes.map((row) => row.map(() => 0));
    this.fortresses.length = 0;
    let scaffolds = 0;
    const st = frame.structures;
    this.gateRepair.length = 0;
    for (let i = 0; i < frame.structCount; i++) {
      const o = i * SNAP_STRUCT_INTS;
      const kp = st[o + 1] as number;
      const kind = unpackStructKind(kp) - 1;
      const slot = unpackStructSlot(kp);
      const team = unpackStructTeam(kp);
      if (kind < 0) {
        this.gateRepair[slot] = st[o + 4] as number;
        continue;
      }
      if (kind === 8) {
        const f = { hp: st[o + 2] as number, max: st[o + 3] as number };
        if (team === 0) this.fortress = f;
        this.fortresses.push({
          eid: st[o] as number,
          team,
          ...f,
          x: (st[o + 6] as number) / 65536,
          z: (st[o + 7] as number) / 65536,
        });
        continue;
      }
      const kindKey = BUILDING_KINDS[kind];
      const slotDef = this.def.slots[slot];
      const tRow = Math.min(team, this.kindMeshes.length - 1);
      const mesh = this.kindMeshes[tRow]?.[kind];
      if (!kindKey || !mesh) continue;
      const bdef = BUILDING_DEFS[kindKey];
      const model = MODELS[kindKey] as (typeof MODELS)[string];
      // Harita slotu: tanımlı konum; serbest yapı: snapshot konumu (zeminde, kaleye dönük).
      const free = !slotDef;
      const x = free ? (st[o + 6] as number) / 65536 : slotDef.pos[0];
      const z = free ? (st[o + 7] as number) / 65536 : slotDef.pos[1];
      const y = this.heightAt(x, z) + (slotDef?.elevation ?? 0);
      if (free) this.q.setFromAxisAngle(UP, faceYaw(this.def, x, z));
      else this.q.identity();
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
        free,
        team,
        top: y + model.height * Math.max(0.15, built) * (1 + 0.09 * (level - 1)),
      };
      this.bySlot.set(slot, info);
      // Yükselme: alttan büyür; tamamlanınca hafif "oturma" yok, doğrudan tam boy.
      const rise = built >= 1 ? 1 : 0.08 + 0.92 * built;
      // Seviye: her seviyede biraz daha iri ve yüksek (BFME2'de yükseltilen yapı büyür).
      const grow = 1 + 0.09 * (level - 1);
      this.m.compose(this.p.set(x, y, z), this.q, this.s.set(grow, rise * grow, grow));
      const cRow = counts[tRow] as number[];
      mesh.setMatrixAt(cRow[kind] as number, this.m);
      cRow[kind] = (cRow[kind] as number) + 1;
      if (built < 1 || upgrading >= 0) {
        const [fx, fz] = model.footprint;
        this.m.compose(this.p.set(x, y, z), this.q, this.s.set(fx, model.height / 6, fz));
        this.scaffold.setMatrixAt(scaffolds++, this.m);
      }
    }
    this.kindMeshes.forEach((row, t) => {
      row.forEach((mesh, k) => {
        mesh.count = counts[t]?.[k] as number;
        mesh.instanceMatrix.needsUpdate = true;
      });
    });
    this.scaffold.count = scaffolds;
    this.scaffold.instanceMatrix.needsUpdate = true;
  }
}
