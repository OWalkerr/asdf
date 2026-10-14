import { type Camera, Vector3 } from 'three/webgpu';
import type { UnitRenderer } from '../render/units/UnitRenderer';

/**
 * Tabur seçimi (GDD §11.2): tıkla (en yakın askerin taburu) veya kutu çiz.
 * Seçim oyuncunun kendi takımıyla sınırlıdır; komutlar tabur eid'leriyle gönderilir.
 * Ekran izdüşümü, render'ın o karede çizdiği (ara değerli) konumlar üzerinden yapılır.
 */
export interface ScreenRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const PICK_RADIUS_PX = 22;

export class Selection {
  readonly selected = new Set<number>();
  private readonly v = new Vector3();

  constructor(
    private readonly units: UnitRenderer,
    private readonly team: number,
  ) {}

  private toScreen(
    camera: Camera,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
  ): [number, number] | null {
    this.v.set(x, y + 0.9, z).project(camera);
    if (this.v.z < -1 || this.v.z > 1) return null;
    return [((this.v.x + 1) / 2) * w, ((1 - this.v.y) / 2) * h];
  }

  /** İmlecin altındaki askerin taburu (yalnızca kendi takımı), yoksa 0. */
  pick(camera: Camera, sx: number, sy: number, w: number, h: number, anyTeam = false): number {
    let best = 0;
    let bestD = PICK_RADIUS_PX * PICK_RADIUS_PX;
    this.units.forEach((x, y, z, battalion, team) => {
      if (battalion === 0 || (!anyTeam && team !== this.team)) return;
      const p = this.toScreen(camera, x, y, z, w, h);
      if (!p) return;
      const d = (p[0] - sx) ** 2 + (p[1] - sy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = battalion;
      }
    });
    return best;
  }

  /** Kutu içindeki askerlerin taburlarını seçer. */
  box(camera: Camera, rect: ScreenRect, w: number, h: number, additive: boolean): void {
    const x0 = Math.min(rect.x0, rect.x1);
    const x1 = Math.max(rect.x0, rect.x1);
    const y0 = Math.min(rect.y0, rect.y1);
    const y1 = Math.max(rect.y0, rect.y1);
    if (!additive) this.selected.clear();
    this.units.forEach((x, y, z, battalion, team) => {
      if (battalion === 0 || team !== this.team || this.selected.has(battalion)) return;
      const p = this.toScreen(camera, x, y, z, w, h);
      if (p && p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1) this.selected.add(battalion);
    });
  }

  click(battalion: number, additive: boolean): void {
    if (!additive) this.selected.clear();
    if (battalion === 0) return;
    if (additive && this.selected.has(battalion)) this.selected.delete(battalion);
    else this.selected.add(battalion);
  }

  /** Ölü/yok olmuş taburları seçimden düşür (karede görülen tabur kümesiyle). */
  prune(): void {
    if (this.selected.size === 0) return;
    const alive = new Set<number>();
    this.units.forEach((_x, _y, _z, b) => {
      alive.add(b);
    });
    for (const b of this.selected) if (!alive.has(b)) this.selected.delete(b);
  }
}
