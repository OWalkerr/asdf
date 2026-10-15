import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  type Texture,
  Vector3,
} from 'three/webgpu';
import { merge, paint, place } from '../geometry/lowpoly';
import { TEAM_COLORS } from '../hud/BattalionHud';
import { createToonMaterial, type ToonParams } from '../materials/ToonMaterial';
import type { UnitRenderer } from './UnitRenderer';

/**
 * Sancaktar (BFME2 tabur yükseltmesi): sancağı alınmış taburun ilk askeri, sırtında uzun bir
 * savaş sancağı taşır. Direk + çapraz kol + altın tepelik + arma tek mesh; kumaş ayrı mesh
 * (takım rengi instance rengiyle). Kumaş yürüyüş yönünün tersine dalgalanır.
 */
const MAX = 256;

export class BannerCarriers {
  readonly meshes: InstancedMesh[];
  private readonly pole: InstancedMesh;
  private readonly cloth: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3(1, 1, 1);
  private readonly up = new Vector3(0, 1, 0);

  constructor(palette: Texture, params: ToonParams) {
    const mat = createToonMaterial(palette, params);
    // Model yerel: +X ileri. Direk askerin sırtında (geri ve sol omuz).
    const px = -0.3;
    const pz = 0;
    // Direk askerin sırtında; çapraz kol yürüyüş yönüne dik (Z), kumaş ondan sarkar (YZ düzlemi:
    // birlik ilerlerken sancak önden/arkadan tam görünür).
    const poleGeo = merge([
      paint(place(new CylinderGeometry(0.05, 0.06, 4.8, 5), px, 2.4, pz), 'wood'),
      paint(place(new BoxGeometry(0.09, 0.09, 1.8), px, 4.25, pz), 'woodDark'),
      paint(place(new ConeGeometry(0.14, 0.46, 5), px, 5.03, pz), 'gold'),
      paint(place(new CylinderGeometry(0.12, 0.12, 0.09, 6), px, 4.78, pz), 'gold'),
      paint(place(new BoxGeometry(0.1, 0.16, 0.16), px, 4.25, pz + 0.92), 'gold'),
      paint(place(new BoxGeometry(0.1, 0.16, 0.16), px, 4.25, pz - 0.92), 'gold'),
      // Arma: kumaşın iki yüzünde altın ağaç (gövde, dallar, taç yıldızı).
      ...[0.04, -0.04].flatMap((o) => [
        paint(place(new BoxGeometry(0.03, 0.9, 0.14), px + o, 3.3, pz), 'gold'),
        paint(place(new BoxGeometry(0.03, 0.12, 0.7), px + o, 3.55, pz), 'gold'),
        paint(place(new BoxGeometry(0.03, 0.1, 0.46), px + o, 3.3, pz), 'gold'),
        paint(place(new BoxGeometry(0.03, 0.22, 0.22), px + o, 3.9, pz), 'gold'),
      ]),
      // Alt kenar saçağı.
      paint(place(new BoxGeometry(0.06, 0.1, 1.66), px, 2.35, pz), 'gold'),
    ]);
    // Kumaş: kollardan sarkan uzun dikdörtgen + kırlangıç kuyruğu uçlar.
    const clothGeo = merge([
      paint(place(new BoxGeometry(0.05, 1.9, 1.6), px, 3.25, pz), 'gondorWhite'),
      paint(place(new BoxGeometry(0.05, 0.55, 0.62), px, 2.05, pz + 0.48), 'gondorWhite'),
      paint(place(new BoxGeometry(0.05, 0.55, 0.62), px, 2.05, pz - 0.48), 'gondorWhite'),
    ]);
    this.pole = new InstancedMesh(poleGeo, mat, MAX);
    this.cloth = new InstancedMesh(clothGeo, mat, MAX);
    this.cloth.setColorAt(0, new Color(1, 1, 1));
    for (const mesh of [this.pole, this.cloth]) {
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.count = 0;
      mesh.name = 'banner-carriers';
    }
    this.meshes = [this.pole, this.cloth];
  }

  update(units: UnitRenderer, now: number): void {
    let n = 0;
    for (const [b, info] of units.battalionInfo) {
      if (info.banner !== 1 || n >= MAX) continue;
      // Dalgalanma: yürürken hafif yalpalama.
      const sway = Math.sin(now * 0.004 + b * 1.7) * 0.06;
      this.q.setFromAxisAngle(this.up, -info.yaw + sway);
      this.m.compose(this.p.set(info.x, info.y, info.z), this.q, this.s);
      this.pole.setMatrixAt(n, this.m);
      this.cloth.setMatrixAt(n, this.m);
      this.cloth.setColorAt(n, TEAM_COLORS[info.team] ?? (TEAM_COLORS[0] as Color));
      n++;
    }
    this.pole.count = n;
    this.cloth.count = n;
    if (n > 0) {
      this.pole.instanceMatrix.needsUpdate = true;
      this.cloth.instanceMatrix.needsUpdate = true;
      if (this.cloth.instanceColor) this.cloth.instanceColor.needsUpdate = true;
    }
  }
}
