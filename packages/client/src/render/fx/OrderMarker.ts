import { InstancedMesh, Matrix4, MeshBasicNodeMaterial, RingGeometry, Vector3 } from 'three/webgpu';

/** Sağ tık emrinde zeminde genişleyip sönen işaret (0.6 sn). */
export class OrderMarker {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private start = -1;

  constructor() {
    const ring = new RingGeometry(0.8, 1, 20).rotateX(-Math.PI / 2);
    const mat = new MeshBasicNodeMaterial({
      color: '#7fe08a',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.mesh = new InstancedMesh(ring, mat, 1);
    this.mesh.name = 'order-marker';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.count = 0;
  }

  show(point: Vector3, now: number): void {
    this.p.copy(point);
    this.start = now;
  }

  update(now: number): void {
    if (this.start < 0) return;
    const t = (now - this.start) / 600;
    if (t >= 1) {
      this.mesh.count = 0;
      this.start = -1;
      return;
    }
    const r = 0.6 + t * 2.4;
    this.s.set(r, 1, r);
    this.m.makeScale(this.s.x, 1, this.s.z).setPosition(this.p.x, this.p.y + 0.15, this.p.z);
    this.mesh.setMatrixAt(0, this.m);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.count = 1;
  }
}
