import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BatchedMesh, BufferAttribute, BufferGeometry, type Material, type Matrix4 } from 'three/webgpu';

/**
 * Statik sahne geometrisini tek bir BatchedMesh'te toplar (GDD §13.5, Kural 1).
 * Aynı geometri birden çok kez eklenirse GPU'ya bir kez yüklenir, her kopya bir instance olur.
 *
 * `pickable` işaretli parçalar ayrıca bir çarpışma geometrisine (collider) birleştirilir;
 * mouse picking bu geometri üzerinde BVH ile yapılır (ağaç/kaya gibi dekor hariç).
 */
export class StaticBatch {
  private geometries: BufferGeometry[] = [];
  private instances: { geo: number; matrix: Matrix4; pickable: boolean }[] = [];
  private ids = new Map<BufferGeometry, number>();

  add(geo: BufferGeometry, matrix: Matrix4, pickable = false): void {
    let id = this.ids.get(geo);
    if (id === undefined) {
      id = this.geometries.push(geo) - 1;
      this.ids.set(geo, id);
    }
    this.instances.push({ geo: id, matrix: matrix.clone(), pickable });
  }

  get instanceCount(): number {
    return this.instances.length;
  }

  /** Pickable instance'ları dünya uzayında tek geometride birleştirir (yalnızca position). */
  buildCollider(): BufferGeometry {
    const parts: BufferGeometry[] = [];
    for (const inst of this.instances) {
      if (!inst.pickable) continue;
      const src = this.geometries[inst.geo] as BufferGeometry;
      const g = new BufferGeometry();
      g.setAttribute('position', (src.getAttribute('position') as BufferAttribute).clone());
      g.applyMatrix4(inst.matrix);
      parts.push(g);
    }
    if (parts.length === 0) {
      const empty = new BufferGeometry();
      empty.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
      return empty;
    }
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!merged) throw new Error('collider birleştirilemedi');
    return merged;
  }

  /** BatchedMesh'i oluşturur. Kaynak geometriler serbest bırakılır; collider önce alınmalı. */
  build(material: Material, name: string): BatchedMesh {
    let vertexCount = 0;
    for (const g of this.geometries) vertexCount += g.getAttribute('position').count;
    const mesh = new BatchedMesh(this.instances.length, vertexCount, 0, material);
    mesh.name = name;
    const geoIds = this.geometries.map((g) => mesh.addGeometry(g));
    for (const inst of this.instances) {
      const iid = mesh.addInstance(geoIds[inst.geo] as number);
      mesh.setMatrixAt(iid, inst.matrix);
    }
    for (const g of this.geometries) g.dispose();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}
