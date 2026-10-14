import {
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  Quaternion,
  Vector3,
} from 'three/webgpu';

/**
 * Zemindeki hover imleci: yüzey normaline hizalanan ince altıgen halka.
 * Tek instance'lık InstancedMesh (Kural 1); ileride hareket emri işaretleri de buraya eklenecek.
 */
export class PickCursor {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly up = new Vector3(0, 1, 0);
  private readonly s = new Vector3(1, 1, 1);
  private readonly p = new Vector3();

  constructor() {
    const ring = new CylinderGeometry(1.6, 1.6, 0.08, 6, 1, true);
    const mat = new MeshBasicNodeMaterial({
      color: '#f5d77a',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.mesh = new InstancedMesh(ring, mat, 1);
    this.mesh.name = 'pick-cursor';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.hide();
  }

  show(point: Vector3, normal: Vector3, scale = 1): void {
    this.q.setFromUnitVectors(this.up, normal);
    this.p.copy(point).addScaledVector(normal, 0.15);
    this.s.set(scale, 1, scale);
    this.m.compose(this.p, this.q, this.s);
    this.mesh.setMatrixAt(0, this.m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.count = 1;
  }

  hide(): void {
    this.mesh.count = 0;
  }
}
