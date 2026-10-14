import { FortressUpgrade, type MapDef, type MatchInfo } from '@bulwark/shared';
import { type BufferGeometry, InstancedMesh, Matrix4, Quaternion, type Texture, Vector3 } from 'three/webgpu';
import { createFlameMaterial } from '../map/emissive';
import { bannerPole, catapultModel, healingFlag, keepSkirt, treasuryHouse } from '../map/prefabs';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';

/**
 * Kale yükseltmelerinin görünümü (GDD §4.2): her yükseltme kalenin çevresinde bir parça ekler —
 * taş etek, mazgal sancakları, mancınık platformu, parlayan şifa sancağı, altın kubbeli hazine.
 * Kale konumu/yönüne göre yerleşir; yükseltme bitleri değişince güncellenir.
 */
const DEG = Math.PI / 180;

interface Piece {
  bit: number;
  mesh: InstancedMesh;
  /** Kale yerel uzayında konum (x sağ, z ön) ve ölçek. */
  local: [number, number, number];
  scale: number;
}

export class FortressRenderer {
  readonly meshes: InstancedMesh[] = [];
  private readonly pieces: Piece[] = [];
  private last = -1;

  constructor(
    private readonly def: MapDef,
    private readonly heightAt: (x: number, z: number) => number,
    palette: Texture,
    params: ToonParams,
  ) {
    const toon = createToonMaterial(palette, params);
    const glow = createFlameMaterial(palette).material;
    const td = def.mode === 'TD';
    const k = td ? 0.7 : 1;
    const add = (
      bit: number,
      geo: BufferGeometry,
      local: [number, number, number],
      scale = 1,
      emissive = false,
    ) => {
      const mesh = new InstancedMesh(geo, emissive ? glow : toon, 1);
      mesh.castShadow = !emissive;
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.name = `fortress-up-${bit}`;
      this.meshes.push(mesh);
      this.pieces.push({ bit, mesh, local: [local[0] * k, local[1], local[2] * k], scale: scale * k });
    };
    add(FortressUpgrade.StoneWalls, keepSkirt(), [0, 0, 0]);
    add(FortressUpgrade.ArrowSlits, bannerPole(), [-10.5, 0, 10.5], 0.8);
    add(FortressUpgrade.ArrowSlits, bannerPole(), [10.5, 0, 10.5], 0.8);
    add(FortressUpgrade.Catapult, catapultModel(), [13, 0, -4], 1.2);
    add(FortressUpgrade.Healing, bannerPole(), [-6, 0, 14]);
    add(FortressUpgrade.Healing, healingFlag(), [-6, 0, 14], 1, true);
    add(FortressUpgrade.Treasury, treasuryHouse(), [-13, 0, -4]);
  }

  update(match: MatchInfo): void {
    if (match.fortUp === this.last) return;
    this.last = match.fortUp;
    const c = this.def.citadel;
    const f = (c.facing ?? 90) * DEG;
    // Kale yerel: ön (z) = facing yönü, sağ (x) = ön × yukarı.
    const fx = Math.cos(f);
    const fz = Math.sin(f);
    const m = new Matrix4();
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2 - f);
    for (const p of this.pieces) {
      if (!(match.fortUp & (1 << p.bit))) {
        p.mesh.count = 0;
        continue;
      }
      const [lx, , lz] = p.local;
      const x = c.pos[0] + fx * lz - fz * lx;
      const z = c.pos[1] + fz * lz + fx * lx;
      const y = this.heightAt(x, z) + (c.elevation ?? 0) - 0.3;
      m.compose(new Vector3(x, y, z), q, new Vector3(p.scale, p.scale, p.scale));
      p.mesh.setMatrixAt(0, m);
      p.mesh.count = 1;
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
