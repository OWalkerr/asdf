import { type BufferGeometry, type Camera, DoubleSide, Raycaster, Vector2, Vector3 } from 'three/webgpu';
import { MeshBVH } from 'three-mesh-bvh';

/**
 * Mouse → dünya noktası (GDD §2.1: three-mesh-bvh ile hızlandırılmış raycast).
 * Collider, haritanın arazi + sur/bina geometrisinin birleşimidir (dekor hariç);
 * böylece sur üstündeki soketler de doğru yükseklikte seçilir.
 */
export interface PickHit {
  point: Vector3;
  /** Yüzey normali (dünya uzayı). */
  normal: Vector3;
  distance: number;
}

export class GroundPicker {
  private readonly bvh: MeshBVH;
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly hit: PickHit = { point: new Vector3(), normal: new Vector3(), distance: 0 };

  constructor(readonly collider: BufferGeometry) {
    // Collider zaten dünya uzayında; BVH'yi bir kez kur.
    this.bvh = new MeshBVH(collider, { targetLeafSize: 12 });
  }

  /**
   * Ekran koordinatından (canvas'a göre piksel) ilk isabeti döner.
   * Dönen nesne her çağrıda yeniden kullanılır (allocation yok); saklamak için kopyalayın.
   */
  pick(camera: Camera, x: number, y: number, width: number, height: number): PickHit | null {
    this.ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, camera);
    const res = this.bvh.raycastFirst(this.raycaster.ray, DoubleSide);
    if (!res) return null;
    this.hit.point.copy(res.point);
    if (res.face) this.hit.normal.copy(res.face.normal);
    else this.hit.normal.set(0, 1, 0);
    this.hit.distance = res.distance;
    return this.hit;
  }
}
