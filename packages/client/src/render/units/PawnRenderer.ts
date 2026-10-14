import {
  AnimState,
  SNAP_UNIT_INTS,
  unpackAnimState,
  unpackAnimTick,
  unpackTeam,
  unpackYaw,
} from '@bulwark/shared';
import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  type Texture,
  Vector3,
} from 'three/webgpu';
import type { SimHost } from '../../sim-host/SimHost';
import { merge, paint, place, verticalShade } from '../geometry/lowpoly';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';

/**
 * GEÇİCİ birim renderer'ı (Phase 1 / Adım 5): sim → snapshot → ara değer → InstancedMesh
 * hattını doğrulamak için basit "piyon" askerler. Adım 6'da segmentli prosedürel animasyonlu
 * (SPA) birim tipi başına InstancedMesh'ler bunun yerini alacak.
 * Model ileri yönü +X: sim açısı a (0 = +X, π/2 = +Z) → rotY = -a.
 */
const TEAM_TINT = [
  new Color(0.75, 0.88, 1.35),
  new Color(1.35, 0.62, 0.52),
  new Color(0.7, 1.3, 0.7),
  new Color(1.3, 1.15, 0.6),
];
const ANGLE_TO_RAD = (Math.PI * 2) / 65536;
const FX = 1 / 65536;

export class PawnRenderer {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3(1, 1, 1);
  private readonly up = new Vector3(0, 1, 0);
  private lastTeam = new Int8Array(0);

  constructor(
    capacity: number,
    palette: Texture,
    params: ToonParams,
    private readonly groundY: (x: number, z: number) => number,
  ) {
    const geo = verticalShade(
      merge([
        paint(place(new CylinderGeometry(0.32, 0.42, 1.1, 6), 0, 0.55, 0), 'gondorWhite'),
        paint(place(new IcosahedronGeometry(0.26, 0), 0, 1.32, 0), 'steel'),
        paint(place(new ConeGeometry(0.3, 0.35, 6), 0, 1.6, 0), 'steel'),
        paint(place(new BoxGeometry(0.12, 0.7, 0.55), 0.38, 0.75, 0.05), 'gondorWhite'),
        paint(place(new BoxGeometry(1.0, 0.06, 0.06), 0.5, 0.9, -0.32), 'iron'),
      ]),
      0.75,
      1.05,
    );
    this.mesh = new InstancedMesh(geo, createToonMaterial(palette, params), capacity);
    this.mesh.name = 'pawns';
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.lastTeam = new Int8Array(capacity).fill(-1);
    // instanceColor'ı oluştur.
    this.mesh.setColorAt(0, TEAM_TINT[0] as Color);
  }

  update(host: SimHost, now: number): void {
    const curr = host.frame;
    const prev = host.previous;
    const a = host.alpha(now);
    const u = curr.units;
    const pu = prev.units;
    let colorsDirty = false;
    for (let i = 0; i < curr.count; i++) {
      const o = i * SNAP_UNIT_INTS;
      const eid = u[o] as number;
      let x = (u[o + 1] as number) * FX;
      let z = (u[o + 2] as number) * FX;
      const packed = u[o + 3] as number;
      let yaw = unpackYaw(packed);
      const po = host.prevOffset(eid);
      if (po >= 0) {
        x = (pu[po + 1] as number) * FX + (x - (pu[po + 1] as number) * FX) * a;
        z = (pu[po + 2] as number) * FX + (z - (pu[po + 2] as number) * FX) * a;
        const py = unpackYaw(pu[po + 3] as number);
        yaw = py + (((yaw - py) << 16) >> 16) * a;
      }
      const anim = u[o + 4] as number;
      let y = this.groundY(x, z);
      if (unpackAnimState(anim) === AnimState.Walk) {
        const t = (unpackAnimTick(anim) + a) * 0.9 + eid * 0.37;
        y += Math.abs(Math.sin(t * Math.PI)) * 0.12;
      }
      this.q.setFromAxisAngle(this.up, -yaw * ANGLE_TO_RAD);
      this.m.compose(this.p.set(x, y, z), this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      const team = unpackTeam(packed);
      if (this.lastTeam[i] !== team) {
        this.lastTeam[i] = team;
        this.mesh.setColorAt(i, TEAM_TINT[team % TEAM_TINT.length] as Color);
        colorsDirty = true;
      }
    }
    this.mesh.count = curr.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (colorsDirty && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
