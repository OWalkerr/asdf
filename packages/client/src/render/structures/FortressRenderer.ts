import { FortressUpgrade, type MapDef, type MatchInfo } from '@bulwark/shared';
import { type BufferGeometry, InstancedMesh, Matrix4, Quaternion, type Texture, Vector3 } from 'three/webgpu';
import { createFlameMaterial } from '../map/emissive';
import { catapultModel, treasuryHouse } from '../map/prefabs';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';
import {
  archerHoardings,
  bastionRing,
  beaconBowl,
  beaconFlame,
  goldCaps,
  healingBanners,
  keepBanners,
} from './fortressParts';

/**
 * Kalenin görsel evrimi (BFME2'deki gibi kale yükseldikçe gövdesi değişir):
 * - Her yükseltme kaleye kendi parçasını ekler: Taş Takviye → burçlu perde sur, Ok Mazgalları →
 *   köşe kulelerinde ahşap çıkmalar ve flamalar, Mancınık → yan teraslarda iki mancınık, Şifa →
 *   parlayan sancaklar, Hazine → altın başlıklar/kuşak ve hazine binası.
 * - Toplam yükseltme sayısı kademeyi belirler: 3+ → Gondor sancakları ve altın taç,
 *   5 → ön terasta işaret ateşi.
 * Yeni parça belirdiğinde 1.2 sn'de zeminden "yükselir" (inşa animasyonu).
 */
const DEG = Math.PI / 180;
const RISE_MS = 1200;

interface Piece {
  /** Görünürlük koşulu (yükseltme bitleri). */
  show: (bits: number) => boolean;
  mesh: InstancedMesh;
  /** Kale yerel uzayında konum (x sağ, y yukarı, z ön); ölçek. */
  local: [number, number, number];
  scale: number;
  /** Kale gövdesine bağlı (zemin yüksekliği kalenin merkezinden). */
  onKeep: boolean;
  shown: boolean;
  since: number;
  /** Son çizilen ölçek tam (animasyon bitti). */
  done: boolean;
}

const bit = (b: number) => (bits: number) => (bits & (1 << b)) !== 0;
const count = (bits: number) => {
  let n = 0;
  for (let i = 0; i < 8; i++) if (bits & (1 << i)) n++;
  return n;
};

export class FortressRenderer {
  readonly meshes: InstancedMesh[] = [];
  private readonly pieces: Piece[] = [];
  private bits = 0;
  private readonly m = new Matrix4();
  private readonly q: Quaternion;
  private readonly v = new Vector3();
  private readonly s = new Vector3();

  constructor(
    private readonly def: MapDef,
    private readonly heightAt: (x: number, z: number) => number,
    palette: Texture,
    params: ToonParams,
  ) {
    const toon = createToonMaterial(palette, params);
    const glow = createFlameMaterial(palette).material;
    const k = def.mode === 'TD' ? 0.7 : 1;
    this.q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      Math.PI / 2 - (def.citadel.facing ?? 90) * DEG,
    );
    const add = (
      show: (bits: number) => boolean,
      geo: BufferGeometry,
      local: [number, number, number] = [0, 0, 0],
      scale = 1,
      opts: { emissive?: boolean; onKeep?: boolean } = {},
    ) => {
      const mesh = new InstancedMesh(geo, opts.emissive ? glow : toon, 1);
      mesh.castShadow = !opts.emissive;
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.name = 'fortress-up';
      this.meshes.push(mesh);
      this.pieces.push({
        show,
        mesh,
        local: [local[0] * k, local[1] * k, local[2] * k],
        scale: scale * k,
        onKeep: opts.onKeep ?? true,
        shown: false,
        since: 0,
        done: false,
      });
    };
    add(bit(FortressUpgrade.StoneWalls), bastionRing());
    add(bit(FortressUpgrade.ArrowSlits), archerHoardings());
    add(bit(FortressUpgrade.Catapult), catapultModel(), [5.9, 11.6, 0], 0.7);
    add(bit(FortressUpgrade.Catapult), catapultModel(), [-5.9, 11.6, 0], 0.7);
    add(bit(FortressUpgrade.Healing), healingBanners(), [0, 0, 0], 1, { emissive: true });
    add(bit(FortressUpgrade.Treasury), goldCaps());
    add(bit(FortressUpgrade.Treasury), treasuryHouse(), [-18, 0, -6], 1, { onKeep: false });
    add((b) => count(b) >= 3, keepBanners());
    add((b) => count(b) >= 5, beaconBowl());
    add((b) => count(b) >= 5, beaconFlame(), [0, 0, 0], 1, { emissive: true });
  }

  update(match: MatchInfo): void {
    const now = performance.now();
    const bits = match.fortUp;
    const changed = bits !== this.bits;
    this.bits = bits;
    const c = this.def.citadel;
    const f = (c.facing ?? 90) * DEG;
    // Kale yerel: ön (z) = facing yönü, sağ (x) = ön × yukarı.
    const fx = Math.cos(f);
    const fz = Math.sin(f);
    const baseY = this.heightAt(c.pos[0], c.pos[1]) + (c.elevation ?? 0) - 0.4;
    for (const p of this.pieces) {
      const on = p.show(bits);
      if (changed && on && !p.shown) {
        p.since = now;
        p.done = false;
      }
      p.shown = on;
      if (!on) {
        p.mesh.count = 0;
        continue;
      }
      if (p.done && !changed) continue;
      const t = Math.min(1, (now - p.since) / RISE_MS);
      p.done = t >= 1;
      const [lx, ly, lz] = p.local;
      const x = c.pos[0] + fx * lz - fz * lx;
      const z = c.pos[1] + fz * lz + fx * lx;
      const y = (p.onKeep ? baseY : this.heightAt(x, z) - 0.3) + ly;
      // Yükselme: alttan büyür, sonunda hafif taşma (ease-out-back).
      const e = t >= 1 ? 1 : 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
      this.m.compose(this.v.set(x, y, z), this.q, this.s.set(p.scale, p.scale * Math.max(0.02, e), p.scale));
      p.mesh.setMatrixAt(0, this.m);
      p.mesh.count = 1;
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
