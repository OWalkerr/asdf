import { InstancedMesh, Matrix4, MeshBasicNodeMaterial, RingGeometry } from 'three/webgpu';
import type { UnitRenderer } from '../units/UnitRenderer';

/**
 * Seçili taburların askerlerinin ayağındaki altın halkalar (BFME2 seçim göstergesi).
 * Tek InstancedMesh; her kare seçili askerlerle yeniden doldurulur.
 */
export class SelectionRings {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();

  constructor(capacity: number) {
    // Yerde yatan düz halka (yukarıdan bakan RTS kamerasında net okunur).
    const ring = new RingGeometry(0.42, 0.62, 12).rotateX(-Math.PI / 2);
    const mat = new MeshBasicNodeMaterial({
      color: '#f2cf63',
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.mesh = new InstancedMesh(ring, mat, capacity);
    this.mesh.name = 'selection-rings';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.count = 0;
  }

  update(units: UnitRenderer, selected: ReadonlySet<number>): void {
    let n = 0;
    if (selected.size > 0) {
      const cap = this.mesh.instanceMatrix.count;
      units.forEach((x, y, z, battalion) => {
        if (n >= cap || !selected.has(battalion)) return;
        this.m.makeTranslation(x, y + 0.06, z);
        this.mesh.setMatrixAt(n++, this.m);
      });
    }
    this.mesh.count = n;
    if (n > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
