import {
  type Camera,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three/webgpu';

/**
 * Kameraya dönük can/ilerleme çubukları (BFME2 tabur/yapı çubuğu). İki InstancedMesh:
 * koyu çerçeve + renkli dolgu (sol hizalı, oranla ölçeklenir). Her kare yeniden doldurulur.
 */
export class BarRenderer {
  readonly meshes: InstancedMesh[];
  private readonly back: InstancedMesh;
  private readonly fill: InstancedMesh;
  private n = 0;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly right = new Vector3();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly c = new Color();
  private static readonly BACK = new Color('#120f0b');

  constructor(private readonly capacity: number) {
    const mat = () =>
      new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      });
    this.back = new InstancedMesh(new PlaneGeometry(1, 1), mat(), capacity);
    // Dolgu: x ∈ [0, 1] (sol kenardan büyür).
    this.fill = new InstancedMesh(new PlaneGeometry(1, 1).translate(0.5, 0, 0), mat(), capacity);
    for (const [mesh, order] of [
      [this.back, 20],
      [this.fill, 21],
    ] as const) {
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      mesh.count = 0;
      mesh.name = 'hud-bars';
      // instanceColor'ı baştan oluştur (materyal ilk derlemede renk attribute'unu görsün).
      mesh.setColorAt(0, BarRenderer.BACK);
    }
    this.meshes = [this.back, this.fill];
  }

  begin(camera: Camera): void {
    this.n = 0;
    this.q.copy(camera.quaternion);
    this.right.set(1, 0, 0).applyQuaternion(this.q);
  }

  /** (x, y, z) merkezli, `width` m genişliğinde çubuk. color: dolgu rengi. */
  push(x: number, y: number, z: number, width: number, ratio: number, color: Color | string): void {
    if (this.n >= this.capacity) return;
    const h = width * 0.12;
    this.m.compose(this.p.set(x, y, z), this.q, this.s.set(width + h * 0.6, h * 1.6, 1));
    this.back.setMatrixAt(this.n, this.m);
    this.back.setColorAt(this.n, BarRenderer.BACK);
    const r = Math.max(0, Math.min(1, ratio));
    this.p.set(x, y, z).addScaledVector(this.right, -width / 2);
    this.m.compose(this.p, this.q, this.s.set(Math.max(1e-3, width * r), h, 1));
    this.fill.setMatrixAt(this.n, this.m);
    this.fill.setColorAt(this.n, typeof color === 'string' ? this.c.set(color) : color);
    this.n++;
  }

  end(): void {
    for (const mesh of this.meshes) {
      mesh.count = this.n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}

/** Can oranına göre yeşil → sarı → kırmızı. */
export const healthColor = (ratio: number, out: Color): Color => {
  if (ratio > 0.5) return out.setRGB(0.25 + (1 - ratio) * 1.3, 0.85, 0.25);
  return out.setRGB(0.95, 0.2 + ratio * 1.3, 0.18);
};
