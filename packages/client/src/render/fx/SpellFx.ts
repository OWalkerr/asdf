import {
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
} from 'three/webgpu';

/**
 * Büyü görselleri (GDD §3.5, §9): hedefleme halkası (alan büyüsü seçilirken imleci izler) ve
 * genişleyip sönen ışık halkaları (Şifa, Athelas, Toplanma). Tek InstancedMesh, instance rengi.
 */
interface Pulse {
  x: number;
  y: number;
  z: number;
  radius: number;
  age: number;
  life: number;
  color: Color;
}

export class SpellFx {
  readonly meshes: InstancedMesh[];
  private readonly pulses: InstancedMesh;
  private readonly target: InstancedMesh;
  private readonly list: Pulse[] = [];
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly c = new Color();

  constructor() {
    const mat = () =>
      new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, toneMapped: false, opacity: 0.9 });
    this.pulses = new InstancedMesh(new RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2), mat(), 64);
    this.pulses.setColorAt(0, new Color(1, 1, 1));
    this.target = new InstancedMesh(new RingGeometry(0.94, 1, 64).rotateX(-Math.PI / 2), mat(), 1);
    this.target.setColorAt(0, new Color('#f5d77a'));
    for (const mesh of [this.pulses, this.target]) {
      mesh.frustumCulled = false;
      mesh.renderOrder = 6;
      mesh.count = 0;
    }
    this.pulses.name = 'spell-pulses';
    this.target.name = 'spell-target';
    this.meshes = [this.pulses, this.target];
  }

  /** Hedefleme halkasını göster/gizle. */
  showTarget(x: number, y: number, z: number, radius: number, ok = true): void {
    this.m.compose(this.p.set(x, y + 0.3, z), this.q.identity(), this.s.set(radius, 1, radius));
    this.target.setMatrixAt(0, this.m);
    this.target.setColorAt(0, this.c.set(ok ? '#f5d77a' : '#e36b5a'));
    if (this.target.instanceColor) this.target.instanceColor.needsUpdate = true;
    this.target.instanceMatrix.needsUpdate = true;
    this.target.count = 1;
  }

  hideTarget(): void {
    this.target.count = 0;
  }

  /** Genişleyen halka: üç iç içe dalga. */
  pulse(x: number, y: number, z: number, radius: number, color: string, life = 1.2): void {
    for (let k = 0; k < 3; k++) {
      if (this.list.length >= 60) this.list.shift();
      this.list.push({ x, y, z, radius, age: -k * 0.18, life, color: new Color(color).multiplyScalar(2.2) });
    }
  }

  update(dt: number): void {
    let n = 0;
    for (const p of this.list) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const t = Math.max(0, p.age / p.life);
      const r = p.radius * (0.15 + 0.85 * Math.sqrt(t));
      this.m.compose(this.p.set(p.x, p.y + 0.4, p.z), this.q.identity(), this.s.set(r, 1, r));
      this.pulses.setMatrixAt(n, this.m);
      this.pulses.setColorAt(n, this.c.copy(p.color).multiplyScalar(p.age < 0 ? 0 : 1 - t));
      this.list[n++] = p;
    }
    this.list.length = n;
    this.pulses.count = n;
    if (n > 0) {
      this.pulses.instanceMatrix.needsUpdate = true;
      if (this.pulses.instanceColor) this.pulses.instanceColor.needsUpdate = true;
    }
  }
}
