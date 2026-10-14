import {
  AnimState,
  FLAG_HIT,
  SNAP_UNIT_INTS,
  UNIT_DEFS,
  unpackAnimState,
  unpackAnimTick,
  unpackBattalion,
  unpackFlags,
  unpackHp8,
  unpackRank,
  unpackTeam,
  unpackUnitType,
  unpackYaw,
} from '@bulwark/shared';
import { DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, type Texture } from 'three/webgpu';
import { SIM_TICK_MS } from '../../sim-host/protocol';
import type { SimHost } from '../../sim-host/SimHost';
import type { ToonParams } from '../materials/ToonMaterial';
import { UNIT_MODELS } from './models';
import { createUnitMaterial } from './UnitMaterial';

/**
 * Birim render'ı (GDD §13.5): birim tipi başına TEK InstancedMesh. Her karede snapshot
 * (veya galeri gibi başka bir kaynak) tipe göre kovalara ayrılır ve instance başına
 * iki vec4 (iPose, iAnim) yazılır; tüm poz/animasyon GPU'da (UnitMaterial) hesaplanır.
 */
const ANGLE_TO_RAD = (Math.PI * 2) / 65536;
const FX = 1 / 65536;
const TICK_S = SIM_TICK_MS / 1000;

interface Bucket {
  mesh: InstancedMesh;
  pose: Float32Array;
  anim: Float32Array;
  poseAttr: InstancedBufferAttribute;
  animAttr: InstancedBufferAttribute;
  /** Instance başına tabur eid'i (seçim / halka için CPU tarafı kopya). */
  battalion: Int32Array;
  team: Uint8Array;
  /** Can (0–255, snapshot hp8). */
  hp: Uint8Array;
  /** Tabur rütbesi (1–5; 0 = bilinmiyor). */
  rank: Uint8Array;
  count: number;
}

export class UnitRenderer {
  private readonly buckets: Bucket[] = [];
  /** Toplam çizilen birim (son kare). */
  drawn = 0;
  /** Bu taburun askerleri parlar (ör. Elendil'in Kılıcı etkinken kahraman). */
  glowBattalion = 0;

  constructor(
    readonly capacityPerType: number,
    palette: Texture,
    params: ToonParams,
    private readonly groundY: (x: number, z: number) => number,
  ) {
    for (const def of UNIT_DEFS) {
      const build = UNIT_MODELS[def.id];
      if (!build) throw new Error(`Model yok: ${def.key}`);
      const geo = build();
      const pose = new Float32Array(capacityPerType * 4);
      const anim = new Float32Array(capacityPerType * 4);
      const poseAttr = new InstancedBufferAttribute(pose, 4).setUsage(DynamicDrawUsage);
      const animAttr = new InstancedBufferAttribute(anim, 4).setUsage(DynamicDrawUsage);
      geo.setAttribute('iPose', poseAttr);
      geo.setAttribute('iAnim', animAttr);
      const style = def.attackStyle === 'thrust' ? 1 : def.attackStyle === 'bow' ? 2 : 0;
      const mat = createUnitMaterial(palette, params, { attackStyle: style });
      const mesh = new InstancedMesh(geo, mat, capacityPerType);
      mesh.name = `units:${def.key}`;
      // Konum shader'da hesaplandığı için CPU frustum testi anlamsız; GPU culling Phase 2'de.
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      this.buckets[def.id] = {
        mesh,
        pose,
        anim,
        poseAttr,
        animAttr,
        battalion: new Int32Array(capacityPerType),
        team: new Uint8Array(capacityPerType),
        hp: new Uint8Array(capacityPerType),
        rank: new Uint8Array(capacityPerType),
        count: 0,
      };
    }
  }

  /** Son karede çizilen tüm instance'ları gezer (seçim, halka, picking için). */
  forEach(
    cb: (
      x: number,
      y: number,
      z: number,
      battalion: number,
      team: number,
      hp: number,
      type: number,
      rank: number,
    ) => void,
  ): void {
    for (let type = 0; type < this.buckets.length; type++) {
      const b = this.buckets[type] as Bucket;
      for (let i = 0; i < b.count; i++) {
        const o = i * 4;
        cb(
          b.pose[o] as number,
          b.pose[o + 1] as number,
          b.pose[o + 2] as number,
          b.battalion[i] as number,
          b.team[i] as number,
          (b.hp[i] as number) / 255,
          type,
          b.rank[i] as number,
        );
      }
    }
  }

