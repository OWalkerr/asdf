import {
  AnimState,
  FLAG_HIT,
  SNAP_UNIT_INTS,
  type SnapshotFrame,
  unpackAnimState,
  unpackFlags,
} from '@bulwark/shared';
import { MAX_ENTITIES } from '@bulwark/sim';
import {
  DodecahedronGeometry,
  InstancedMesh,
  Matrix4,
  OctahedronGeometry,
  Quaternion,
  type Texture,
  Vector3,
} from 'three/webgpu';
import { paint } from '../geometry/lowpoly';
import { createFlameMaterial } from '../map/emissive';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';

/**
 * Vuruş ve ölüm efektleri (GDD §3.5): snapshot'taki "vuruldu" bayrağının yükselen kenarında
 * kıvılcım (emissive → bloom), ölüm anında toz bulutu. CPU parçacık havuzu, iki InstancedMesh.
 * Tamamen görsel: sim'e geri bildirim yok.
 */
const FX = 1 / 65536;

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  spin: number;
}

class Pool {
  readonly mesh: InstancedMesh;
  private readonly items: Particle[] = [];
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly axis = new Vector3(0.3, 1, 0.2).normalize();

  constructor(
    mesh: InstancedMesh,
    private readonly cap: number,
    private readonly gravity: number,
    private readonly drag: number,
    private readonly grow: number,
  ) {
    this.mesh = mesh;
    mesh.frustumCulled = false;
    mesh.count = 0;
  }

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
  ): void {
    if (this.items.length >= this.cap) this.items.shift();
    this.items.push({ x, y, z, vx, vy, vz, age: 0, life, size, spin: Math.random() * 6 });
  }

  update(dt: number): void {
    const k = Math.exp(-this.drag * dt);
    let n = 0;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i] as Particle;
      it.age += dt;
      if (it.age >= it.life) continue;
      it.vx *= k;
      it.vz *= k;
      it.vy = it.vy * k - this.gravity * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.z += it.vz * dt;
      const t = it.age / it.life;
      const sc = it.size * (this.grow > 0 ? (0.5 + t * this.grow) * (1 - t * t * t) : 1 - t * t);
      this.q.setFromAxisAngle(this.axis, it.spin + it.age * 4);
      this.m.compose(this.p.set(it.x, it.y, it.z), this.q, this.s.set(sc, sc, sc));
      this.mesh.setMatrixAt(n, this.m);
      this.items[n++] = it;
    }
    this.items.length = n;
    this.mesh.count = n;
    if (n > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class ImpactFx {
  readonly meshes: InstancedMesh[];
  private readonly sparks: Pool;
  private readonly dust: Pool;
  private readonly prevFlags = new Uint8Array(MAX_ENTITIES);
  private lastTick = -1;

  constructor(
    palette: Texture,
    params: ToonParams,
    private readonly groundY: (x: number, z: number) => number,
  ) {
    const flame = createFlameMaterial(palette);
    flame.intensity.value = 6;
    const sparkMesh = new InstancedMesh(
      paint(new OctahedronGeometry(0.09, 0), 'ember'),
      flame.material,
      1024,
    );
    sparkMesh.name = 'fx-sparks';
    const dustMesh = new InstancedMesh(
      paint(new DodecahedronGeometry(0.5, 0), 'rockLight', 0.9),
      createToonMaterial(palette, params),
      512,
    );
    dustMesh.name = 'fx-dust';
    dustMesh.castShadow = false;
    this.sparks = new Pool(sparkMesh, 1024, 14, 2.5, 0);
    this.dust = new Pool(dustMesh, 384, -0.3, 3.5, 1.0);
    this.meshes = [sparkMesh, dustMesh];
  }

  update(frame: SnapshotFrame, dt: number): void {
    if (frame.tick !== this.lastTick) {
      this.lastTick = frame.tick;
      const u = frame.units;
      for (let i = 0; i < frame.count; i++) {
        const o = i * SNAP_UNIT_INTS;
        const eid = u[o] as number;
        const anim = u[o + 4] as number;
        const hit = (unpackFlags(anim) & FLAG_HIT) !== 0 ? 1 : 0;
        const dead = unpackAnimState(anim) === AnimState.Die ? 2 : 0;
        const prev = this.prevFlags[eid] as number;
        const now = hit | dead;
        if (now === prev) continue;
        this.prevFlags[eid] = now;
        const x = (u[o + 1] as number) * FX;
        const z = (u[o + 2] as number) * FX;
        const y = this.groundY(x, z);
        if (hit && !(prev & 1)) {
          for (let k = 0; k < 5; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 2 + Math.random() * 4;
            this.sparks.spawn(
              x,
              y + 1.3,
              z,
              Math.cos(a) * sp,
              2 + Math.random() * 4,
              Math.sin(a) * sp,
              0.35 + Math.random() * 0.2,
              1,
            );
          }
        }
        if (dead && !(prev & 2)) {
          for (let k = 0; k < 3; k++) {
            const a = Math.random() * Math.PI * 2;
            this.dust.spawn(
              x + Math.cos(a) * 0.4,
              y + 0.3,
              z + Math.sin(a) * 0.4,
              Math.cos(a) * 1.4,
              0.6 + Math.random() * 0.6,
              Math.sin(a) * 1.4,
              0.5 + Math.random() * 0.3,
              0.3 + Math.random() * 0.25,
            );
          }
        }
      }
    }
    this.sparks.update(dt);
    this.dust.update(dt);
  }
}
