import type { MapDef, MatchInfo } from '@bulwark/shared';
import { InstancedMesh, Matrix4, Quaternion, type Texture, Vector3 } from 'three/webgpu';
import { gateDoors, gateRubble } from '../map/prefabs';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';

/**
 * Kapı kanatları (GDD §4.2): her kapı için iki ahşap kanat; kapı kırılınca kanatlar kaybolur,
 * yerine devrilmiş kanat/taş enkazı çıkar. Çerçeve statik batch'tedir. İki InstancedMesh.
 */
const DEG = Math.PI / 180;

export class GateRenderer {
  readonly meshes: InstancedMesh[];
  private readonly doors: InstancedMesh;
  private readonly rubble: InstancedMesh;
  private readonly mats: Matrix4[] = [];
  private lastMask = -1;

  constructor(
    private readonly def: MapDef,
    heightAt: (x: number, z: number) => number,
    palette: Texture,
    params: ToonParams,
    /** Kapı tabanı yüksekliği (Helm's Deep: plato üstü kapı). */
    baseY?: (gateIndex: number) => number | undefined,
  ) {
    const mat = createToonMaterial(palette, params);
    const n = Math.max(1, def.gates.length);
    this.doors = new InstancedMesh(gateDoors(), mat, n);
    let seed = def.seed;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    this.rubble = new InstancedMesh(gateRubble(rand), mat, n);
    for (const mesh of [this.doors, this.rubble]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
    }
    this.doors.name = 'gate-doors';
    this.rubble.name = 'gate-rubble';
    const q = new Quaternion();
    const up = new Vector3(0, 1, 0);
    def.gates.forEach((g, i) => {
      const s = Math.max(0.8, (g.width + 4) / 9);
      const y = baseY?.(i) ?? heightAt(g.pos[0], g.pos[1]) - 0.3;
      this.mats.push(
        new Matrix4().compose(
          new Vector3(g.pos[0], y, g.pos[1]),
          q.setFromAxisAngle(up, Math.PI / 2 - g.facing * DEG).clone(),
          new Vector3(s, s, s),
        ),
      );
    });
    this.meshes = [this.doors, this.rubble];
  }

  update(match: MatchInfo): void {
    let mask = 0;
    match.gateHp.forEach((hp, i) => {
      if (hp <= 0) mask |= 1 << i;
    });
    if (mask === this.lastMask && match.gateMax.length > 0) return;
    this.lastMask = mask;
    let d = 0;
    let r = 0;
    this.def.gates.forEach((_g, i) => {
      const m = this.mats[i] as Matrix4;
      if (mask & (1 << i)) this.rubble.setMatrixAt(r++, m);
      else this.doors.setMatrixAt(d++, m);
    });
    this.doors.count = d;
    this.rubble.count = r;
    this.doors.instanceMatrix.needsUpdate = true;
    this.rubble.instanceMatrix.needsUpdate = true;
  }
}