  get meshes(): InstancedMesh[] {
    return this.buckets.map((b) => b.mesh);
  }

  begin(): void {
    for (const b of this.buckets) b.count = 0;
  }

  /** Bir birim ekle. yaw: radyan (0 = +X). t: durumdaki süre (s). battalion: tabur eid'i (0 = yok). */
  push(
    type: number,
    x: number,
    y: number,
    z: number,
    yaw: number,
    state: number,
    t: number,
    flash: number,
    team: number,
    battalion = 0,
    hp8 = 255,
    rank = 0,
  ): void {
    const b = this.buckets[type];
    if (!b || b.count >= this.capacityPerType) return;
    b.battalion[b.count] = battalion;
    b.team[b.count] = team;
    b.hp[b.count] = hp8;
    b.rank[b.count] = rank;
    const o = b.count * 4;
    b.pose[o] = x;
    b.pose[o + 1] = y;
    b.pose[o + 2] = z;
    b.pose[o + 3] = yaw;
    b.anim[o] = state;
    b.anim[o + 1] = t;
    b.anim[o + 2] = flash;
    b.anim[o + 3] = team;
    b.count++;
  }

  end(): void {
    let total = 0;
    for (const b of this.buckets) {
      b.mesh.count = b.count;
      total += b.count;
      if (b.count === 0) continue;
      // Yalnızca kullanılan kısmı yükle.
      b.poseAttr.clearUpdateRanges();
      b.poseAttr.addUpdateRange(0, b.count * 4);
      b.poseAttr.needsUpdate = true;
      b.animAttr.clearUpdateRanges();
      b.animAttr.addUpdateRange(0, b.count * 4);
      b.animAttr.needsUpdate = true;
    }
    this.drawn = total;
  }

  /** Sim snapshot'ından (prev → curr ara değerli) doldur. */
  updateFromSim(host: SimHost, now: number): void {
    const curr = host.frame;
    const prev = host.previous;
    const a = host.alpha(now);
    const u = curr.units;
    const pu = prev.units;
    this.begin();
    for (let i = 0; i < curr.count; i++) {
      const o = i * SNAP_UNIT_INTS;
      const eid = u[o] as number;
      let x = (u[o + 1] as number) * FX;
      let z = (u[o + 2] as number) * FX;
      const packed = u[o + 3] as number;
      let yaw = unpackYaw(packed);
      const po = host.prevOffset(eid);
      if (po >= 0) {
        const px = (pu[po + 1] as number) * FX;
        const pz = (pu[po + 2] as number) * FX;
        x = px + (x - px) * a;
        z = pz + (z - pz) * a;
        const py = unpackYaw(pu[po + 3] as number);
        yaw = py + (((yaw - py) << 16) >> 16) * a;
      }
      const animPacked = u[o + 4] as number;
      const state = unpackAnimState(animPacked);
      let t = (unpackAnimTick(animPacked) + a) * TICK_S;
      // Döngüsel animasyonlarda birimler arası faz farkı (adımlar senkron görünmesin).
      if (state === AnimState.Walk || state === AnimState.Idle) t += ((eid * 0.618034) % 1) * 2;
      this.push(
        unpackUnitType(packed),
        x,
        this.groundY(x, z),
        z,
        yaw * ANGLE_TO_RAD,
        state,
        t,
        unpackFlags(animPacked) & FLAG_HIT
          ? 1
          : this.glowBattalion !== 0 && unpackBattalion(u[o + 5] as number) === this.glowBattalion
            ? 0.45
            : 0,
        unpackTeam(packed),
        unpackBattalion(u[o + 5] as number),
        unpackHp8(animPacked),
        unpackRank(u[o + 5] as number),
      );
    }
    this.end();
  }
}
