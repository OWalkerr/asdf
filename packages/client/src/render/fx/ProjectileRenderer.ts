import { SNAP_PROJ_INTS, unpackFireTick, unpackFlightTicks } from '@bulwark/shared';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BoxGeometry,
  ConeGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  Quaternion,
  Vector3,
} from 'three/webgpu';
import type { SimHost } from '../../sim-host/SimHost';

/**
 * Oklar (GDD §3.5, §13.5): sim yalnızca başlangıç/bitiş/uçuş süresini gönderir; render
 * parabolik yayı ve uçuş yönünü analitik hesaplar. Tek InstancedMesh, kare başına yeniden doldurulur.
 */
const FX = 1 / 65536;
const ARC = 0.16; // tepe yüksekliği / mesafe

export class ProjectileRenderer {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly p = new Vector3();
  private readonly dir = new Vector3();
  private readonly fwd = new Vector3(1, 0, 0);
  private readonly one = new Vector3(1, 1, 1);

  constructor(
    capacity: number,
    private readonly groundY: (x: number, z: number) => number,
  ) {
    const shaft = new BoxGeometry(0.9, 0.035, 0.035);
    const head = new ConeGeometry(0.05, 0.16, 4).rotateZ(-Math.PI / 2).translate(0.52, 0, 0);
    const fletch = new BoxGeometry(0.14, 0.08, 0.01).translate(-0.4, 0, 0);
    for (const g of [shaft, head, fletch]) g.deleteAttribute('uv');
    const geo = mergeGeometries([shaft, head, fletch], false);
    if (!geo) throw new Error('ok geometrisi birleştirilemedi');
    this.mesh = new InstancedMesh(geo, new MeshBasicNodeMaterial({ color: '#3a2a1c' }), capacity);
    this.mesh.name = 'projectiles';
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(host: SimHost, now: number): void {
    const frame = host.frame;
    const time = frame.tick + host.alpha(now);
    const pr = frame.projectiles;
    const cap = this.mesh.instanceMatrix.count;
    let n = 0;
    for (let i = 0; i < frame.projCount && n < cap; i++) {
      const o = i * SNAP_PROJ_INTS;
      const packed = pr[o + 5] as number;
      const flight = unpackFlightTicks(packed);
      const t = (time - unpackFireTick(packed)) / flight;
      if (t < 0 || t > 1) continue;
      const fx = (pr[o + 1] as number) * FX;
      const fz = (pr[o + 2] as number) * FX;
      const tx = (pr[o + 3] as number) * FX;
      const tz = (pr[o + 4] as number) * FX;
      const y0 = this.groundY(fx, fz) + 1.5;
      const y1 = this.groundY(tx, tz) + 0.9;
      const dist = Math.hypot(tx - fx, tz - fz);
      const h = dist * ARC;
      this.p.set(fx + (tx - fx) * t, y0 + (y1 - y0) * t + 4 * h * t * (1 - t), fz + (tz - fz) * t);
      // Yön = yayın türevi.
      this.dir.set(tx - fx, y1 - y0 + 4 * h * (1 - 2 * t), tz - fz).normalize();
      this.q.setFromUnitVectors(this.fwd, this.dir);
      this.m.compose(this.p, this.q, this.one);
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    if (n > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
