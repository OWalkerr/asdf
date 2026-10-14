import { BatchedMesh, type BufferGeometry, type Material, type Matrix4 } from 'three/webgpu';

/**
 * Statik sahne geometrisini tek bir BatchedMesh'te toplar (GDD §13.5, Kural 1).
 * Aynı geometri birden çok kez eklenirse GPU'ya bir kez yüklenir, her kopya bir instance olur.
 */
export class StaticBatch {
  private geometries: BufferGeometry[] = [];
  private instances: { geo: number; matrix: Matrix4 }[] = [];
  private ids = new Map<BufferGeometry, number>();

  add(geo: BufferGeometry, matrix: Matrix4): void {
    let id = this.ids.get(geo);
    if (id === undefined) {
      id = this.geometries.push(geo) - 1;
      this.ids.set(geo, id);
    }
    this.instances.push({ geo: id, matrix: matrix.clone() });
  }

  get instanceCount(): number {
    return this.instances.length;
  }

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
