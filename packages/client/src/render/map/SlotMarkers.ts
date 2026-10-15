import type { SlotDef, SlotKind } from '@bulwark/shared';
import {
  type Camera,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  type Texture,
  Vector3,
} from 'three/webgpu';
import { merge, paint, place } from '../geometry/lowpoly';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';
import type { HeightFn } from './terrain';

/**
 * İnşa slotlarının görsel işaretleri (GDD §4, §11.1): taş kaide + altın halka.
 * Tek InstancedMesh; hover/seçim durumu per-instance renk ile gösterilir.
 * BFME2 serbest inşası: zemin arsaları (building / tower) gösterilmez ve seçilemez — yapılar
 * işçiyle kurulur; yalnızca sur üstü kule soketleri kalır. İşçiyle kurulan yapılar "ek slot"
 * (harita slot sayısından sonraki indeksler) olarak seçilebilir.
 */
const SHOWN: Record<SlotKind, boolean> = { wall_socket: true, tower: false, building: false };
const KIND_SCALE: Record<SlotKind, number> = { wall_socket: 0.8, tower: 0.9, building: 1.6 };

const COLORS = {
  idle: new Color(1, 1, 1),
  hover: new Color(1.6, 1.45, 0.9),
  selected: new Color(0.8, 1.7, 0.9),
};

export class SlotMarkers {
  readonly mesh: InstancedMesh;
  readonly positions: { x: number; y: number; z: number }[] = [];
  /** Serbest yapılar: slot indeksi → konum (her kare StructureRenderer'dan). */
  readonly extra = new Map<number, { x: number; y: number; z: number; r: number }>();
  private hovered = -1;
  private selected = -1;
  private readonly v = new Vector3();

  constructor(
    readonly slots: readonly SlotDef[],
    heightAt: HeightFn,
    palette: Texture,
    params: ToonParams,
  ) {
    const geo = merge([
      paint(place(new CylinderGeometry(2.2, 2.5, 0.35, 6), 0, 0.17, 0), 'gondorStone'),
      paint(place(new CylinderGeometry(2.35, 2.35, 0.12, 6, 1, true), 0, 0.4, 0), 'gold'),
      paint(place(new CylinderGeometry(1.5, 1.5, 0.08, 6), 0, 0.38, 0), 'rockLight'),
    ]);
    this.mesh = new InstancedMesh(geo, createToonMaterial(palette, params), slots.length);
    this.mesh.name = 'slot-markers';
    this.mesh.receiveShadow = true;
    const m = new Matrix4();
    slots.forEach((s, i) => {
      const [x, z] = s.pos;
      const y = heightAt(x, z) + s.elevation;
      this.positions.push({ x, y, z });
      const k = SHOWN[s.kind] ? KIND_SCALE[s.kind] : 0;
      m.makeScale(k, k > 0 ? 1 : 0, k).setPosition(x, y + 0.05, z);
      this.mesh.setMatrixAt(i, m);
      this.mesh.setColorAt(i, COLORS.idle);
    });
  }

  /**
   * Dünya noktasına en yakın slot, yoksa -1. Seçim yarıçapı slot boyutuyla ölçeklenir;
   * yükseklik farkı yarı ağırlıkla sayılır (sur üstü soket ile dibindeki zemin ayrışsın).
   */
  nearest(x: number, y: number, z: number): number {
    let best = -1;
    let bestD = Number.POSITIVE_INFINITY;
    const test = (p: { x: number; y: number; z: number }, r: number, i: number) => {
      const dx = x - p.x;
      const dz = z - p.z;
      const dy = (y - p.y) * 0.5;
      const d = dx * dx + dz * dz + dy * dy;
      if (d < r * r && d < bestD) {
        bestD = d;
        best = i;
      }
    };
    this.positions.forEach((p, i) => {
      const kind = (this.slots[i] as SlotDef).kind;
      if (SHOWN[kind]) test(p, 2.5 * KIND_SCALE[kind] + 1.5, i);
    });
    for (const [i, p] of this.extra) test(p, p.r + 1, i);
    return best;
  }

  setHovered(i: number): void {
    if (i === this.hovered) return;
    const prev = this.hovered;
    this.hovered = i;
    this.refresh(prev);
    this.refresh(i);
  }

  setSelected(i: number): void {
    const prev = this.selected;
    this.selected = i;
    this.refresh(prev);
    this.refresh(i);
  }

  get selectedIndex(): number {
    return this.selected;
  }

  /**
   * Ekran uzayında slot seçimi: slotun üstündeki yapıya (veya kaideye) tıklanınca da seçilsin.
   * `lift(i)`: slotun üzerindeki yapının yarı yüksekliği (yoksa 0).
   */
  pickScreen(
    camera: Camera,
    sx: number,
    sy: number,
    w: number,
    h: number,
    lift: (i: number) => number,
  ): number {
    let best = -1;
    let bestD = 36 * 36;
    const test = (p: { x: number; y: number; z: number }, i: number) => {
      this.v.set(p.x, p.y + lift(i), p.z).project(camera);
      if (this.v.z < -1 || this.v.z > 1) return;
      const dx = ((this.v.x + 1) / 2) * w - sx;
      const dy = ((1 - this.v.y) / 2) * h - sy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    };
    this.positions.forEach((p, i) => {
      if (SHOWN[(this.slots[i] as SlotDef).kind]) test(p, i);
    });
    for (const [i, p] of this.extra) test(p, i);
    return best;
  }

  get selectedSlot(): SlotDef | undefined {
    return this.slots[this.selected];
  }

  get hoveredSlot(): SlotDef | undefined {
    return this.slots[this.hovered];
  }

  private refresh(i: number): void {
    if (i < 0 || i >= this.slots.length) return;
    const c = i === this.selected ? COLORS.selected : i === this.hovered ? COLORS.hover : COLORS.idle;
    this.mesh.setColorAt(i, c);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
